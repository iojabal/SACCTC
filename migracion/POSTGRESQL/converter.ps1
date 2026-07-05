# SQL Server to PostgreSQL DDL Converter
# This script converts the entire DDL from SQL Server to PostgreSQL 14+

$inputFile = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL\temp_converted.sql"
$outputDir = "C:\Users\M S I\Documents\UDESTRO\migracion\POSTGRESQL"

# Read the entire SQL content
$sqlContent = Get-Content -Path $inputFile -Raw

# Arrays to store different SQL objects
$tables = @()
$views = @()
$foreignKeys = @()
$indexes = @()

# Split by GO statements to get individual statements
$statements = $sqlContent -split '(?m)^GO\s*$'

foreach ($stmt in $statements) {
    $stmt = $stmt.Trim()
    
    if ($stmt -match 'CREATE TABLE') {
        $tables += $stmt
    }
    elseif ($stmt -match 'CREATE VIEW') {
        $views += $stmt
    }
    elseif ($stmt -match 'CREATE.*INDEX') {
        $indexes += $stmt
    }
}

Write-Host "Parsed:"
Write-Host "  Tables: $($tables.Count)"
Write-Host "  Views: $($views.Count)"
Write-Host "  Indexes/FKs: $($indexes.Count)"

# Save raw parsed data
$tables | ForEach-Object { $_ } | Out-File "$outputDir\raw_tables.txt" -Encoding UTF8
$views | ForEach-Object { $_ } | Out-File "$outputDir\raw_views.txt" -Encoding UTF8
