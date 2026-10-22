# PowerShell Test Script for AFK THEORY Business OS
# Usage: .\scripts\test.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY Business OS -- Test Suite Execution" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

pnpm test

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] All acceptance tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[FAIL] Some tests failed. Review output above." -ForegroundColor Red
}
