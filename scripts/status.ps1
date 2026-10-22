# PowerShell Status Script for AFK THEORY Business OS
# Usage: .\scripts\status.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Service Status" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Docker Containers
Write-Host "`n[Docker Containers]" -ForegroundColor Yellow
docker compose ps

# 2. Check HTTP Health Endpoint
Write-Host "`n[Web Health Check]" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "[OK] Web Service: UP ($($response.status))" -ForegroundColor Green
    Write-Host "  Database: $($response.database) ($($response.databaseName))" -ForegroundColor Green
    Write-Host "  Timestamp: $($response.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] Web Service: NOT RUNNING on http://localhost:3000" -ForegroundColor DarkYellow
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
