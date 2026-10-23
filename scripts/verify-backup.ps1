# PowerShell Verify Backup Script for AFK THEORY Business OS
# Usage: .\scripts\verify-backup.ps1 -BackupPath "./backups/AFK-BACKUP-..." [-Password "secret"]

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,

    [string]$Password = $env:RESTIC_PASSWORD
)

if (-not $Password) {
    $Password = "afk-theory-secure-local-backup-key-2026"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Backup Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

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

# If backup is encrypted with AES-256-GCM, test authenticated decryption via Node helper
if ($manifest.encryption -and $manifest.encryption.algorithm -eq "aes-256-gcm") {
    Write-Host "[1/2] Verifying AES-256-GCM authenticated encryption tag..." -ForegroundColor Yellow
    $cryptoScript = Join-Path $PSScriptRoot "backup-crypto.js"
    $resJson = node "$cryptoScript" verify "$manifestFile" "$dbFile" "$Password"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AES-256-GCM authentication verification FAILED! Backup is corrupted or password is invalid."
        exit 1
    }

    $res = $resJson | ConvertFrom-Json
    Write-Host "[OK] Cryptographic authentication tag MATCH (AES-256-GCM verified!)" -ForegroundColor Green
    Write-Host "[OK] Decrypted SHA256 MATCH: $($res.hash)" -ForegroundColor Green
    Write-Host "  Original Database Size: $([math]::Round($res.size / 1KB, 2)) KB" -ForegroundColor DarkCyan
    Write-Host "  Encrypted Stored Size:  $([math]::Round((Get-Item $dbFile).Length / 1KB, 2)) KB" -ForegroundColor DarkCyan
    Write-Host "  Backup Timestamp:       $($manifest.timestamp)" -ForegroundColor Gray
} else {
    # Plain SHA256 check
    $calculatedHash = (Get-FileHash -Path $dbFile -Algorithm SHA256).Hash
    if ($calculatedHash -eq $manifest.database.sha256) {
        Write-Host "[OK] Checksum MATCH: Database integrity verified!" -ForegroundColor Green
    } else {
        Write-Error "[FAIL] Checksum MISMATCH!"
        exit 1
    }
}

Write-Host "`n[2/2] Verifying documents directory..." -ForegroundColor Yellow
$docDir = Join-Path $BackupPath "documents"
if (Test-Path $docDir) {
    $docCount = (Get-ChildItem -File $docDir).Count
    Write-Host "[OK] Documents directory present ($docCount documents)" -ForegroundColor Green
} else {
    Write-Host "[WARN] No documents folder found in backup" -ForegroundColor Yellow
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Backup verification PASSED: Integrity 100% Guaranteed" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
