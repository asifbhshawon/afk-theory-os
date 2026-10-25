# PowerShell Safe Incremental Synchronization Script
# AFK THEORY Business OS <-> Vercel Partner Portal
# Usage:
#   .\scripts\safe-sync-portal.ps1 -PortalUrl "https://partner.afktheory.com" -SyncSecret "your-secret"
#   .\scripts\safe-sync-portal.ps1 -Direction Both

param(
    [Parameter(Mandatory = $false)]
    [string]$PortalUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$SyncSecret = "",

    [Parameter(Mandatory = $false)]
    [ValidateSet("Push", "Pull", "Both")]
    [string]$Direction = "Both"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AFK THEORY — Safe Incremental Portal Synchronization" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve Portal URL & Secret from environment if omitted
if (-not $PortalUrl) {
    if ($env:PARTNER_PORTAL_URL) {
        $PortalUrl = $env:PARTNER_PORTAL_URL
    } else {
        $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
        if (Test-Path $envFile) {
            $matched = Get-Content $envFile | Where-Object { $_ -match "^PARTNER_PORTAL_URL=(.+)$" } | Select-Object -First 1
            if ($matched) { $PortalUrl = ($matched -split "=", 2)[1].Trim().Trim('"').Trim("'") }
        }
    }
}

if (-not $PortalUrl) {
    $PortalUrl = "http://localhost:3001"
}

if (-not $SyncSecret) {
    if ($env:SYNC_SHARED_SECRET) {
        $SyncSecret = $env:SYNC_SHARED_SECRET
    } else {
        $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
        if (Test-Path $envFile) {
            $matched = Get-Content $envFile | Where-Object { $_ -match "^SYNC_SHARED_SECRET=(.+)$" } | Select-Object -First 1
            if ($matched) { $SyncSecret = ($matched -split "=", 2)[1].Trim().Trim('"').Trim("'") }
        }
    }
}

if (-not $SyncSecret) {
    $SyncSecret = "afk-theory-partner-portal-sync-secret-key-2026"
}

Write-Host "Target Portal URL:  $PortalUrl" -ForegroundColor Yellow
Write-Host "Sync Mode:          $Direction" -ForegroundColor Yellow
Write-Host "Safe Architecture:  Zero destructive dumps; Idempotent incremental sync." -ForegroundColor Green

# 2. Execute via tsx script
$tsScript = Join-Path $PSScriptRoot "sync-portal-runner.ts"

if (-not (Test-Path $tsScript)) {
    # Generate standalone runner script
    $runnerContent = @"
import { pushSummaryToCloudPortal, pullCloudCalendarToLocal } from '../src/server/services/portal-sync';

async function main() {
  const portalUrl = process.env.PARTNER_PORTAL_URL || '$PortalUrl';
  const syncSecret = process.env.SYNC_SHARED_SECRET || '$SyncSecret';
  const direction = process.env.SYNC_DIRECTION || '$Direction';

  console.log('[Runner] Connecting to Partner Portal at', portalUrl);

  if (direction === 'Push' || direction === 'Both') {
    console.log('[1/2] Compiling sanitized business summary from local PostgreSQL...');
    const pushRes = await pushSummaryToCloudPortal(portalUrl, syncSecret);
    console.log('[OK] Push completed successfully! Timestamp:', pushRes.timestamp);
    console.log('     Payment Accounts:', pushRes.pushedCount.paymentAccounts);
    console.log('     Partner Statements:', pushRes.pushedCount.partnerStatements);
    console.log('     Ventures:', pushRes.pushedCount.ventures);
    console.log('     Manufacturing Batches:', pushRes.pushedCount.batches);
  }

  if (direction === 'Pull' || direction === 'Both') {
    console.log('[2/2] Fetching incremental cloud calendar notes and tasks...');
    const pullRes = await pullCloudCalendarToLocal(portalUrl, syncSecret);
    console.log('[OK] Pull completed successfully! Imported notes/tasks:', pullRes.importedCount);
  }

  console.log('\n[SUCCESS] Continuous synchronization complete without data loss.');
}

main().catch((err) => {
  console.error('[Sync Error]', err);
  process.exit(1);
});
"@
    Set-Content -Path $tsScript -Value $runnerContent -Encoding UTF8
}

# Run runner with tsx
$env:PARTNER_PORTAL_URL = $PortalUrl
$env:SYNC_SHARED_SECRET = $SyncSecret
$env:SYNC_DIRECTION = $Direction

pnpm tsx $tsScript

if ($LASTEXITCODE -ne 0) {
    Write-Error "Synchronization runner failed. Check portal connectivity."
    exit 1
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] Safe Portal Synchronization Finished!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
