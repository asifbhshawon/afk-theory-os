# PowerShell Migration Script: Push Local AFK Business OS PostgreSQL to Supabase
# Usage: .\scripts\push-to-supabase.ps1 -SupabaseUrl "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

param(
    [Parameter(Mandatory = $true, HelpMessage = "Direct or Pooled Supabase PostgreSQL Connection String")]
    [string]$SupabaseUrl
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -> Supabase Database Migration" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve Local PostgreSQL Container
$container = $env:DB_CONTAINER
if (-not $container) {
    $runningContainers = docker ps --format "{{.Names}}"
    if ($runningContainers -match "afk_business_os_db") {
        $container = "afk_business_os_db"
    } elseif ($runningContainers -match "afk-theory-postgres") {
        $container = "afk-theory-postgres"
    } else {
        $container = "afk_business_os_db"
    }
}

Write-Host "Target Local Container: $container" -ForegroundColor Yellow

$tempDumpFile = Join-Path $PSScriptRoot "temp-supabase-dump.sql"

# 2. Export clean database dump without role/privilege locks
Write-Host "`n[1/3] Exporting clean logical dump from local PostgreSQL..." -ForegroundColor Yellow

docker exec $container pg_dump -U postgres --clean --if-exists --no-owner --no-privileges afk_business_os > "$tempDumpFile"

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempDumpFile)) {
    Write-Error "Failed to export logical dump from container $container."
    exit 1
}

$dumpSize = (Get-Item $tempDumpFile).Length
Write-Host "[OK] Clean dump generated: $([math]::Round($dumpSize / 1KB, 2)) KB" -ForegroundColor Green

# 3. Push dump to Supabase using Docker PostgreSQL client (zero local psql dependency)
Write-Host "`n[2/3] Streaming database schema and records to Supabase..." -ForegroundColor Yellow

$workDir = (Get-Item $PSScriptRoot).FullName
docker run --rm -v "${workDir}:/work" postgres:16-alpine psql "$SupabaseUrl" -f /work/temp-supabase-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Error "Database push to Supabase failed. Please check your Supabase connection string and password."
    if (Test-Path $tempDumpFile) { Remove-Item $tempDumpFile -Force }
    exit 1
}

# 4. Verify Supabase tables
Write-Host "`n[3/3] Verifying migrated tables in Supabase..." -ForegroundColor Yellow

$verifyQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
docker run --rm postgres:16-alpine psql "$SupabaseUrl" -t -c "$verifyQuery"

# Cleanup temporary dump file
if (Test-Path $tempDumpFile) {
    Remove-Item $tempDumpFile -Force
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] All tables, ledgers, and records pushed to Supabase!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
