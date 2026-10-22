# PowerShell Verify Backup Script for AFK THEORY Business OS
# Usage: .\scripts\verify-backup.ps1 -BackupPath "./backups/AFK-BACKUP-..."

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath
)

Write-Host "Verifying backup: $BackupPath..." -ForegroundColor Cyan

if (-not (Test-Path $BackupPath)) {
    Write-Error "Backup directory does not exist: $BackupPath"
    exit 1
}

$manifestFile = Join-Path $BackupPath "manifest.json"
if (-not (Test-Path $manifestFile)) {
    Write-Error "manifest.json is missing!"
    exit 1
}

$manifest = Get-Content $manifestFile | ConvertFrom-Json
$dbFile = Join-Path $BackupPath $manifest.database.file

if (-not (Test-Path $dbFile)) {
    Write-Error "Database dump file is missing: $dbFile"
    exit 1
}

$calculatedHash = (Get-FileHash -Path $dbFile -Algorithm SHA256).Hash

if ($calculatedHash -eq $manifest.database.sha256) {
    Write-Host "[OK] Checksum MATCH: Database integrity verified!" -ForegroundColor Green
    Write-Host "  SHA256: $calculatedHash" -ForegroundColor DarkCyan
    Write-Host "  Size: $([math]::Round($manifest.database.sizeBytes / 1KB, 2)) KB" -ForegroundColor Green
    Write-Host "  Timestamp: $($manifest.timestamp)" -ForegroundColor Gray
} else {
    Write-Error "[FAIL] Checksum MISMATCH! Expected: $($manifest.database.sha256), Actual: $calculatedHash"
    exit 1
}
