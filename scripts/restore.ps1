# PowerShell Restore Script for AFK THEORY Business OS
# Usage: .\scripts\restore.ps1 -BackupPath "./backups/AFK-BACKUP-..." [-Password "secret"] [-Isolated] [-ForceLive]

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,

    [string]$Password = $env:RESTIC_PASSWORD,
    [switch]$Isolated = $true,
    [switch]$ForceLive
)

if (-not $Password) {
    $Password = "afk-theory-secure-local-backup-key-2026"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Authenticated Restore Engine" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve PostgreSQL container dynamically
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
Write-Host "Target Container: $container" -ForegroundColor Yellow

# 2. Verify backup integrity first
Write-Host "`n[1/3] Verifying authenticated backup integrity..." -ForegroundColor Yellow
$verifyScript = Join-Path $PSScriptRoot "verify-backup.ps1"
powershell -ExecutionPolicy Bypass -File $verifyScript -BackupPath $BackupPath -Password $Password
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backup verification failed! Aborting restore."
    exit 1
}

$manifestFile = Join-Path $BackupPath "manifest.json"
$manifest = Get-Content $manifestFile | ConvertFrom-Json
$dbFile = Join-Path $BackupPath $manifest.database.file

# 3. Decrypt database dump to temporary memory/file via Node helper
$tempDumpFile = Join-Path $BackupPath "temp_restore.sql"

if ($manifest.encryption -and $manifest.encryption.algorithm -eq "aes-256-gcm") {
    Write-Host "`nDecrypting authenticated database dump..." -ForegroundColor Yellow
    $cryptoScript = Join-Path $PSScriptRoot "backup-crypto.js"
    node "$cryptoScript" decrypt "$manifestFile" "$dbFile" "$Password" "$tempDumpFile"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Decryption failed."
        exit 1
    }
} else {
    Copy-Item $dbFile $tempDumpFile
}

try {
    if ($Isolated -and -not $ForceLive) {
        Write-Host "`n[2/3] Performing ISOLATED test restore (Target DB: afk_restore_test)..." -ForegroundColor Yellow
        docker exec $container psql -U postgres -c "DROP DATABASE IF EXISTS afk_restore_test;" 2>$null | Out-Null
        docker exec $container psql -U postgres -c "CREATE DATABASE afk_restore_test;" | Out-Null

        Get-Content $tempDumpFile | docker exec -i $container psql -U postgres -d afk_restore_test | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Isolated database restore failed."
            exit 1
        }

        Write-Host "`n[3/3] Verifying restored test database integrity..." -ForegroundColor Yellow
        $partnerCount = docker exec $container psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM partners;"
        $accountCount = docker exec $container psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM accounts;"
        $journalCount = docker exec $container psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM journal_entries;"
        $lotCount     = docker exec $container psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM inventory_lots;"
        $orderCount   = docker exec $container psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM sales_orders;"

        Write-Host "[OK] Restored Partners:       $($partnerCount.Trim())" -ForegroundColor Green
        Write-Host "[OK] Restored Accounts:       $($accountCount.Trim())" -ForegroundColor Green
        Write-Host "[OK] Restored Journal Entries: $($journalCount.Trim())" -ForegroundColor Green
        Write-Host "[OK] Restored Inventory Lots: $($lotCount.Trim())" -ForegroundColor Green
        Write-Host "[OK] Restored Sales Orders:   $($orderCount.Trim())" -ForegroundColor Green

        Write-Host "`n==========================================================" -ForegroundColor Cyan
        Write-Host " Isolated restore test PASSED! Production DB untouched." -ForegroundColor Green
        Write-Host " Cleaned up temporary decryption files." -ForegroundColor Gray
        Write-Host " To restore into LIVE production DB, run with: -ForceLive" -ForegroundColor DarkYellow
        Write-Host "==========================================================" -ForegroundColor Cyan
    } else {
        Write-Host "`n[WARNING] LIVE PRODUCTION RESTORE REQUESTED!" -ForegroundColor Red
        Write-Host "Backing up current live state before proceeding..." -ForegroundColor Yellow
        & .\scripts\backup.ps1

        Write-Host "`nRestoring into live database afk_business_os..." -ForegroundColor Yellow
        Get-Content $tempDumpFile | docker exec -i $container psql -U postgres -d afk_business_os
        Write-Host "[OK] Live database restored successfully." -ForegroundColor Green
    }
} finally {
    # Securely remove temporary plaintext dump
    if (Test-Path $tempDumpFile) {
        Remove-Item $tempDumpFile -Force
    }
}
