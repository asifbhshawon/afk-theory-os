# PowerShell Backup Script for AFK THEORY Business OS
# Usage: .\scripts\backup.ps1 [-Destination "./backups"] [-Password "secret"] [-KeepCount 7]

param(
    [string]$Destination = "./backups",
    [string]$Password = $env:RESTIC_PASSWORD,
    [int]$KeepCount = 7
)

if (-not $Password) {
    $Password = "afk-theory-secure-local-backup-key-2026"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Authenticated Backup" -ForegroundColor Cyan
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
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupName = "AFK-BACKUP-$timestamp"
$backupDir = Join-Path $Destination $backupName

Write-Host "Destination:      $backupDir" -ForegroundColor Yellow

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$rawDumpFile = Join-Path $backupDir "database.sql"
$encDumpFile = Join-Path $backupDir "database.sql.enc"

Write-Host "`n[1/4] Exporting PostgreSQL logical dump..." -ForegroundColor Yellow
docker exec $container pg_dump -U postgres afk_business_os > "$rawDumpFile"
if ($LASTEXITCODE -ne 0) {
    Write-Error "PostgreSQL logical export failed."
    exit 1
}

$dumpSize = (Get-Item $rawDumpFile).Length
$rawHash = (Get-FileHash -Path $rawDumpFile -Algorithm SHA256).Hash
Write-Host "[OK] Database dump created: $([math]::Round($dumpSize / 1KB, 2)) KB (SHA256: $($rawHash.Substring(0, 12))...)" -ForegroundColor Green

# 2. Encrypt database dump using AES-256-GCM Authenticated Encryption via Node helper
Write-Host "`n[2/4] Applying AES-256-GCM authenticated encryption..." -ForegroundColor Yellow
$cryptoScript = Join-Path $PSScriptRoot "backup-crypto.js"
$encMetaJson = node "$cryptoScript" encrypt "$rawDumpFile" "$Password" "$encDumpFile"
if ($LASTEXITCODE -ne 0) {
    Write-Error "AES-256-GCM encryption failed."
    exit 1
}
$encMeta = $encMetaJson | ConvertFrom-Json
Write-Host "[OK] Dump encrypted with AES-256-GCM (AuthTag: $($encMeta.authTag.Substring(0, 12))...)" -ForegroundColor Green

# 3. Archive documents/attachments
Write-Host "`n[3/4] Archiving local documents and uploads..." -ForegroundColor Yellow
$docDir = Join-Path $backupDir "documents"
New-Item -ItemType Directory -Path $docDir -Force | Out-Null
$docCount = 0
if (Test-Path "./storage") {
    $files = Get-ChildItem -File "./storage"
    $docCount = $files.Count
    Copy-Item "./storage/*" -Destination $docDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "[OK] Documents directory archived ($docCount files)" -ForegroundColor Green

# 4. Create SHA256 + Encryption Manifest
Write-Host "`n[4/4] Generating authenticated integrity manifest..." -ForegroundColor Yellow

$manifest = @{
    backupId = $backupName
    timestamp = (Get-Date).ToString("o")
    business = "AFK THEORY"
    version = "1.0"
    database = @{
        file = "database.sql.enc"
        originalSizeBytes = $dumpSize
        encryptedSizeBytes = $encMeta.encSize
        originalSha256 = $rawHash
    }
    encryption = @{
        algorithm = "aes-256-gcm"
        salt = $encMeta.salt
        iv = $encMeta.iv
        authTag = $encMeta.authTag
        authenticated = $true
    }
    documentCount = $docCount
    container = $container
} | ConvertTo-Json -Depth 5

$manifestFile = Join-Path $backupDir "manifest.json"
[System.IO.File]::WriteAllText($manifestFile, $manifest, [System.Text.UTF8Encoding]::new($false))
Write-Host "[OK] Manifest generated: $manifestFile" -ForegroundColor Green

# 5. Rotate backups keeping latest $KeepCount
$existingBackups = Get-ChildItem -Directory $Destination | Where-Object { $_.Name -like "AFK-BACKUP-*" } | Sort-Object CreationTime -Descending
if ($existingBackups.Count -gt $KeepCount) {
    $toDelete = $existingBackups | Select-Object -Skip $KeepCount
    foreach ($old in $toDelete) {
        Remove-Item $old.FullName -Recurse -Force
        Write-Host "  Rotated old backup: $($old.Name)" -ForegroundColor DarkGray
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Authenticated backup successful: $backupDir" -ForegroundColor Green
Write-Host " Verify with: .\scripts\verify-backup.ps1 -BackupPath `"$backupDir`"" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
