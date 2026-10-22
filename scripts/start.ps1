# PowerShell Startup Script for AFK THEORY Business OS
# Usage: .\scripts\start.ps1 [-Dev]

param(
    [switch]$Dev
)

Write-Host "Starting AFK THEORY Business OS..." -ForegroundColor Cyan

if ($Dev) {
    Write-Host "Running in local Next.js development mode (port 3000)..." -ForegroundColor Yellow
    pnpm dev
} else {
    Write-Host "Starting Docker Compose services (safe mode, volumes preserved)..." -ForegroundColor Yellow
    docker compose up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] Services started successfully!" -ForegroundColor Green
        Write-Host "Access the application at: http://localhost:3000" -ForegroundColor Cyan
        docker compose ps
    } else {
        Write-Error "Failed to start Docker Compose services."
    }
}
