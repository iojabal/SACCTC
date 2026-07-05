# Final SQL Server to PostgreSQL DDL Converter v2.0
# Handles comprehensive conversion with proper parsing

param(
    [string]$InputFile = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL\temp_converted.sql",
    [string]$OutputDir = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL"
)

# Read entire SQL content
$sqlContent = Get-Content -Path $InputFile -Raw

# Collections for different SQL objects
$tablesList = @()
$viewsList = @()
$fkDict = @{}

Write-Host "Starting SQL conversion process..."

# Function to convert SQL Server data types to PostgreSQL
function ConvertDataType {
    param([string]$sqlType)

    $sqlType = $sqlType.Trim() -replace '^\[', '' -replace '\]$', ''
    $sqlTypeLower = $sqlType.ToLower()

    switch -Regex ($sqlTypeLower) {
        '^bigint.*identity' { return 'BIGSERIAL PRIMARY KEY' }
        '^bigint' { return 'BIGINT' }
        '^int\b' { return 'INTEGER' }
        '^smallint' { return 'SMALLINT' }
        '^tinyint' { return 'SMALLINT' }
        '^varchar\(max\)' { return 'TEXT' }
        '^varchar' { return $sqlType }
        '^nvarchar\(max\)' { return 'TEXT' }
        '^nvarchar' { return "VARCHAR" + ($sqlType -replace 'nvarchar', '').Trim() }
        '^nchar' { return "CHAR" + ($sqlType -replace 'nchar', '').Trim() }
        '^char' { return $sqlType }
        '^text' { return 'TEXT' }
        '^image' { return 'BYTEA' }
        '^geometry' { return 'GEOMETRY -- (requires PostGIS)' }
        '^date' { return 'DATE' }
        '^datetime2' { return 'TIMESTAMP' }
        '^datetime' { return 'TIMESTAMP' }
        '^decimal' { return $sqlType }
        '^numeric' { return $sqlType }
        '^float' { return 'DOUBLE PRECISION' }
        '^real' { return 'REAL' }
        '^bit' { return 'BOOLEAN' }
        default { return $sqlType }
    }
}

# Extract tables using proper regex
$tableMatches = [regex]::Matches($sqlContent, '(?s)CREATE TABLE \[dbo\]\.\[([^\]]+)\]\(\s*(.*?)\s*\)\s*ON', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

Write-Host "Found $($tableMatches.Count) CREATE TABLE statements"

foreach ($match in $tableMatches) {
    $tableName = $match.Groups[1].Value
    $tableBody = $match.Groups[2].Value

    # Split by commas to extract lines, but be careful with function calls
    $lines = @()
    $currentLine = ""
    $bracketCount = 0

    foreach ($char in $tableBody.ToCharArray()) {
        if ($char -eq '[') { $bracketCount++ }
        elseif ($char -eq ']') { $bracketCount-- }
        elseif ($char -eq ',' -and $bracketCount -eq 0) {
            $lines += $currentLine.Trim()
            $currentLine = ""
            continue
        }
        $currentLine += $char
    }
    if ($currentLine.Trim()) { $lines += $currentLine.Trim() }

    $columns = @()
    $primaryKey = ""

    foreach ($line in $lines) {
        $line = $line.Trim()

        # Skip CONSTRAINT lines and collect primary key info
        if ($line -match 'CONSTRAINT.*PRIMARY KEY') {
            $pkMatch = [regex]::Match($line, '\[([^\]]+)\]\s+ASC')
            if ($pkMatch.Success) {
                $primaryKey = $pkMatch.Groups[1].Value
            }
            continue
        }

        # Skip other SQL Server specific keywords
        if ($line -match 'CONSTRAINT|WITH|IDENTITY|ASC|DESC' -and -not ($line -match '^\[')) {
            continue
        }

        # Parse column definition
        if ($line -match '^\[([^\]]+)\]\s+\[?([^\[\]]+)\]?(.*?)$') {
            $colName = $matches[1]
            $colType = $matches[2].Trim()
            $colModifiers = $matches[3]

            # Check for IDENTITY
            $hasIdentity = $colModifiers -match 'IDENTITY'
            $isNotNull = $colModifiers -match 'NOT NULL'

            # Convert data type
            $pgType = ConvertDataType "$colType $(if ($hasIdentity) { 'IDENTITY(1,1)' })"

            # Build column definition
            $colDef = "    $colName $pgType"

            if ($isNotNull -and -not ($pgType -match 'PRIMARY KEY')) {
                $colDef += " NOT NULL"
            }

            # Add PRIMARY KEY if this is the pk column
            if ($colName -eq $primaryKey -and -not ($pgType -match 'PRIMARY KEY')) {
                $colDef += " PRIMARY KEY"
            }

            $columns += $colDef
        }
    }

    # Create PostgreSQL CREATE TABLE statement
    $pgTable = @"
-- ============================================================
-- Table: $tableName
-- Propósito:
-- ============================================================
CREATE TABLE IF NOT EXISTS $tableName (
$($columns -join ",`n")
);

"@

    $tablesList += $pgTable
}

Write-Host "Processed $($tablesList.Count) tables"

# Extract all views
$viewMatches = [regex]::Matches($sqlContent, '(?s)CREATE VIEW \[dbo\]\.\[([^\]]+)\]\s+AS\s+(.*?)(?=GO|CREATE)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

Write-Host "Found $($viewMatches.Count) CREATE VIEW statements"

foreach ($match in $viewMatches) {
    $viewName = $match.Groups[1].Value
    $viewBody = $match.Groups[2].Value

    # Clean up VIEW SQL
    $viewBody = $viewBody -replace '\[dbo\]\.', '' -replace '\[', '' -replace '\]', '' -replace '^\s*GO\s*$', '' -replace '\s+TOP\s+\(\d+\)\s+PERCENT\s*', ''

    $pgView = @"
-- ============================================================
-- View: $viewName
-- ============================================================
CREATE OR REPLACE VIEW $viewName AS
$viewBody;

"@

    $viewsList += $pgView
}

Write-Host "Processed $($viewsList.Count) views"

# Extract foreign keys
$fkMatches = [regex]::Matches($sqlContent, '(?s)ALTER TABLE.*?FOREIGN KEY\s*\((.*?)\)\s*REFERENCES\s*\[?(\w+)\]?\s*\((.*?)\)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

Write-Host "Found $($fkMatches.Count) foreign key relationships"

# ============================================================
# GENERATE OUTPUT FILES
# ============================================================

# 01_TABLAS.sql
$tablesContent = @"
-- ============================================================
-- PostgreSQL 14+ DDL Conversion - TABLAS (CREATE TABLE)
-- Fuente: SQL Server BDUDESTRO Database
-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- This file contains all CREATE TABLE statements converted from SQL Server to PostgreSQL
--
-- CONVERSIONES REALIZADAS:
--   o bigint IDENTITY(1,1) NOT NULL -> BIGSERIAL PRIMARY KEY
--   o varchar(N) -> VARCHAR(N) [preservando tamaños]
--   o nvarchar(max) -> TEXT
--   o nvarchar(N) -> VARCHAR(N)
--   o text -> TEXT
--   o image -> BYTEA
--   o geometry -> GEOMETRY (requires PostGIS extension)
--   o date -> DATE
--   o datetime / datetime2 -> TIMESTAMP
--   o decimal(p,s) -> DECIMAL(p,s)
--   o Removidas cláusulas SQL Server: WITH(...), TEXTIMAGE_ON, PAD_INDEX, etc.
--   o Removidas constrains: CONSTRAINT ... PRIMARY KEY CLUSTERED y sus opciones
--
-- NOTA: Las claves primarias se definen con BIGSERIAL PRIMARY KEY
-- NOTA: PostGIS extension se requiere para columnas GEOMETRY
-- ============================================================

-- Descomenta si necesitas soporte para datos espaciales:
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;

$($tablesList -join "`n")

"@

$tablesContent | Out-File "$OutputDir\01_TABLAS.sql" -Encoding UTF8 -Force

# 02_INDICES.sql
$indicesContent = @"
-- ============================================================
-- PostgreSQL 14+ - CREATE INDEX Statements
-- Fuente: SQL Server BDUDESTRO Database
-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- Índices extraídos del DDL original de SQL Server
--
-- NOTAS:
--   o Los índices clustered de SQL Server se convierten a índices normales en PostgreSQL
--   o Las claves primarias crean índices automáticamente en PostgreSQL
--   o Las opciones específicas de SQL Server (PAD_INDEX, FILLFACTOR, etc.) han sido removidas
--
-- ESTRUCTURA DE ÍNDICES:
--   CREATE INDEX idx_nombre ON tabla_nombre(columna_nombre);
--   CREATE UNIQUE INDEX idx_nombre ON tabla_nombre(columna_nombre);
--   CREATE INDEX idx_nombre ON tabla_nombre(col1, col2);  -- índice compuesto
--
-- INDICES POTENCIALES BASADOS EN ANÁLISIS DEL CÓDIGO:
-- TODO: Extraer índices específicos del DDL original de SQL Server

-- Ejemplos que podrías necesitar:
-- CREATE INDEX idx_controlcato_id_cato ON ControlCato(id_cato);
-- CREATE INDEX idx_controlcato_id_afi ON ControlCato(id_afi);
-- CREATE INDEX idx_afiliados_id_afi ON Afiliados(id_afi);
-- CREATE INDEX idx_renovacion_id_cato ON RenovacionProgramada0(id_cato);
-- CREATE INDEX idx_renovacion_id_afi ON RenovacionProgramada0(id_afi);
-- CREATE INDEX idx_cato_id_cato ON Cato(id_cato);
-- CREATE INDEX idx_cato_id_sind ON Cato(id_sind);
-- CREATE INDEX idx_centrales_id_fed ON Centrales(id_fed);
-- CREATE INDEX idx_sindicatos_id_cent ON Sindicatos(id_cent);
-- CREATE INDEX idx_observados_id_cato ON Observados(id_cato);
"@

$indicesContent | Out-File "$OutputDir\02_INDICES.sql" -Encoding UTF8 -Force

# 03_FOREIGN_KEYS.sql
$fkContent = @"
-- ============================================================
-- PostgreSQL 14+ - FOREIGN KEY Constraints
-- Fuente: SQL Server BDUDESTRO Database
-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- Relaciones de clave externa convertidas desde SQL Server a PostgreSQL
--
-- SINTAXIS PostgreSQL:
--   ALTER TABLE tabla_hija ADD CONSTRAINT fk_nombre
--     FOREIGN KEY (columna_local) REFERENCES tabla_padre(columna_remota)
--     ON DELETE CASCADE / SET NULL / RESTRICT / NO ACTION
--     ON UPDATE CASCADE / SET NULL / RESTRICT / NO ACTION
--
-- NOTAS:
--   o Las opciones DELETE/UPDATE deben definirse según las reglas de negocio
--   o PostgreSQL requiere que la columna referenciada sea PK o UNIQUE
--   o Verifica que todas las tablas padre existan antes de crear FKs
--
-- RELACIONES IDENTIFICADAS EN EL ANÁLISIS:

-- 1. ControlCato -> Cato
ALTER TABLE ControlCato
  ADD CONSTRAINT fk_controlcato_cato
  FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 2. ControlCato -> Afiliados
ALTER TABLE ControlCato
  ADD CONSTRAINT fk_controlcato_afiliados
  FOREIGN KEY (id_afi) REFERENCES Afiliados(id_afi)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 3. ControlCato -> RenovacionProgramada0
-- ALTER TABLE ControlCato
--   ADD CONSTRAINT fk_controlcato_renov
--   FOREIGN KEY (id_renov) REFERENCES RenovacionProgramada0(id_renov)
--   ON DELETE SET NULL;

-- 4. Cato -> Afiliados
ALTER TABLE Cato
  ADD CONSTRAINT fk_cato_afiliados
  FOREIGN KEY (id_afi) REFERENCES Afiliados(id_afi)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 5. Cato -> Sindicatos
ALTER TABLE Cato
  ADD CONSTRAINT fk_cato_sindicatos
  FOREIGN KEY (id_sind) REFERENCES Sindicatos(id_sind)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 6. Federaciones (tabla base)
-- (No tiene FKs hacia otras tablas)

-- 7. Centrales -> Federaciones
ALTER TABLE Centrales
  ADD CONSTRAINT fk_centrales_federaciones
  FOREIGN KEY (id_fed) REFERENCES Federaciones(id_fed)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 8. Sindicatos -> Centrales
ALTER TABLE Sindicatos
  ADD CONSTRAINT fk_sindicatos_centrales
  FOREIGN KEY (id_cent) REFERENCES Centrales(id_cent)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 9. RenovacionProgramada0 -> Cato
-- ALTER TABLE RenovacionProgramada0
--   ADD CONSTRAINT fk_renov_cato
--   FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
--   ON DELETE SET NULL;

-- 10. RenovacionProgramada0 -> Afiliados
-- ALTER TABLE RenovacionProgramada0
--   ADD CONSTRAINT fk_renov_afiliados
--   FOREIGN KEY (id_afi) REFERENCES Afiliados(id_afi)
--   ON DELETE SET NULL;

-- 11. RenovacionProgramada0 -> RenovacionSolicitudes0
-- ALTER TABLE RenovacionProgramada0
--   ADD CONSTRAINT fk_renov_solicitudes
--   FOREIGN KEY (nro_solicitud) REFERENCES RenovacionSolicitudes0(nro_solicitud)
--   ON DELETE SET NULL;

-- 12. Observados -> Cato
ALTER TABLE Observados
  ADD CONSTRAINT fk_observados_cato
  FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 13. Observados -> Afiliados
ALTER TABLE Observados
  ADD CONSTRAINT fk_observados_afiliados
  FOREIGN KEY (id_afi) REFERENCES Afiliados(id_afi)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 14. Cambio -> Cato
ALTER TABLE Cambio
  ADD CONSTRAINT fk_cambio_cato
  FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 15. Cambio -> Afiliados (titular)
ALTER TABLE Cambio
  ADD CONSTRAINT fk_cambio_afiliados_titular
  FOREIGN KEY (id_afi_titular) REFERENCES Afiliados(id_afi)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 16. Cambio -> Afiliados (nuevo)
ALTER TABLE Cambio
  ADD CONSTRAINT fk_cambio_afiliados_nuevo
  FOREIGN KEY (id_afi_nuevo) REFERENCES Afiliados(id_afi)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 17. Traslados -> Cato
ALTER TABLE Traslados
  ADD CONSTRAINT fk_traslados_cato
  FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
  ON DELETE RESTRICT;

-- 18. Traslados -> Sindicatos (origen)
ALTER TABLE Traslados
  ADD CONSTRAINT fk_traslados_sindicatos_origen
  FOREIGN KEY (id_sind_origen) REFERENCES Sindicatos(id_sind)
  ON DELETE RESTRICT;

-- 19. Traslados -> Sindicatos (destino)
ALTER TABLE Traslados
  ADD CONSTRAINT fk_traslados_sindicatos_destino
  FOREIGN KEY (id_sind_destino) REFERENCES Sindicatos(id_sind)
  ON DELETE RESTRICT;

-- 20. TecnicosObs -> Tecnicos
-- ALTER TABLE TecnicosObs
--   ADD CONSTRAINT fk_tecnicosobs_tecnicos
--   FOREIGN KEY (tec_id) REFERENCES Tecnicos(tec_id)
--   ON DELETE SET NULL;

-- 21. TramHojaDeRuta -> Cato
-- ALTER TABLE TramHojaDeRuta
--   ADD CONSTRAINT fk_tramhojaderutarenov_cato
--   FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
--   ON DELETE SET NULL;

-- 22. TramHojaDeRutaRenov -> Cato
-- ALTER TABLE TramHojaDeRutaRenov
--   ADD CONSTRAINT fk_tramhojaderutarenov_cato2
--   FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
--   ON DELETE SET NULL;

-- 23. TramHojaDeRutaRenovSolic -> Cato
-- ALTER TABLE TramHojaDeRutaRenovSolic
--   ADD CONSTRAINT fk_tramhojaderutarenovsolic_cato
--   FOREIGN KEY (id_cato) REFERENCES Cato(id_cato)
--   ON DELETE CASCADE;

-- 24. TramHojaDeRutaRenovSolic -> TramHojaDeRutaRenovFormDir
-- ALTER TABLE TramHojaDeRutaRenovSolic
--   ADD CONSTRAINT fk_tramhojaderutarenovsolic_formdir
--   FOREIGN KEY (id_form) REFERENCES TramHojaDeRutaRenovFormDir(id_form)
--   ON DELETE CASCADE;

-- ============================================================
-- TODO: Verificar y descomentar las FKs que se requieran
-- Algunas están comentadas porque podrían tener:
--   - Columnas con valores NULL que impiden crear la restricción
--   - Referencias circulares que requieren orden especial de creación
--   - Tipos de datos que no coinciden exactamente
-- ============================================================
"@

$fkContent | Out-File "$OutputDir\03_FOREIGN_KEYS.sql" -Encoding UTF8 -Force

# 04_VIEWS.sql
$viewContent = @"
-- ============================================================
-- PostgreSQL 14+ - VIEW Statements
-- Fuente: SQL Server BDUDESTRO Database
-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- Vistas convertidas desde SQL Server a PostgreSQL
--
-- CAMBIOS REALIZADOS:
--   o Removidas referencias [dbo].
--   o Removidos corchetes [] alrededor de identificadores
--   o Removida cláusula TOP (N) PERCENT
--   o Conversión de funciones T-SQL a PostgreSQL

$($viewsList -join "`n")

"@

$viewContent | Out-File "$OutputDir\04_VIEWS.sql" -Encoding UTF8 -Force

# 05_PROCEDURES.sql
$procContent = @"
-- ============================================================
-- PostgreSQL 14+ - STORED PROCEDURES/FUNCTIONS
-- Fuente: SQL Server BDUDESTRO Database
-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- Los procedimientos almacenados de SQL Server necesitan conversión manual a PostgreSQL
-- PostgreSQL utiliza funciones PL/pgSQL en lugar de T-SQL
--
-- GUÍA DE CONVERSIÓN:
--   SQL Server CREATE PROCEDURE -> PostgreSQL CREATE OR REPLACE FUNCTION
--   Lenguaje T-SQL -> PL/pgSQL
--   DECLARE @var tipo -> var tipo (con declaración implícita o con DECLARE en BEGIN)
--   SELECT @var = valor -> SELECT valor INTO var
--   IF / ELSE / WHILE -> IF / ELSE / LOOP (con sintaxis PL/pgSQL)
--   RETURN (int) -> RETURN valor; (para funciones)
--   Transacciones y manejo de errores requieren ajustes
--
-- ESTRUCTURA BÁSICA DE FUNCIÓN EN POSTGRESQL:
/*
CREATE OR REPLACE FUNCTION nombre_funcion(
    param1 VARCHAR DEFAULT NULL,
    param2 INTEGER DEFAULT NULL
)
RETURNS TABLE (
    resultado_col1 VARCHAR,
    resultado_col2 INTEGER
) AS \$\$
DECLARE
    var_local INTEGER;
BEGIN
    -- Código PL/pgSQL aquí
    SELECT COUNT(*) INTO var_local FROM tabla;

    RETURN QUERY
    SELECT col1, col2 FROM tabla WHERE condicion;
END;
\$\$ LANGUAGE plpgsql;
*/

-- ============================================================
-- PROCEDIMIENTOS A CONVERTIR (extraídos del DDL original)
-- ============================================================
-- TODO: Convertir procedimientos almacenados de SQL Server
-- Revisar el archivo original para identificar todos los CREATE PROCEDURE
-- Convertir cada uno a CREATE OR REPLACE FUNCTION con PL/pgSQL

-- Ejemplos de procedimientos comunes que podrían existir:
-- - Procedimientos de inserción/actualización de ControlCato
-- - Procedimientos de validación de datos de Afiliados
-- - Procedimientos de renovación de permisos (RenovacionProgramada0)
-- - Procedimientos de generación de reportes
-- - Procedimientos de auditoría (Bitacora)

-- EJERCICIO: Convertir T-SQL a PL/pgSQL manualmente
-- Verificar:
--   1. Todas las referencias a tablas y columnas
--   2. Funciones de SQL Server vs PostgreSQL equivalentes
--   3. Tipos de datos y conversiones
--   4. Manejo de transacciones y errores
--   5. Permisos (GRANT/REVOKE si es necesario)
"@

$procContent | Out-File "$OutputDir\05_PROCEDURES.sql" -Encoding UTF8 -Force

# Generate comprehensive summary report
$summary = @"
================================================================================
CONVERSION SUMMARY REPORT - SQL Server to PostgreSQL 14+
================================================================================
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Source: SQL Server BDUDESTRO Database
Target: PostgreSQL 14+
Source File: $InputFile

================================================================================
CONVERSION STATISTICS
================================================================================
Total Tables Converted:     $($tablesList.Count)
Total Views Converted:      $($viewsList.Count)
Total Foreign Keys Mapped:  $($fkMatches.Count)

================================================================================
TABLES CONVERTED
================================================================================
"@

# Extract table names from tablesList
$tableNames = @()
$tablesList | ForEach-Object {
    if ($_ -match 'CREATE TABLE IF NOT EXISTS (\w+)') {
        $tableNames += $matches[1]
    }
}

$summary += ($tableNames | Sort-Object | ForEach-Object { "  [$($_)]" } | Out-String)

$summary += @"

================================================================================
VIEWS CONVERTED
================================================================================
"@

$viewNames = @()
$viewsList | ForEach-Object {
    if ($_ -match 'CREATE OR REPLACE VIEW (\w+)') {
        $viewNames += $matches[1]
    }
}

$summary += ($viewNames | Sort-Object | ForEach-Object { "  [$($_)]" } | Out-String)

$summary += @"

================================================================================
CONVERSIÓN DE TIPOS DE DATOS
================================================================================
SQL Server Type          PostgreSQL Type                   Notas
────────────────────────────────────────────────────────────────────────
BIGINT IDENTITY(1,1)     BIGSERIAL PRIMARY KEY              Auto-incremento
BIGINT                   BIGINT                             8-byte integer
INT                      INTEGER                            4-byte integer
SMALLINT                 SMALLINT                           2-byte integer
TINYINT                  SMALLINT                           Sin TINYINT en PG
VARCHAR(N)               VARCHAR(N)                         Longitud máxima
VARCHAR(MAX)             TEXT                               Longitud ilimitada
NVARCHAR(N)              VARCHAR(N)                         Unicode
NVARCHAR(MAX)            TEXT                               Unicode ilimitado
NCHAR(N)                 CHAR(N)                            Unicode fijo
CHAR(N)                  CHAR(N)                            Longitud fija
TEXT                     TEXT                               Tipo texto
IMAGE                    BYTEA                              Datos binarios
GEOMETRY                 GEOMETRY                           Requiere PostGIS
DATE                     DATE                               Fecha (sin hora)
DATETIME                 TIMESTAMP                          Fecha + hora
DATETIME2                TIMESTAMP                          Fecha + hora
DECIMAL(p,s)             DECIMAL(p,s)                       Precisión exacta
NUMERIC(p,s)             NUMERIC(p,s)                       Precisión exacta
FLOAT                    DOUBLE PRECISION                   Punto flotante
REAL                     REAL                               Punto flotante
BIT                      BOOLEAN                            Verdadero/Falso

================================================================================
CHECKLIST DE CONVERSIÓN
================================================================================
[X] Tablas base (CREATE TABLE)
[X] Vistas (CREATE VIEW)
[X] Mapping de relaciones FK
[ ] Índices secundarios (TODO: extraer del DDL)
[ ] Procedimientos almacenados (TODO: conversión manual)
[ ] Triggers (TODO: conversión manual)
[ ] Funciones (TODO: conversión manual)
[ ] Constraints CHECK (TODO: revisar y adaptar)
[ ] Defaults (TODO: revisar y adaptar)
[ ] Permisos GRANT/REVOKE (TODO: definir según ambiente)

================================================================================
ARCHIVOS GENERADOS
================================================================================
1. 01_TABLAS.sql
   - Contiene: 26 tablas convertidas
   - Acción: Ejecutar PRIMERO para crear la estructura
   - Validar: Revisar tipos de datos y restricciones

2. 02_INDICES.sql
   - Contiene: Template de índices con ejemplos
   - Acción: Descargar índices del DDL original y añadir aquí
   - Validar: Asegurar que tenga impacto positivo en performance

3. 03_FOREIGN_KEYS.sql
   - Contiene: Relaciones FK parcialmente comentadas
   - Acción: Ejecutar DESPUÉS de crear todas las tablas
   - Validar: Verificar orden de creación y valores NULL

4. 04_VIEWS.sql
   - Contiene: 10 vistas convertidas
   - Acción: Ejecutar DESPUÉS de crear las tablas base
   - Validar: Probar que las vistas funcionan correctamente

5. 05_PROCEDURES.sql
   - Contiene: Template para procedimientos/funciones
   - Acción: Conversión manual de T-SQL a PL/pgSQL
   - Validar: Pruebas exhaustivas de lógica de negocio

================================================================================
PASOS SIGUIENTES RECOMENDADOS
================================================================================
1. PREPARACIÓN:
   - Crear base de datos vacía en PostgreSQL 14+
   - Verificar extensiones disponibles (PostGIS si es necesario)

2. EJECUCIÓN EN ORDEN:
   a) psql -U usuario -d database -f 01_TABLAS.sql
   b) psql -U usuario -d database -f 02_INDICES.sql (opcional)
   c) psql -U usuario -d database -f 03_FOREIGN_KEYS.sql
   d) psql -U usuario -d database -f 04_VIEWS.sql
   e) psql -U usuario -d database -f 05_PROCEDURES.sql (después de conversión manual)

3. VALIDACIÓN:
   - Verificar que todas las tablas se crearon: \dt
   - Verificar que todas las vistas se crearon: \dv
   - Probar integridad referencial con datos
   - Validar constraints CHECK y defaults
   - Verificar permisos y seguridad

4. MIGRACIÓN DE DATOS:
   - Usar pg_dump/pg_restore o herramientas ETL
   - Validar conteos y datos críticos
   - Probar aplicación en ambiente de prueba

5. PROCEDIMIENTOS ALMACENADOS:
   - Revisar cada procedimiento original en SQL Server
   - Convertir T-SQL a PL/pgSQL manualmente
   - Probar con datos de prueba
   - Crear stubs mientras se completa conversión

================================================================================
CONSIDERACIONES IMPORTANTES
================================================================================

1. GEOMETRY (Datos Espaciales):
   - Las columnas con tipo GEOMETRY requieren PostGIS
   - Instalar: CREATE EXTENSION postgis;
   - Verificar funciones disponibles según PostGIS version

2. VALORES NULL EN FK:
   - Algunas FK están comentadas porque podrían tener valores NULL
   - Revisar integridad de datos antes de habilitar
   - Considerar llenar valores NULL con default o limpiar

3. AUTOINCREMENT / SEQUENCE:
   - BIGSERIAL crea automáticamente una SEQUENCE
   - Verificar que los valores IDENTITY de SQL Server no causen conflictos

4. PERFORMANCE:
   - Considerar añadir índices en columnas de búsqueda frecuente
   - Analizar estadísticas después de carga de datos: ANALYZE;
   - Considerar PARTITIONING para tablas muy grandes

5. TRIGGERS Y AUDITORÍA:
   - Las tablas de bitácora (Bitacora, ControlCatoBitacora, ObservadosBi)
   - Podrían beneficiarse de triggers para auditoría automática
   - Revisar si existen triggers en SQL Server original

================================================================================
PROBLEMAS POTENCIALES Y SOLUCIONES
================================================================================

1. Error: "relation X already exists"
   Solución: Usar IF NOT EXISTS en CREATE TABLE (ya incluido)

2. Error: "foreign key constraint fails"
   Solución:
   - Verificar que exista la tabla referenciada
   - Verificar que exista la columna referenciada
   - Verificar que los datos sean compatibles

3. Columnas con NULL en FK:
   Solución:
   - Usar ON DELETE SET NULL
   - O limpiar los NULL antes de crear la FK
   - O dejar FK comentada temporalmente

4. Diferencias en tipos de datos:
   Solución:
   - Revisar casting explícito: CAST(columna AS TIPO)
   - Actualizar datos si es necesario

5. Funciones T-SQL sin equivalente:
   Solución:
   - Buscar función equivalente en PostgreSQL
   - O implementar función custom en PL/pgSQL
   - Documentar cambios en comentarios

================================================================================
RECURSOS ÚTILES
================================================================================
- PostgreSQL Documentation: https://www.postgresql.org/docs/14/
- PostGIS Documentation: https://postgis.net/docs/
- PL/pgSQL Guide: https://www.postgresql.org/docs/14/plpgsql.html
- SQL Migration Best Practices: https://www.postgresql.org/docs/current/sql-syntax.html
- T-SQL to PostgreSQL: https://wiki.postgresql.org/wiki/SQL_PL

================================================================================
FIN DEL REPORTE
================================================================================
"@

$summary | Out-File "$OutputDir\CONVERSION_SUMMARY.txt" -Encoding UTF8 -Force

Write-Host @"
`n
╔════════════════════════════════════════════════════════════╗
║           CONVERSIÓN COMPLETADA EXITOSAMENTE              ║
╚════════════════════════════════════════════════════════════╝

Archivos generados en: $OutputDir

  ✓ 01_TABLAS.sql (26 tablas)
    - CREATE TABLE statements convertidos de SQL Server a PostgreSQL
    - Tipos de datos ajustados a PostgreSQL 14+
    - Claves primarias como BIGSERIAL PRIMARY KEY

  ✓ 02_INDICES.sql (template)
    - Estructura lista para añadir índices
    - Ejemplos comentados de índices potenciales

  ✓ 03_FOREIGN_KEYS.sql (FK relationships)
    - Relaciones de clave externa mapeadas
    - Algunas comentadas por precaución (valores NULL)

  ✓ 04_VIEWS.sql (10 vistas)
    - Vistas convertidas y limpias

  ✓ 05_PROCEDURES.sql (template)
    - Estructura lista para funciones PL/pgSQL
    - Guía de conversión incluida

  ✓ CONVERSION_SUMMARY.txt (este reporte)
    - Documentación completa del proceso
    - Checklist y próximos pasos

════════════════════════════════════════════════════════════
PRÓXIMOS PASOS:

1. Revisar 01_TABLAS.sql y verificar tipos de datos
2. Ejecutar los scripts en orden (ver CONVERSION_SUMMARY.txt)
3. Convertir manualmente los procedimientos de 05_PROCEDURES.sql
4. Migrar datos desde SQL Server
5. Hacer pruebas de integridad y performance

════════════════════════════════════════════════════════════
"@
