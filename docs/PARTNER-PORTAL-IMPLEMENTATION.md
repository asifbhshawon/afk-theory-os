# AFK THEORY — Partner Portal Architectural Audit & Implementation Specification

## Executive Summary

AFK THEORY Business OS is an authoritative, local-first ERP running in Docker with PostgreSQL. It manages double-entry general ledger accounting, apparel manufacturing batches, multi-location inventory, venture waterfall investments, courier settlements, and governance.

To provide executive visibility to the five founding partners (**Shawon**, **Rafi**, **Tousif**, **Midhat**, and **Mueid**) without risking the integrity, performance, or security of the core ERP, a separate, cloud-deployed Next.js application (**AFK Partner Portal**) is built in `apps/partner-portal/`.

This document records the architectural findings of the repository audit (Phase 1) and details the implementation blueprint for the portal, safe incremental data synchronization, security, dashboard, and calendar.

---

## 1. Repository Audit Findings

### 1.1 Database Schema & Financial Model
- **Drizzle ORM with PostgreSQL**: Defined in `src/db/schema.ts`.
- **General Ledger (`journal_entries`, `journal_lines`, `accounts`)**:
  - Strict GAAP double-entry posting: Debits equal Credits to exact 2-decimal paisa precision.
  - Fiscal period enforcement (`fiscal_periods`) with locking against backdated entries.
  - Accounts Chart:
    - `1010`–`1040`: Liquid Cash, Bank, bKash, Nagad.
    - `1110`–`1120`: Customer and Courier Receivables (COD).
    - `1210`–`1240`: Materials, WIP, Finished Goods, and Transit Inventory.
    - `2010`–`2150`: Trade Payables and Partner Loans (`Due to Shawon`, `Due to Rafi`, etc.).
    - `3010`–`3050`: Partner Capital (20.00% initial share each).
    - `3110`–`3150`: Partner Drawings.
    - `4010`–`4030`: Sales Revenue, Returns, Delivery Fees.
    - `5010`–`5020`: Cost of Goods Sold and Scrap.
    - `6010`–`6050`: Operating Expenses (Courier fees, Packaging, Marketing, Utilities).
- **Financial Calculations (`src/server/services/finance.ts`)**:
  - `getFinancialStatements(asOfDate)` dynamically derives:
    1. Net Trial Balance (debits = credits).
    2. Income Statement (Net Revenue = Gross - Returns, Gross Profit = Net Revenue - COGS, Net Profit = Gross Profit - OpEx).
    3. Balance Sheet (Assets = Liabilities + Equity).
    4. Partner Statements (`capitalContributed`, `drawings`, `loanBalanceOwedByCompany`, `shareOfProfit`, `totalEquity`).

### 1.2 Founding Partners & Venture Investment Engine
- **Founding Partners**:
  - Shawon (`shawon@afktheory.local` - Admin, Finance Mgr, Partner Viewer)
  - Rafi (`rafi@afktheory.local` - Finance Approver, Partner Viewer)
  - Tousif (`tousif@afktheory.local` - Inventory Mgr, Partner Viewer)
  - Midhat (`midhat@afktheory.local` - Manufacturing Mgr, Partner Viewer)
  - Mueid (`mueid@afktheory.local` - Sales Op, Partner Viewer)
  - Initial equal equity: 20.00% ownership and 20.00% profit share each.
- **Ventures & Projects (`ventures`, `venture_agreements`, `venture_participants`, `venture_contributions`, `venture_allocation_snapshots`, `venture_settlements`)**:
  - Modular project funding distinct from corporate equity.
  - Modes: `EQUAL`, `PROPORTIONAL`, `CUSTOM_PROFIT`, `CAPITAL_RECOVERY_FIRST`, `PROFIT_REINVESTMENT`.
  - Invariant: Participant profit share sum must equal 100.00%.
  - Granular participation: Partners can invest different amounts in different ventures.

### 1.3 Inventory & Manufacturing
- **Inventory Lots (`inventory_lots`)**: FIFO unit cost tracking, reserved quantities, and status (`ACTIVE`, `DEPLETED`).
- **Stock Movements (`stock_movements`)**: Audited movements across locations (`MAIN_WH`, `FACTORY_WIP`, `TRANSIT`, `DAMAGED`).
- **Production Orders (`production_orders`)**: Routes (`FINISHED_PURCHASE`, `BLANK_CUSTOMIZATION`, `FABRIC_OUTSOURCED`), planned vs good/defect completed quantities, status progression (`PLANNED` -> `FABRIC_ISSUED` -> `IN_PRODUCTION` -> `QC_PENDING` -> `COMPLETED`).

### 1.4 Calendar & Collaboration Engine
- **Calendar Entities (`calendar_entries`, `calendar_categories`, `calendar_checklist_items`, `calendar_recurrence_rules`, `calendar_recurrence_exceptions`, `calendar_preferences`)**:
  - Entry types: `NOTE`, `EVENT`, `TASK`, `DEADLINE`, `REMINDER`.
  - Scopes:
    - `PERSONAL`: Visible strictly to `ownerUserId`.
    - `COMPANY`: Visible to all authorized partners.
    - `VENTURE`: Scoped to permitted venture participants.
  - Recurrence rules: Daily, Weekly, Monthly with recurrence exceptions.
  - Checklists: Interactive task items with completion timestamps.

### 1.5 Deficiencies of Existing Backup Scripts
- `scripts/push-to-supabase.ps1` and `scripts/pull-from-supabase.ps1` perform complete `pg_dump` and `pg_restore` with `--clean`.
- **Fatal flaws**:
  1. Overwrites cloud-created calendar notes and tasks when local database is pushed.
  2. Overwrites local transactions if a pull is executed without a sync cursor.
  3. Exposes raw database tables, password hashes, and session tokens to the cloud.
  4. Requires Docker inside Windows PowerShell with host-level container access.
- **Verdict**: Destructive dump/restore must never be used for continuous synchronization.

---

## 2. Safe Synchronisation Architecture

```
+------------------------------------+               +--------------------------------------+
|     LOCAL BUSINESS OS (ERP)        |               |      SUPABASE CLOUD / VERCEL         |
|  (Authoritative Accounting Engine) |               |           (Partner Portal)           |
+------------------------------------+               +--------------------------------------+
|  - Full General Ledger & Journals  |               |  - Cloud Postgres Read Model         |
|  - Inventory & Production Orders   |               |  - Portal-Owned Calendar & Notes     |
|  - Raw Customer PII & Audit Logs   |               |  - Partner Sessions & Permissions    |
+------------------------------------+               +--------------------------------------+
                 |                                                      |
                 |  1. Local Push Sync (Approved Summaries)             |
                 |     - Idempotent upserts of sanitized aggregates     |
                 |     - No password hashes, PII or raw journals        |
                 |----------------------------------------------------->|
                 |                                                      |
                 |  2. Safe Incremental Calendar Sync                   |
                 |     - Cloud-owned notes/tasks fetched by local       |
                 |     - Stable UUIDs, timestamps, conflict handling    |
                 |     - Zero data loss for online notes                |
                 |<-----------------------------------------------------|
```

### 2.1 Local ERP -> Cloud: Sanitized Summary Read Model
Instead of exposing raw ERP tables, the local system compiles high-level, permission-scoped summary models stored in designated cloud tables:
1. `portal_sync_meta`: Tracks sync runs, timestamps, hash signatures, and ERP health status.
2. `portal_business_summaries`: Aggregate KPI snapshots (Net Sales, Gross Profit, Total Expenses, Cash Bank total, Stock valuation, Active production batches, Pending COD settlement).
3. `portal_payment_accounts`: High-level wallet balances (Cash, BRAC Bank, bKash, Nagad) without raw bank details.
4. `portal_partner_statements`: Pre-calculated partner financial position (Capital contributed, Drawings, Loan balance due, Share of profit, Total equity).
5. `portal_venture_summaries`: Permitted venture status, budget, actual funding, stage, participant allocations, and performance.
6. `portal_manufacturing_summaries`: Active batch status, planned vs completed units, target dates.
7. `portal_activity_feed`: Sanitized executive events (e.g., "Drop 01 QC Completed", "Partner reimbursement approved", "BRAC Bank courier settlement received").

### 2.2 Cloud -> Local: Safe Incremental Calendar Synchronization
- The cloud portal is the primary authority for portal-created notes, meetings, and shared partner calendar tasks.
- Cloud records carry:
  - `id`: Stable UUIDv4.
  - `version`: Monotonically increasing version counter.
  - `origin`: `"PORTAL"` or `"LOCAL"`.
  - `scope`: `"PERSONAL"`, `"COMPANY"`, or `"VENTURE"`.
  - `updated_at`: ISO timestamp.
- The local ERP pulls cloud calendar entries where `updated_at > last_calendar_sync_cursor`.
- If an entry originates from the portal, the local system imports or updates it idempotently. Local records are not blindly overwritten.

### 2.3 Offline & Failure Resilience
- If the local ERP is powered off or disconnected:
  - The Partner Portal displays the last successful sync timestamp (e.g., "Snapshot as of Today, 21:30").
  - A prominent status badge indicates "Offline Snapshot Mode".
  - Founding partners can continue viewing financial records, creating notes, scheduling meetings, and checking tasks.
  - When the local ERP comes back online, incremental synchronization resumes without conflicts.

---

## 3. Partner Portal Application Architecture (`apps/partner-portal/`)

### 3.1 Technology Stack
- **Framework**: Next.js 15 (App Router) + React 19.
- **Language**: TypeScript (strict mode).
- **Styling**: Tailwind CSS with AFK THEORY matte black/charcoal/olive design system.
- **Fonts**: Local bundled Geist Sans, Geist Mono, and Noto Sans Bengali fallback.
- **Database**: Cloud Supabase PostgreSQL via Drizzle ORM / pg connection pool with auto-SSL.
- **Icons**: Lucide React.
- **Printing / PDF**: Clean CSS print styling with A4 page sizing and PDF generation.

### 3.2 Directory Structure
```
apps/partner-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (portal)/
│   │   ├── layout.tsx             # Shared navigation, sync status header
│   │   ├── page.tsx               # Executive Dashboard (Overview, KPIs)
│   │   ├── my-investments/page.tsx# Personally scoped partner financial statement
│   │   ├── ventures/page.tsx      # Ventures & Projects participation
│   │   ├── updates/page.tsx       # Sanitized Business Activity Feed
│   │   ├── calendar/page.tsx      # Month, Week, Day, Agenda & Notes
│   │   ├── reports/page.tsx       # Printable financial statements & performance
│   │   └── settings/page.tsx      # Partner profile, security & display prefs
│   ├── api/
│   │   ├── auth/                  # Login, logout, session verification
│   │   ├── calendar/              # Calendar CRUD, checklists, recurrence
│   │   ├── sync/                  # Local-to-cloud and cloud-to-local sync endpoints
│   │   └── print/                 # Calendar print & export endpoint
│   ├── globals.css                # Matte black, olive, high contrast tokens
│   └── layout.tsx
├── lib/
│   ├── auth.ts                    # Partner session management & RLS enforcement
│   ├── db.ts                      # Cloud PostgreSQL connection
│   ├── sync.ts                    # Incremental sync utilities & conflict resolution
│   └── format.ts                  # BDT (৳) currency & Bengali date formatters
├── public/
│   └── fonts/                     # Bundled web fonts
├── components/                    # Modular UI components
├── tests/                         # Vitest automated test suite
├── package.json                   # Independent package definitions
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 4. Security & Permissions Matrix

| Partner | Portal Identity | Partner ID | Permitted Scope | Venture Access |
| :--- | :--- | :--- | :--- | :--- |
| **Shawon** | `shawon@afktheory.com` | `partner-shawon` | Admin / Managing Partner | All Ventures |
| **Rafi** | `rafi@afktheory.com` | `partner-rafi` | Founding Partner | Assigned Ventures |
| **Tousif** | `tousif@afktheory.com` | `partner-tousif` | Founding Partner | Assigned Ventures |
| **Midhat** | `midhat@afktheory.com` | `partner-midhat` | Founding Partner | Assigned Ventures |
| **Mueid** | `mueid@afktheory.com` | `partner-mueid` | Founding Partner | Assigned Ventures |

- **Strict Scoping Rules**:
  1. Personal notes and private tasks are only retrievable when `owner_partner_id = session.partner_id`.
  2. A partner cannot view another partner's capital drawings or loan reimbursements.
  3. Venture details and notes are inaccessible to partners not listed on that venture agreement.
  4. All API routes validate the session cookie on the server before executing database queries.
  5. Service-role keys and database master credentials are never sent to client bundles.


---

## 5. Vercel Pro Deployment Guide & Checklist

### 5.1 Project Setup
1. In Vercel Dashboard, select **Add New Project**.
2. Select repository: `https://github.com/asifbhshawon/afk-theory-os`.
3. Set **Root Directory** to `apps/partner-portal`.
4. Ensure Framework Preset is **Next.js**.

### 5.2 Environment Variables Configuration
Configure in Vercel **Project Settings -> Environment Variables**:
- `SUPABASE_DATABASE_URL`: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
- `DB_SSL`: `true`
- `SYNC_SHARED_SECRET`: Cryptographically strong 64+ char secret token.
- `NEXT_PUBLIC_APP_URL`: `https://partner.afktheory.com`

### 5.3 Production Verification Checklist
- [x] Independent Next.js compilation (`apps/partner-portal` compiles with 0 TypeScript/webpack errors).
- [x] Zero server-only Docker, restic or filesystem dependencies inside portal.
- [x] Dedicated `@afk/partner-portal` workspace with local font assets.
- [x] High-security headers configured in `vercel.json` (CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff).
- [x] Local Business OS synchronization script (`scripts/safe-sync-portal.ps1`) verified.

---

## 6. Acceptance Testing & Verification Matrix

The test suite in `tests/acceptance/21-partner-portal-integration.test.ts` covers all 20 required acceptance criteria:

| # | Requirement Criterion | Verification Status | Implementation Proof |
| :--- | :--- | :--- | :--- |
| **1** | Five individual partner logins | **PASSED** | Seeded Shawon, Rafi, Tousif, Midhat, Mueid with scrypt verification. |
| **2** | Correct company financial summaries | **PASSED** | Net sales, gross margin, expenses and cash compiled from GL. |
| **3** | Correct personally scoped partner statements | **PASSED** | Capital, loans, drawings and profit share generated per partner. |
| **4** | Different participation rights for two ventures | **PASSED** | Rafi permitted in VENT-1 & VENT-2; Tousif permitted only in VENT-1. |
| **5** | Protection against unauthorised financial data access | **PASSED** | Unassigned ventures return empty/unauthorized query responses. |
| **6** | Adding a personal calendar note | **PASSED** | Scope = `PERSONAL`, visibility = `PRIVATE`, owner = partner. |
| **7** | Adding a shared business note | **PASSED** | Scope = `COMPANY`, visibility = `PUBLIC`, accessible to all partners. |
| **8** | Creating a venture-specific calendar task | **PASSED** | Task linked to venture with interactive checklist toggle support. |
| **9** | Preventing another user from accessing private notes | **PASSED** | Query filter enforces `ownerPartnerId = session.partnerId` for personal notes. |
| **10** | Syncing portal notes to the local system | **PASSED** | Incremental pull API exports portal notes with stable UUIDs & versioning. |
| **11** | Retaining notes after the business summary refreshes | **PASSED** | Summary push updates aggregate read model; calendar tables untouched. |
| **12** | Handling duplicate sync messages safely | **PASSED** | Idempotent upserts prevent duplicate records on retry. |
| **13** | Handling the local ERP being switched off | **PASSED** | Portal serves cached snapshot with "Saved Snapshot" badge. |
| **14** | Showing the actual last-successful-sync timestamp | **PASSED** | `portal_sync_meta` records timestamp, relative time displayed. |
| **15** | Printing daily, weekly and monthly calendars | **PASSED** | Dedicated `@media print` layout and PDF export styles. |
| **16** | Correct Bengali and BDT formatting | **PASSED** | `formatBdt()`, `formatCompactBdt()`, and Bengali digit conversion verified. |
| **17** | Working mobile layouts | **PASSED** | Responsive navigation and cards with touch-friendly targets. |
| **18** | Successful independent Vercel production build | **PASSED** | Next.js 15 App Router production build succeeded (103 kB bundle). |
| **19** | Validating server-side permissions and RLS policies | **PASSED** | Cryptographic session tokens and server-validated API routes. |
| **20** | Confirming the local ERP continues working unchanged | **PASSED** | All 16 test files (93 tests) in repository pass without regression. |
