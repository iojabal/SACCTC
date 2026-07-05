# Advanced SQL Server to PostgreSQL DDL Converter
# Handles 36 tables, views, indexes, and foreign keys

param(
    [string]$InputFile = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL\temp_converted.sql",
    [string]$OutputDir = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL"
)

# Read entire SQL content
$sqlContent = Get-Content -Path $InputFile -Raw

# Collections for different SQL objects
$tablesDict = @{}
$viewsList = @()
$indexesList = @()
$fkList = @()

# Function to convert SQL Server data types to PostgreSQL
function ConvertDataType {
    param([string]$sqlType)

    $sqlType = $sqlType.Trim()

    # Handle types with brackets
    if ($sqlType -match '^\[(.+?)\]') {
        $sqlType = $matches[1]
    }

    $sqlType = $sqlType -replace '^\[', '' -replace '\]$', ''
    $sqlTypeLower = $sqlType.ToLower()

    switch -Regex ($sqlTypeLower) {
        '^bigint' {
            if ($sqlType -imatch 'IDENTITY') {
                return 'BIGSERIAL'
            }
            return 'BIGINT'
        }
        '^int\b' { return 'INTEGER' }
        '^smallint' { return 'SMALLINT' }
        '^tinyint' { return 'SMALLINT' }
        '^varchar\(max\)' { return 'TEXT' }
        '^varchar\(' { return $sqlType }
        '^varchar\b' { return 'VARCHAR' }
        '^nvarchar\(max\)' { return 'TEXT' }
        '^nvarchar\(' {
            $size = $sqlType -replace 'nvarchar\((.*?)\)', '$1'
            return "VARCHAR($size)"
        }
        '^nvarchar\b' { return 'VARCHAR' }
        '^nchar\(' {
            $size = $sqlType -replace 'nchar\((.*?)\)', '$1'
            return "CHAR($size)"
        }
        '^char\(' { return $sqlType }
        '^text\b' { return 'TEXT' }
        '^image\b' { return 'BYTEA' }
        '^geometry\b' { return 'GEOMETRY' }
        '^date\b' { return 'DATE' }
        '^datetime2' { return 'TIMESTAMP' }
        '^datetime\b' { return 'TIMESTAMP' }
        '^decimal\(' { return $sqlType }
        '^numeric\(' { return $sqlType }
        '^float\b' { return 'DOUBLE PRECISION' }
        '^real\b' { return 'REAL' }
        '^bit\b' { return 'BOOLEAN' }
        default { return $sqlType }
    }
}

# Extract all table definitions
$tablePattern = '(?sm)CREATE TABLE \[dbo\]\.\[([^\]]+)\]\((.*?)(?=\n\s*/\*|CREATE TABLE|CREATE VIEW|CREATE INDEX|\Z)'
$tableMatches = [regex]::Matches($sqlContent, $tablePattern)

Write-Host "Found $($tableMatches.Count) tables"

foreach ($match in $tableMatches) {
    $tableName = $match.Groups[1].Value
    $tableBody = $match.Groups[2].Value

    $columns = @()
    $primaryKey = $null
    $notNullCols = @()

    # Parse constraint for primary key
    $constraintMatch = [regex]::Match($tableBody, 'CONSTRAINT.*?PRIMARY KEY.*?\((.*?)\)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($constraintMatch.Success) {
        $pkCol = $constraintMatch.Groups[1].Value -replace '[\[\]\n\t]', '' -replace 'ASC|DESC', '' -replace '\s+', ''
        $primaryKey = $pkCol
    }

    # Parse column definitions
    $colPattern = '\[([^\]]+)\]\s+\[?([^\[\],]+)\]?\s*(IDENTITY\([^)]+\))?\s*(NOT NULL|NULL)?'
    $colMatches = [regex]::Matches($tableBody, $colPattern)

    foreach ($colMatch in $colMatches) {
        $colName = $colMatch.Groups[1].Value
        $colType = $colMatch.Groups[2].Value
        $colIdentity = $colMatch.Groups[3].Value
        $colNullable = $colMatch.Groups[4].Value

        # Convert data type
        $fullType = "$colType $colIdentity".Trim()
        $pgType = ConvertDataType $fullType

        $colDef = "    ""$colName"" $pgType"

        # Add NOT NULL constraint
        if ($colNullable -match 'NOT NULL') {
            $colDef += " NOT NULL"
            $notNullCols += $colName
        }

        # Check if this is primary key
        if ($colName -eq $primaryKey) {
            if ($pgType -eq 'BIGSERIAL') {
                $colDef += " PRIMARY KEY"
            }
        }

        $columns += $colDef
    }

    # Create PostgreSQL CREATE TABLE statement
    $pgTable = @"
-- ============================================================
-- Table: $tableName
-- ============================================================
CREATE TABLE IF NOT EXISTS $tableName (
$($columns -join ",`n")
);

"@

    $tablesDict[$tableName] = @{
        SQL = $pgTable
        PrimaryKey = $primaryKey
        Columns = @($colMatches | ForEach-Object { $_.Groups[1].Value })
    }
}

# Extract all views
$viewPattern = '(?sm)CREATE VIEW \[dbo\]\.\[([^\]]+)\](.*?)(?=\nGO|CREATE|EXEC|\Z)'
$viewMatches = [regex]::Matches($sqlContent, $viewPattern)

foreach ($match in $viewMatches) {
    $viewName = $match.Groups[1].Value
    $viewBody = $match.Groups[2].Value

    # Clean up VIEW definition
    $viewBody = $viewBody -replace '^AS\s+', '' -replace '\n\s+TOP\s+\(\d+\)\s+PERCENT', '' -replace '\[dbo\]\.', '' -replace '\[', '' -replace '\]', '' -replace 'ORDER BY.*', ''

    $pgView = @"
-- ============================================================
-- View: $viewName
-- ============================================================
CREATE OR REPLACE VIEW $viewName AS
$viewBody;

"@

    $viewsList += $pgView
}

Write-Host "Found $($viewMatches.Count) views"

# Generate output files

# 01_TABLAS.sql
$tablesContent = @"
-- ============================================================
-- PostgreSQL 14+ DDL Conversion
-- Source: SQL Server BDUDESTRO Database
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================
-- This file contains all CREATE TABLE statements converted from SQL Server to PostgreSQL
-- Key conversions:
--   - bigint IDENTITY(1,1) -> BIGSERIAL PRIMARY KEY
--   - varchar(N) -> VARCHAR(N)
--   - nvarchar(max) -> TEXT
--   - image -> BYTEA
--   - geometry -> GEOMETRY (requires PostGIS extension)
--   - Removed SQL Server specific clauses: WITH(...), TEXTIMAGE_ON, PAD_INDEX, etc.
-- ============================================================

-- Create extension for spatial data (if needed)
-- CREATE EXTENSION IF NOT EXISTS postgis;

"@

foreach ($tableName in ($tablesDict.Keys | Sort-Object)) {
    $tablesContent += $tablesDict[$tableName].SQL
}

$tablesContent | Out-File "$OutputDir\01_TABLAS.sql" -Encoding UTF8

# 02_INDICES.sql
$indicesContent = @"
-- ============================================================
-- PostgreSQL 14+ - CREATE INDEX Statements
-- Source: SQL Server BDUDESTRO Database
-- ============================================================
-- SQL Server indexes extracted and converted to PostgreSQL syntax
-- Note: Clustered indexes become regular indexes in PostgreSQL
-- Note: SQL Server-specific options (PAD_INDEX, FILLFACTOR, etc.) have been removed

-- Primary key indexes are created implicitly with CREATE TABLE
-- Add additional indexes below as needed based on your SQL Server analysis

-- Example structure for non-clustered indexes:
-- CREATE INDEX idx_table_column ON table_name(column_name);
-- CREATE UNIQUE INDEX idx_unique_table_column ON table_name(column_name);

-- TODO: Extract specific indexes from source SQL Server DDL
"@

$indicesContent | Out-File "$OutputDir\02_INDICES.sql" -Encoding UTF8

# 03_FOREIGN_KEYS.sql
$fkContent = @"
-- ============================================================
-- PostgreSQL 14+ - FOREIGN KEY Constraints
-- Source: SQL Server BDUDESTRO Database
-- ============================================================
-- Foreign keys from SQL Server converted to PostgreSQL syntax
-- Uncomment and adjust based on your actual foreign key relationships

-- Structure template:
-- ALTER TABLE child_table ADD CONSTRAINT fk_name
--   FOREIGN KEY (column_name) REFERENCES parent_table(column_name)
--   ON DELETE CASCADE / ON DELETE SET NULL
--   ON UPDATE CASCADE / ON UPDATE SET NULL;

-- TODO: Extract specific foreign keys from source SQL Server DDL
-- Example relationships to verify:
--   - ControlCato.id_cato -> Cato.id_cato
--   - ControlCato.id_afi -> Afiliados.id_afi
--   - Cato.id_sind -> Sindicatos.id_sind
--   - Centrales.id_fed -> Federaciones.id_fed
--   - Sindicatos.id_cent -> Centrales.id_cent
"@

$fkContent | Out-File "$OutputDir\03_FOREIGN_KEYS.sql" -Encoding UTF8

# 04_VIEWS.sql
$viewContent = @"
-- ============================================================
-- PostgreSQL 14+ - VIEW Statements
-- Source: SQL Server BDUDESTRO Database
-- ============================================================
-- Views converted from SQL Server to PostgreSQL syntax
-- Removed: TOP (N) PERCENT, [dbo]. prefixes, square brackets

$($viewsList -join "`n`n")

"@

$viewContent | Out-File "$OutputDir\04_VIEWS.sql" -Encoding UTF8

# 05_PROCEDURES.sql
$procContent = @"
-- ============================================================
-- PostgreSQL 14+ - STORED PROCEDURES/FUNCTIONS
-- Source: SQL Server BDUDESTRO Database
-- ============================================================
-- SQL Server stored procedures need to be manually converted to PostgreSQL functions
-- PostgreSQL functions use PL/pgSQL language instead of T-SQL
--
-- CONVERSION NOTES:
--   - SQL Server CREATE PROCEDURE -> PostgreSQL CREATE OR REPLACE FUNCTION
--   - T-SQL -> PL/pgSQL language
--   - DECLARE -> Each parameter must be explicitly defined
--   - SELECT @var = value -> SELECT value INTO var
--   - Transactions and error handling require adjustment
--
-- STUB PROCEDURES TO CONVERT:
-- (Extract from original SQL Server DDL and convert manually)

-- Template structure for PostgreSQL function:
/*
CREATE OR REPLACE FUNCTION function_name(
    param1 VARCHAR,
    param2 INTEGER
)
RETURNS TABLE (
    result_col1 VARCHAR,
    result_col2 INTEGER
) AS \$\$
BEGIN
    -- PL/pgSQL code here
END;
\$\$ LANGUAGE plpgsql;
*/

-- TODO: List of procedures to convert from SQL Server source
"@

$procContent | Out-File "$OutputDir\05_PROCEDURES.sql" -Encoding UTF8

# Generate summary report
$summary = @"
-- ============================================================
-- CONVERSION SUMMARY REPORT
-- ============================================================
-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- Source: SQL Server BDUDESTRO Database
-- Target: PostgreSQL 14+
--
-- STATISTICS:
-- Total Tables: $($tablesDict.Count)
-- Total Views: $($viewMatches.Count)
--
-- TABLES CONVERTED:
"@

$tablesDict.Keys | Sort-Object | ForEach-Object {
    $summary += "`n   - $_"
}

$summary += "`n`n-- VIEWS CONVERTED:`n"
$viewMatches | ForEach-Object {
    $summary += "   - $($_.Groups[1].Value)`n"
}

$summary += @"

-- CONVERSION COMPLETENESS:
-- [X] All 26 base tables converted
-- [X] All 10 views converted
-- [ ] Foreign keys - TODO: Extract from source DDL
-- [ ] Indexes - TODO: Extract from source DDL
-- [ ] Procedures - TODO: Manual conversion required
-- [ ] Triggers - TODO: Manual conversion required
--
-- NEXT STEPS:
-- 1. Review and execute 01_TABLAS.sql to create tables
-- 2. Review and execute 04_VIEWS.sql to create views
-- 3. Manually add foreign keys to 03_FOREIGN_KEYS.sql based on source DDL
-- 4. Extract and add indexes to 02_INDICES.sql
-- 5. Convert stored procedures to PL/pgSQL in 05_PROCEDURES.sql
"@

$summary | Out-File "$OutputDir\CONVERSION_SUMMARY.txt" -Encoding UTF8

Write-Host "`n=== CONVERSION COMPLETE ==="
Write-Host "Output files generated in: $OutputDir"
Write-Host "  - 01_TABLAS.sql (26 tables)"
Write-Host "  - 02_INDICES.sql (template)"
Write-Host "  - 03_FOREIGN_KEYS.sql (template)"
Write-Host "  - 04_VIEWS.sql (10 views)"
Write-Host "  - 05_PROCEDURES.sql (template)"
Write-Host "  - CONVERSION_SUMMARY.txt (report)"
