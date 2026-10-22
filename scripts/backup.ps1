# PowerShell Backup Script for AFK THEORY Business OS
# Usage: .\scripts\backup.ps1 [-Destination "./backups"]

param(
    [string]$Destination = "./backups"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Local Backup Generator" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupName = "AFK-BACKUP-$timestamp"
$backupDir = Join-Path $Destination $backupName

Write-Host "Destination: $backupDir" -ForegroundColor Yellow

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$dumpFile = Join-Path $backupDir "database.sql"
Write-Host "`n[1/3] Exporting PostgreSQL logical dump..." -ForegroundColor Yellow

# Use docker exec to perform logical pg_dump
docker exec afk-theory-postgres pg_dump -U postgres afk_business_os > "$dumpFile"
if ($LASTEXITCODE -ne 0) {
    Write-Error "PostgreSQL logical export failed."
    exit 1
}

$dumpSize = (Get-Item $dumpFile).Length
Write-Host "[OK] Database dump created: $([math]::Round($dumpSize / 1KB, 2)) KB" -ForegroundColor Green

# 2. Archive documents/attachments
Write-Host "`n[2/3] Archiving local documents and uploads..." -ForegroundColor Yellow
$docDir = Join-Path $backupDir "documents"
New-Item -ItemType Directory -Path $docDir -Force | Out-Null
if (Test-Path "./storage") {
    Copy-Item "./storage/*" -Destination $docDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "[OK] Documents directory archived" -ForegroundColor Green

# 3. Create SHA256 checksum manifest
Write-Host "`n[3/3] Generating SHA256 integrity manifest..." -ForegroundColor Yellow
$hash = (Get-FileHash -Path $dumpFile -Algorithm SHA256).Hash

$manifest = @{
    backupId = $backupName
    timestamp = (Get-Date).ToString("o")
    business = "AFK THEORY"
    version = "1.0"
    database = @{
        file = "database.sql"
        sha256 = $hash
        sizeBytes = $dumpSize
    }
} | ConvertTo-Json

$manifestFile = Join-Path $backupDir "manifest.json"
$manifest | Set-Content -Path $manifestFile -Encoding UTF8

Write-Host "[OK] Integrity manifest written: $manifestFile" -ForegroundColor Green
Write-Host "  Database SHA256: $hash" -ForegroundColor DarkCyan

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Backup successful! Stored in: $backupDir" -ForegroundColor Green
Write-Host " Verify with: .\scripts\verify-backup.ps1 -BackupPath `"$backupDir`"" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
