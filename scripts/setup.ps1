# PowerShell Setup Script for AFK THEORY Business OS
# Usage: .\scripts\setup.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Local Environment Setup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "`n[1/4] Checking prerequisites..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Error "Node.js is not installed. Please install Node.js v20+ to proceed."
    exit 1
}
Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green

$dockerVersion = docker -v 2>$null
if (-not $dockerVersion) {
    Write-Host "[WARN] Docker is not detected in path." -ForegroundColor DarkYellow
} else {
    Write-Host "[OK] Docker: $dockerVersion" -ForegroundColor Green
}

# 2. Check and copy .env
Write-Host "`n[2/4] Verifying environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[OK] Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "[OK] .env file already exists" -ForegroundColor Green
}

# 3. Apply Migrations
Write-Host "`n[3/4] Applying PostgreSQL database migrations..." -ForegroundColor Yellow
pnpm db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database migration failed. Please ensure PostgreSQL is running and accessible."
    exit 1
}
Write-Host "[OK] Database migrations applied successfully" -ForegroundColor Green

# 4. Provision Seed & Partner Accounts
Write-Host "`n[4/4] Provisioning founding partners and chart of accounts..." -ForegroundColor Yellow
pnpm db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Error "System seeding failed."
    exit 1
}
Write-Host "[OK] System seeded with 5 founding partners and chart of accounts" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Setup complete! Start with: .\scripts\start.ps1" -ForegroundColor Green
Write-Host " Web UI available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
