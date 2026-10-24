# PowerShell Backup & Sync Script: Push Local AFK Business OS PostgreSQL to Supabase Cloud
# Usage:
#   .\scripts\push-to-supabase.ps1
#   .\scripts\push-to-supabase.ps1 -SupabaseUrl "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

param(
    [Parameter(Mandatory = $false, HelpMessage = "Supabase PostgreSQL Connection String (Session port 5432)")]
    [string]$SupabaseUrl = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -> Supabase Cloud Backup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve Supabase Connection String
if (-not $SupabaseUrl) {
    if ($env:SUPABASE_BACKUP_URL) {
        $SupabaseUrl = $env:SUPABASE_BACKUP_URL
    } elseif ($env:SUPABASE_DATABASE_URL) {
        $SupabaseUrl = $env:SUPABASE_DATABASE_URL
    } else {
        $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
        if (Test-Path $envFile) {
            $matched = Get-Content $envFile | Where-Object { $_ -match "^SUPABASE_BACKUP_URL=(.+)$" -or $_ -match "^SUPABASE_DATABASE_URL=(.+)$" } | Select-Object -First 1
            if ($matched) {
                $SupabaseUrl = ($matched -split "=", 2)[1].Trim().Trim('"').Trim("'")
            }
        }
    }
}

if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "Please enter your Supabase connection string"
}

if (-not $SupabaseUrl) {
    Write-Error "Supabase URL is required to perform the cloud backup."
    exit 1
}

# 2. Resolve Local PostgreSQL Container
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

# 3. Export clean database dump without role/privilege locks (UTF-8 direct copy)
Write-Host "`n[1/3] Exporting clean logical dump from local PostgreSQL..." -ForegroundColor Yellow

$containerDumpPath = "/tmp/supabase-dump.sql"
docker exec $container pg_dump -U postgres --clean --if-exists --no-owner --no-privileges -f $containerDumpPath afk_business_os

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to export logical dump inside container $container."
    exit 1
}

# Copy raw UTF-8 binary dump directly to avoid Windows encoding issues
docker cp "${container}:${containerDumpPath}" "$tempDumpFile"
docker exec $container rm -f $containerDumpPath

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempDumpFile)) {
    Write-Error "Failed to copy logical dump from container $container."
    exit 1
}

$dumpSize = (Get-Item $tempDumpFile).Length
Write-Host "[OK] Clean UTF-8 dump generated: $([math]::Round($dumpSize / 1KB, 2)) KB" -ForegroundColor Green

# 4. Push dump to Supabase using Docker PostgreSQL client (zero local psql dependency)
Write-Host "`n[2/3] Streaming database schema and records to Supabase Cloud..." -ForegroundColor Yellow

$workDir = (Get-Item $PSScriptRoot).FullName
docker run --rm -v "${workDir}:/work" postgres:16-alpine psql "$SupabaseUrl" -f /work/temp-supabase-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Error "Database push to Supabase failed. Please check your Supabase connection string and password."
    if (Test-Path $tempDumpFile) { Remove-Item $tempDumpFile -Force }
    exit 1
}

# 5. Verify Supabase tables and statistics
Write-Host "`n[3/3] Verifying cloud backup tables and records in Supabase..." -ForegroundColor Yellow

$verifyQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
$tableCount = docker run --rm postgres:16-alpine psql "$SupabaseUrl" -t -c "$verifyQuery"

$accQuery = "SELECT count(*) FROM accounts;"
$accCount = docker run --rm postgres:16-alpine psql "$SupabaseUrl" -t -c "$accQuery"

# Cleanup temporary dump file
if (Test-Path $tempDumpFile) {
    Remove-Item $tempDumpFile -Force
}

$now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] Cloud Backup to Supabase Completed Successfully!" -ForegroundColor Green
Write-Host " Timestamp:       $now" -ForegroundColor Gray
Write-Host " Tables Backed Up: $($tableCount.Trim())" -ForegroundColor Green
Write-Host " Chart of Accounts: $($accCount.Trim()) records" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
