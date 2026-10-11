param(
  [Parameter(Mandatory = $true)][string]$SourceDatabase,
  [Parameter(Mandatory = $true)][string]$RestoreDatabase,
  [Parameter(Mandatory = $true)][string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
if ($SourceDatabase -notmatch '^[A-Za-z][A-Za-z0-9_]*(?:_dev|_development|_test)$') {
  throw 'Source database must end in _dev, _development, or _test.'
}
if ($RestoreDatabase -notmatch '^[A-Za-z][A-Za-z0-9_]*_test$' -or $RestoreDatabase -eq $SourceDatabase) {
  throw 'Restore target must be a different database ending in _test.'
}
foreach ($name in 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD') {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "$name must be provided explicitly." }
}

$null = New-Item -ItemType Directory -Force -Path $BackupDirectory
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
$dumpPath = Join-Path $BackupDirectory "progress-tracker-$stamp-$suffix.dump"
$manifestPath = "$dumpPath.sha256"
$pgDump = (Get-Command pg_dump -ErrorAction Stop).Source
$pgRestore = (Get-Command pg_restore -ErrorAction Stop).Source
$psql = (Get-Command psql -ErrorAction Stop).Source
$sourceDsn = "host=$env:PGHOST port=$env:PGPORT user=$env:PGUSER sslmode=prefer dbname=$SourceDatabase"
$adminDsn = "host=$env:PGHOST port=$env:PGPORT user=$env:PGUSER sslmode=prefer dbname=postgres"
$restoreDsn = "host=$env:PGHOST port=$env:PGPORT user=$env:PGUSER sslmode=prefer dbname=$RestoreDatabase"

& $pgDump --format=custom --no-owner --no-acl --dbname=$sourceDsn --file=$dumpPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath | ForEach-Object { "$($_.Hash)  $(Split-Path $dumpPath -Leaf)" } | Set-Content -Encoding ascii -LiteralPath $manifestPath
& $pgRestore --list $dumpPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The custom-format archive failed its listing/integrity check.' }

$existing = & $psql -X -w -d $adminDsn -Atc "SELECT 1 FROM pg_database WHERE datname = '$RestoreDatabase'"
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect restore target.' }
if ($existing -eq '1') { throw "Restore target already exists; refusing to overwrite $RestoreDatabase." }
& $psql -X -w -d $adminDsn -c "CREATE DATABASE `"$RestoreDatabase`""
if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated restore target.' }
& $pgRestore --exit-on-error --no-owner --no-acl --dbname=$restoreDsn $dumpPath
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE; isolated target retained for inspection." }

$sourceFingerprint = & $psql -X -w -d $sourceDsn -Atc "SELECT string_agg(format('%s:%s', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text), ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
$restoreFingerprint = & $psql -X -w -d $restoreDsn -Atc "SELECT string_agg(format('%s:%s', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text), ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
if ($LASTEXITCODE -ne 0 -or $sourceFingerprint -ne $restoreFingerprint) {
  throw 'Restored schema table counts differ from source; isolated target retained for inspection.'
}
Write-Output "Backup and isolated restore verified: $dumpPath"
Write-Output "Restore target retained: $RestoreDatabase"
