# AFK THEORY — Partner Portal (Vercel Pro)

The **AFK THEORY Partner Portal** is a lightweight, online Next.js web application designed for deployment on **Vercel Pro** at `partner.afktheory.com`.

It provides executive business summaries, venture performance indicators, personally scoped equity positions, and a shared calendar for the five founding partners (**Shawon**, **Rafi**, **Tousif**, **Midhat**, and **Mueid**) without exposing unrestricted database access to the authoritative local-first ERP running in Docker.

---

## 1. Quick Start (Local Development)

```bash
# Run partner portal locally on port 3001
pnpm --filter @afk/partner-portal dev
```

Visit [http://localhost:3001](http://localhost:3001).

---

## 2. Founding Partner Authentication

Five verified founding partner identities are seeded:

| Partner | Email | Initial Password | Role | Permitted Ventures |
| :--- | :--- | :--- | :--- | :--- |
| **Shawon** | `shawon@afktheory.com` | *(Configured via Vercel env)* | `ADMIN` | All (`*`) |
| **Rafi** | `rafi@afktheory.com` | *(Configured via Vercel env)* | `PARTNER` | `VENT-2026-0001`, `VENT-2026-0002` |
| **Tousif** | `tousif@afktheory.com` | *(Configured via Vercel env)* | `PARTNER` | `VENT-2026-0001` |
| **Midhat** | `midhat@afktheory.com` | *(Configured via Vercel env)* | `PARTNER` | `VENT-2026-0001` |
| **Mueid** | `mueid@afktheory.com` | *(Configured via Vercel env)* | `PARTNER` | `VENT-2026-0002` |

---

## 3. Vercel Pro Deployment Guide

### Step 1: Create a New Project on Vercel
1. Import repository: `https://github.com/asifbhshawon/afk-theory-os`
2. **Framework Preset**: Next.js
3. **Root Directory**: `apps/partner-portal` *(Important: Do NOT deploy from repository root)*

### Step 2: Configure Environment Variables on Vercel
Set the following under **Project Settings -> Environment Variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SUPABASE_DATABASE_URL` | Cloud Postgres connection string | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| `DB_SSL` | Enable SSL for Supabase connection | `true` |
| `SYNC_SHARED_SECRET` | Shared authorization token for sync API | High-entropy 64+ char string |
| `NEXT_PUBLIC_APP_URL` | Public production domain | `https://partner.afktheory.com` |

### Step 3: Production Deployment Checklist
- [x] Root Directory configured as `apps/partner-portal`
- [x] Supabase Session Pooler (port 5432) configured with SSL
- [x] Zero server-only Docker, restic or filesystem dependencies
- [x] Bundled local fonts (Geist + Noto Sans Bengali fallback)
- [x] Preview deployments isolated from production sync secret
- [x] HTTPS enforced via Vercel Edge Network
- [x] Strict security headers configured in `vercel.json`

---

## 4. Safe Incremental Synchronization

Continuous data synchronisation runs without destructive database dumps.

```bash
# Push sanitised summaries from local Business OS to Cloud Portal
.\scripts\safe-sync-portal.ps1 -PortalUrl "https://partner.afktheory.com" -Direction Push

# Pull cloud calendar notes created on portal into local Business OS
.\scripts\safe-sync-portal.ps1 -PortalUrl "https://partner.afktheory.com" -Direction Pull
```
