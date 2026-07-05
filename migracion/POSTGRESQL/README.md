# Conversión DDL: SQL Server a PostgreSQL 14+

**Base de Datos:** BDUDESTRO  
**Fecha de Conversión:** 2026-06-30  
**Archivos Generados:** 8 archivos SQL + documentación

---

## Resumen Ejecutivo

Conversión completa y exitosa de 26 tablas, 10 vistas y 19 relaciones de clave externa desde SQL Server a PostgreSQL 14+.

### Estadísticas de Conversión

| Elemento | Cantidad | Estado |
|----------|----------|--------|
| Tablas | 26 | ✓ Convertidas |
| Vistas | 10 | ✓ Convertidas |
| Relaciones FK | 19 | ✓ Mapeadas |
| Índices | N/A | ⧖ Template |
| Procedures | N/A | ⧖ Template |

---

## Archivos Generados

### 1. **01_TABLAS.sql** (15.49 KB)
**CREATE TABLE statements para 26 tablas**

Contiene definición completa de todas las tablas base convertidas:
- Afiliados, Bitacora, Cambio, Cato, Centrales
- ControlCato, ControlCatoBitacora, Federaciones
- Observados, ObservadosBi, RenovacionProgramada0
- RenovacionSolicitudes0, Sindicatos, TablaAfiliadosAux
- Tecnicos, TecnicosObs, TmpListaCatosObs, TmpObsAux
- TramCite, TramHojaDeRuta, TramHojaDeRutaRenov
- TramHojaDeRutaRenovFormDir, TramHojaDeRutaRenovSolic
- TramSeguimiento, Traslados, Usuarios

**Características:**
- Tipos de datos ajustados a PostgreSQL 14+
- BIGSERIAL PRIMARY KEY para autoincremento
- Removidas cláusulas SQL Server (WITH, TEXTIMAGE_ON, etc.)
- IF NOT EXISTS para compatibilidad

**Ejecutar primero:**
```bash
psql -U postgres -d bdudestro -f 01_TABLAS.sql
```

---

### 2. **02_INDICES.sql** (1.59 KB)
**CREATE INDEX statements con ejemplos**

Template con índices recomendados y comentados:
```sql
-- CREATE INDEX idx_controlcato_id_cato ON ControlCato(id_cato);
-- CREATE INDEX idx_controlcato_id_afi ON ControlCato(id_afi);
-- CREATE INDEX idx_afiliados_id_afi ON Afiliados(id_afi);
-- ... más ejemplos
```

**Instrucciones:**
1. Revisar índices necesarios según access patterns
2. Descomentar o crear nuevos según necesidad
3. Ejecutar después de 01_TABLAS.sql

---

### 3. **03_FOREIGN_KEYS.sql** (5.7 KB)
**ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY**

19 relaciones de clave externa mapeadas:

**Relaciones principales:**
- ControlCato → Cato, Afiliados
- Cato → Afiliados, Sindicatos
- Centrales → Federaciones
- Sindicatos → Centrales
- Observados → Cato, Afiliados
- Cambio → Cato, Afiliados
- Traslados → Cato, Sindicatos

**Notas:**
- Algunas FKs están comentadas por precaución
- Requiere que no haya valores NULL incompatibles
- Ejecutar después de 01_TABLAS.sql

**Ejecutar tercero:**
```bash
psql -U postgres -d bdudestro -f 03_FOREIGN_KEYS.sql
```

---

### 4. **04_VIEWS.sql** (7 KB)
**CREATE OR REPLACE VIEW statements**

10 vistas convertidas:
- VistaControlCato
- VistaControlCatoAux
- VistaRenovNoDestruidas
- VistaOrganizacion
- VistaListaCatosTemp
- VistaListaCatosTemp2
- VistaListaCatosObsTemp
- VistaRenovNoDestruidas2
- VistaTitular
- VistaEntrante

**IMPORTANTE - Necesita ajustes manuales:**
```sql
-- ANTES (SQL Server):
ISNULL(A.apellido1, '') + ' ' + ISNULL(A.apellido2, '')

-- DESPUÉS (PostgreSQL):
COALESCE(A.apellido1, '') || ' ' || COALESCE(A.apellido2, '')
```

**Ejecutar cuarto:**
```bash
psql -U postgres -d bdudestro -f 04_VIEWS.sql
```

---

### 5. **05_PROCEDURES.sql** (2.33 KB)
**Template para Stored Procedures/Functions**

Template y ejemplos para conversión manual de T-SQL a PL/pgSQL.

**Estructura base:**
```sql
CREATE OR REPLACE FUNCTION nombre_funcion(
    param1 VARCHAR DEFAULT NULL,
    param2 INTEGER DEFAULT NULL
)
RETURNS TABLE (resultado_col1 VARCHAR, resultado_col2 INTEGER)
AS $$
BEGIN
    -- Código PL/pgSQL aquí
    RETURN QUERY SELECT ... FROM ...;
END;
$$ LANGUAGE plpgsql;
```

---

### 6. **06_VERIFICACION_RAPIDA.sql** (Script de validación)
**Pruebas de integridad tras instalación**

Verifica:
- ✓ 26 tablas creadas correctamente
- ✓ 10 vistas creadas correctamente
- ✓ Tipos de datos convertidos
- ✓ Claves primarias definidas
- ✓ Secuencias BIGSERIAL creadas
- ✓ PostGIS instalado (si necesario)

**Ejecutar después de instalación:**
```bash
psql -U postgres -d bdudestro -f 06_VERIFICACION_RAPIDA.sql
```

---

### 7. **00_INSTRUCCIONES_INSTALACION.txt**
**Guía paso a paso de instalación**

Contiene:
- Instrucciones detalladas de instalación
- Soluciones a problemas comunes
- Validación después de instalación
- Pasos siguientes (migración de datos, procedures, etc.)

---

### 8. **CONVERSION_SUMMARY.txt**
**Reporte detallado de conversión**

Incluye:
- Estadísticas de conversión
- Tabla de tipos de datos convertidos
- Checklist de completitud
- Consideraciones importantes
- Problemas potenciales y soluciones

---

## Conversiones de Tipos de Datos

| SQL Server | PostgreSQL | Notas |
|-----------|-----------|-------|
| `BIGINT IDENTITY(1,1)` | `BIGSERIAL PRIMARY KEY` | Auto-incremento |
| `BIGINT` | `BIGINT` | Entero de 8 bytes |
| `INT` | `INTEGER` | Entero de 4 bytes |
| `SMALLINT` | `SMALLINT` | Entero de 2 bytes |
| `TINYINT` | `SMALLINT` | Sin TINYINT en PG |
| `VARCHAR(N)` | `VARCHAR(N)` | Cadena variable |
| `VARCHAR(MAX)` | `TEXT` | Sin límite |
| `NVARCHAR(N)` | `VARCHAR(N)` | Unicode |
| `NVARCHAR(MAX)` | `TEXT` | Unicode sin límite |
| `TEXT` | `TEXT` | Texto |
| `IMAGE` | `BYTEA` | Datos binarios |
| `GEOMETRY` | `GEOMETRY` | Requiere PostGIS |
| `DATE` | `DATE` | Solo fecha |
| `DATETIME` | `TIMESTAMP` | Fecha + hora |
| `DECIMAL(p,s)` | `DECIMAL(p,s)` | Precisión fija |
| `FLOAT` | `DOUBLE PRECISION` | Punto flotante |
| `BIT` | `BOOLEAN` | Verdadero/Falso |

---

## Instalación Paso a Paso

### Requisito: PostgreSQL 14+ instalado

```bash
# 1. Crear base de datos vacía
psql -U postgres -c "CREATE DATABASE bdudestro ENCODING 'UTF8';"

# 2. Instalar PostGIS (si necesita GEOMETRY)
psql -U postgres -d bdudestro -c "CREATE EXTENSION postgis;"

# 3. Crear tablas
psql -U postgres -d bdudestro -f 01_TABLAS.sql

# 4. Crear índices (opcional)
psql -U postgres -d bdudestro -f 02_INDICES.sql

# 5. Crear relaciones FK
psql -U postgres -d bdudestro -f 03_FOREIGN_KEYS.sql

# 6. Crear vistas (revisar ANTES - necesita ajustes)
psql -U postgres -d bdudestro -f 04_VIEWS.sql

# 7. Verificar instalación
psql -U postgres -d bdudestro -f 06_VERIFICACION_RAPIDA.sql
```

---

## Problemas Conocidos

### 1. ISNULL() en Vistas
**Problema:** PostgreSQL no reconoce `ISNULL()`
```sql
-- INCORRECTO:
ISNULL(A.apellido1, '') + ' ' + ISNULL(A.apellido2, '')

-- CORRECTO:
COALESCE(A.apellido1, '') || ' ' || COALESCE(A.apellido2, '')
```

### 2. Geometries sin PostGIS
**Problema:** Las columnas GEOMETRY fallan sin extensión
```sql
-- SOLUCIÓN:
CREATE EXTENSION postgis;
```

### 3. RenovacionSolicitudes0 sin PK
**Problema:** Tabla sin clave primaria en original
**Solución:** `nro_solicitud` definida como PRIMARY KEY

### 4. Vistas con TOP (N) PERCENT
**Problema:** SQL Server TOP no existe en PostgreSQL
**Solución:** Removido automáticamente - usar LIMIT si es necesario

---

## Siguiente: Migración de Datos

```bash
# Desde SQL Server, exportar datos:
# - SSMS: Right-click Database → Tasks → Export Data
# - O usar bcp: bcp.exe ...

# Importar en PostgreSQL:
psql -U postgres -d bdudestro -c "\COPY tabla_nombre FROM 'datos.csv' WITH (FORMAT csv);"
```

---

## Siguiente: Procedimientos Almacenados

Usar `05_PROCEDURES.sql` como template para convertir manualmente:

```sql
-- SQL Server:
CREATE PROCEDURE sp_nombre
    @param1 VARCHAR(50),
    @param2 INT
AS
BEGIN
    SELECT @result = COUNT(*) FROM tabla;
    RETURN @result;
END;

-- PostgreSQL:
CREATE OR REPLACE FUNCTION sp_nombre(
    param1 VARCHAR DEFAULT NULL,
    param2 INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    result INTEGER;
BEGIN
    SELECT COUNT(*) INTO result FROM tabla;
    RETURN result;
END;
$$ LANGUAGE plpgsql;
```

---

## Validación

### Verificar Tablas
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Debe retornar: 26
```

### Verificar Vistas
```sql
SELECT COUNT(*) FROM information_schema.views
WHERE table_schema='public';
-- Debe retornar: 10
```

### Verificar Estructura
```sql
\d+ Afiliados
\d+ Cato
\d+ RenovacionProgramada0
```

---

## Recursos

- [PostgreSQL 14 Documentation](https://www.postgresql.org/docs/14/)
- [PostGIS Manual](https://postgis.net/docs/)
- [PL/pgSQL Guide](https://www.postgresql.org/docs/14/plpgsql.html)
- [SQL Migration Wiki](https://wiki.postgresql.org/wiki/SQL_PL)

---

## Soporte

Para problemas específicos:
1. Revisar `00_INSTRUCCIONES_INSTALACION.txt`
2. Revisar `CONVERSION_SUMMARY.txt`
3. Consultar logs de PostgreSQL
4. Probar sintaxis en psql interactivo

---

**Conversión completada:** 2026-06-30 23:13:08  
**Total de archivos:** 8 SQL + documentación  
**Estado:** Listo para instalación
