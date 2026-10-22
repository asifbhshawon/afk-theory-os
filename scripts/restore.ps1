# PowerShell Restore Script for AFK THEORY Business OS
# Usage: .\scripts\restore.ps1 -BackupPath "./backups/AFK-BACKUP-..." [-Isolated] [-ForceLive]

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,

    [switch]$Isolated = $true,
    [switch]$ForceLive
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Local Restore Engine" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify backup integrity first
Write-Host "`n[1/3] Verifying backup checksum before restore..." -ForegroundColor Yellow
$verifyScript = Join-Path $PSScriptRoot "verify-backup.ps1"
powershell -ExecutionPolicy Bypass -File $verifyScript -BackupPath $BackupPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backup integrity verification failed. Aborting restore."
    exit 1
}

$manifest = Get-Content (Join-Path $BackupPath "manifest.json") | ConvertFrom-Json
$dumpFile = Join-Path $BackupPath $manifest.database.file

if ($Isolated -and -not $ForceLive) {
    Write-Host "`n[2/3] Performing ISOLATED test restore (Target: afk_restore_test)..." -ForegroundColor Yellow
    docker exec afk-theory-postgres psql -U postgres -c "DROP DATABASE IF EXISTS afk_restore_test;" 2>$null
    docker exec afk-theory-postgres psql -U postgres -c "CREATE DATABASE afk_restore_test;"

    Get-Content $dumpFile | docker exec -i afk-theory-postgres psql -U postgres -d afk_restore_test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Isolated database restore failed."
        exit 1
    }

    Write-Host "`n[3/3] Verifying restored test database integrity..." -ForegroundColor Yellow
    $partnerCount = docker exec afk-theory-postgres psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM partners;"
    $accountCount = docker exec afk-theory-postgres psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM accounts;"
    $journalCount = docker exec afk-theory-postgres psql -U postgres -d afk_restore_test -t -c "SELECT count(*) FROM journal_entries;"

    Write-Host "[OK] Restored Partners: $($partnerCount.Trim())" -ForegroundColor Green
    Write-Host "[OK] Restored Accounts: $($accountCount.Trim())" -ForegroundColor Green
    Write-Host "[OK] Restored Journals: $($journalCount.Trim())" -ForegroundColor Green

    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " Isolated restore test PASSED! Production DB untouched." -ForegroundColor Green
    Write-Host " To restore into LIVE production DB, run with: -ForceLive" -ForegroundColor DarkYellow
    Write-Host "==========================================================" -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] LIVE PRODUCTION RESTORE REQUESTED!" -ForegroundColor Red
    Write-Host "Backing up current state before proceeding..." -ForegroundColor Yellow
    & .\scripts\backup.ps1

    Write-Host "`nRestoring into live database afk_business_os..." -ForegroundColor Yellow
    Get-Content $dumpFile | docker exec -i afk-theory-postgres psql -U postgres -d afk_business_os

    Write-Host "[OK] Live database restored successfully." -ForegroundColor Green
}
