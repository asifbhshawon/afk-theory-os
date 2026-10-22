# PowerShell Stop Script for AFK THEORY Business OS
# Usage: .\scripts\stop.ps1

Write-Host "Stopping AFK THEORY Business OS services..." -ForegroundColor Cyan
Write-Host "Preserving database volumes and local documents..." -ForegroundColor Yellow

# Safe shutdown: NO -v flag!
docker compose down

Write-Host "[OK] AFK THEORY Business OS stopped safely." -ForegroundColor Green
