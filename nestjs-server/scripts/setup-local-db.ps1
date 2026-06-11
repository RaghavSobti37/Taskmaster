# Creates local Postgres database from DATABASE_URL in nestjs-server/.env (or .env.example).
# Requires psql on PATH (PostgreSQL client).

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Resolve-Path (Join-Path $scriptDir "..")
$envFile = Join-Path $serverRoot ".env"
if (-not (Test-Path $envFile)) {
  $envFile = Join-Path $serverRoot ".env.example"
}

$databaseUrl = $null
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
    $databaseUrl = $matches[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $databaseUrl) {
  Write-Error "DATABASE_URL not found in $envFile"
  exit 1
}

if ($databaseUrl -notmatch '^postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?/]+)') {
  Write-Error "Cannot parse DATABASE_URL (expected postgresql://user:pass@host:port/dbname): $databaseUrl"
  exit 1
}

$user = $matches[1]
$pass = $matches[2]
$pgHost = $matches[3]
$port = $matches[4]
$dbName = $matches[5]

$env:PGPASSWORD = $pass

$exists = & psql -h $pgHost -p $port -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
if ($exists -eq "1") {
  Write-Host "Database '$dbName' already exists."
} else {
  & psql -h $pgHost -p $port -U $user -d postgres -c "CREATE DATABASE `"$dbName`";"
  Write-Host "Created database '$dbName'."
}

Write-Host "Next: cd nestjs-server && npx prisma db push"
