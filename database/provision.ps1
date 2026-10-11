param(
  [Parameter(Mandatory = $true)][string]$AdminRole,
  [Parameter(Mandatory = $true)][string]$MigrationRole
)

$ErrorActionPreference = 'Stop'
foreach ($name in 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD') {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "$name must be provided explicitly." }
}
if ($env:PGUSER -ne $AdminRole) { throw 'PGUSER must match the explicitly supplied cluster administrator role.' }
if ($AdminRole -eq 'progress_tracker_electron_app' -or $MigrationRole -eq 'progress_tracker_electron_app') {
  throw 'Administrative, migration, and application roles must remain distinct.'
}

$psql = (Get-Command psql -ErrorAction Stop).Source
$baseDsn = "host=$env:PGHOST port=$env:PGPORT user=$env:PGUSER password=$env:PGPASSWORD"
$probe = & $psql -X -w -d "$baseDsn dbname=postgres" -Atc "SELECT current_user, current_database(); SELECT datname || ':' || pg_get_userbyid(datdba) FROM pg_database WHERE datname='progress_tracker_electron'; SELECT rolname FROM pg_roles WHERE rolname IN ('progress_tracker_electron_app', '$MigrationRole') ORDER BY rolname"
if ($LASTEXITCODE -ne 0) { throw 'Administrator connection failed.' }
Write-Output $probe
Write-Output 'Review existing owners above. This script refuses to change ownership or modify an existing app role password.'
Write-Output 'Create missing migration/app roles and database through the approved cluster provisioning process; then run database/migrations/apply.mjs as the database owner.'
