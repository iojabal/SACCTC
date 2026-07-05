# Export todas las tablas BDUDESTRO a CSV con BCP

$server = "192.168.2.111\SQL2017"
$user = "sa"
$password = "KAeeINiyhSTXxngE6GLl"
$database = "BDUDESTRO"
$output_dir = "C:\Users\M S I\Documents\UDESTRO\Exports\Exports"

# Get list of tables
$query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
$sqlCmd = "sqlcmd -S $server -U $user -P $password -d $database -Q `"$query`""
$tables = Invoke-Expression $sqlCmd | Select-Object -Skip 2 | Where-Object {$_ -match '\S'}

Write-Host "[EXPORTACIÓN] Iniciando BCP export..."
Write-Host "Destino: $output_dir`n"

$count = 0
foreach ($table in $tables) {
    $table = $table.Trim()
    if ([string]::IsNullOrWhiteSpace($table)) { continue }

    $csv_file = "$output_dir\$table.csv"

    # BCP command
    $bcp_cmd = "bcp `"SELECT * FROM [$database].dbo.[$table]`" queryout `"$csv_file`" -S $server -U $user -P $password -c -t, -r `n"

    try {
        Invoke-Expression $bcp_cmd | Out-Null
        Write-Host "[OK] $table -> $table.csv"
        $count++
    } catch {
        Write-Host "[ERROR] $table - $_"
    }
}

Write-Host "`n[RESULTADO] $count tablas exportadas a CSV"
Write-Host "[LISTO] Archivos en: $output_dir"
