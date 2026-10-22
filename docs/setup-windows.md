# Windows 11 Local Deployment Guide — AFK THEORY Business OS

This guide details the complete local deployment process on a host Windows 11 machine using Docker Desktop or native Node.js.

---

## 1. Prerequisites

- **Windows 11 (64-bit)** with WSL2 enabled.
- **Docker Desktop for Windows** (v4.30+).
- **Node.js** v20+ or v24+ (if running without Docker).
- **PowerShell 7** or built-in Windows PowerShell (Run as Administrator for initial setup if required).

---

## 2. Fast Setup with PowerShell

Open PowerShell in the project root: `C:\Users\User\Documents\Shawon\afk-business-os`

```powershell
# 1. Run the automated setup script
.\scripts\setup.ps1
```

This automated script performs:
1. Verifies Node.js and Docker availability.
2. Creates `.env` configuration from `.env.example`.
3. Runs database migrations (`drizzle-kit migrate`) against PostgreSQL.
4. Provisions the 5 founding partners (Shawon, Rafi, Tousif, Midhat, Mueid with 20% initial ownership) and the full Chart of Accounts.

---

## 3. Starting the Application

You can start the application either via Docker Compose or in standalone local development mode:

### Option A: Docker Compose (Production Mode)
```powershell
.\scripts\start.ps1
```
*The stack builds and runs the standalone Next.js container connected to PostgreSQL. Open browser at: `http://localhost:3000`*

### Option B: Local Node.js Mode
```powershell
.\scripts\start.ps1 -Dev
# or
pnpm start
```

---

## 4. Checking System Health & Status

```powershell
.\scripts\status.ps1
```
Reports Docker container states and tests `http://localhost:3000/api/health`.

---

## 5. Safe Shutdown (Volume Protection)

```powershell
.\scripts\stop.ps1
```
*Note: This runs `docker compose down` without the `-v` flag, strictly preserving all database volumes and local documents.*

---

## 6. Running Acceptance Tests

```powershell
.\scripts\test.ps1
```
Executes all 16 acceptance test scenarios covering multi-partner governance, double-entry accounting invariants, 3 manufacturing routes, inventory concurrency, courier COD settlement, and period closing.
