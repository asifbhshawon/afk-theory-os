# PowerShell Restore Script: Pull from Supabase Cloud to Local PostgreSQL
# Usage:
#   .\scripts\pull-from-supabase.ps1
#   .\scripts\pull-from-supabase.ps1 -SupabaseUrl "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

param(
    [Parameter(Mandatory = $false, HelpMessage = "Supabase PostgreSQL Connection String (Session port 5432)")]
    [string]$SupabaseUrl = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS <- Supabase Cloud Restore" -ForegroundColor Cyan
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
    Write-Error "Supabase URL is required to pull the cloud backup."
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

$tempDumpFile = Join-Path $PSScriptRoot "temp-supabase-pull.sql"

# 3. Export dump from Supabase Cloud
Write-Host "`n[1/3] Downloading logical database dump from Supabase Cloud..." -ForegroundColor Yellow

$workDir = (Get-Item $PSScriptRoot).FullName
docker run --rm -v "${workDir}:/work" postgres:16-alpine pg_dump "$SupabaseUrl" --clean --if-exists --no-owner --no-privileges -f /work/temp-supabase-pull.sql

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempDumpFile)) {
    Write-Error "Failed to export logical dump from Supabase Cloud."
    if (Test-Path $tempDumpFile) { Remove-Item $tempDumpFile -Force }
    exit 1
}

$dumpSize = (Get-Item $tempDumpFile).Length
Write-Host "[OK] Cloud dump downloaded: $([math]::Round($dumpSize / 1KB, 2)) KB" -ForegroundColor Green

# 4. Restore dump into local PostgreSQL container
Write-Host "`n[2/3] Restoring dump into local PostgreSQL database ($container)..." -ForegroundColor Yellow

$containerDumpPath = "/tmp/supabase-pull.sql"
docker cp "$tempDumpFile" "${container}:${containerDumpPath}"

docker exec $container psql -U postgres -d afk_business_os -f $containerDumpPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Restoring dump into local container $container failed."
    docker exec $container rm -f $containerDumpPath
    if (Test-Path $tempDumpFile) { Remove-Item $tempDumpFile -Force }
    exit 1
}

docker exec $container rm -f $containerDumpPath

# 5. Verify local tables and statistics
Write-Host "`n[3/3] Verifying restored local tables and records..." -ForegroundColor Yellow

$verifyQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
$tableCount = docker exec $container psql -U postgres -d afk_business_os -t -c "$verifyQuery"

$accQuery = "SELECT count(*) FROM accounts;"
$accCount = docker exec $container psql -U postgres -d afk_business_os -t -c "$accQuery"

# Cleanup temporary dump file
if (Test-Path $tempDumpFile) {
    Remove-Item $tempDumpFile -Force
}

$now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] Cloud Restore from Supabase to Local DB Complete!" -ForegroundColor Green
Write-Host " Timestamp:           $now" -ForegroundColor Gray
Write-Host " Tables Restored:     $($tableCount.Trim())" -ForegroundColor Green
Write-Host " Chart of Accounts:   $($accCount.Trim()) records" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
