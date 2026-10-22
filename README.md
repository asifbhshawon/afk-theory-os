# AFK THEORY Business OS

> **Fully Local, Production-Grade Apparel Business Management & Double-Entry Accounting System**

Built specifically for **AFK THEORY**, a contemporary streetwear and apparel brand based in Dhaka, Bangladesh.

---

## 1. System Overview & Core Invariants

AFK THEORY Business OS replaces spreadsheets with an authoritative, database-backed transactional operating system designed for the brand's five founding partners: **Shawon, Rafi, Tousif, Midhat, and Mueid**.

### Key Invariants:
1. **100% Local & Offline Runtime:** Works entirely on a Windows host machine without any internet connectivity, SaaS, Firebase, Supabase, or external API dependency.
2. **Double-Entry General Ledger:** Every financial posting is strictly balanced ($\sum \text{Debits} == \sum \text{Credits}$ to the paisa). Capital contributions increase partner equity without inflating sales revenue. Posted records are immutable; corrections require traceable reversal journals.
3. **Five Founding Partners:** Initial 20.00% ownership each. Ownership percentages and profit-share percentages are tracked separately and effective-dated. Changing operational roles does not alter ownership.
4. **Three Apparel Manufacturing Routes:**
   - **Route 1 (Finished Garments):** Direct supplier lots with SKU variant costing.
   - **Route 2 (Blank Customisation):** Blanks purchase + printing/embroidery direct charges + QC.
   - **Route 3 (Fabric to Outsourced Factory):** Fabric purchase + issue to factory floor WIP + direct charges + QC inspection + absorption costing into good units + defective scrap logging + material returns.
5. **Inventory Concurrency & Protection:** SKU-level variants (Size/Color/Fit), lot-based actual costing, and row-level locking (`SELECT ... FOR UPDATE`) to prevent selling the last unit twice.
6. **Encrypted Local Backups & Portability:** Automated PostgreSQL logical dumps (`pg_dump`), document archives, and SHA256 integrity checksums with tested isolated restore procedures.

---

## 2. Technology Stack

- **Framework:** Next.js 15 (App Router, Standalone Output) + TypeScript
- **Database:** PostgreSQL 16 (in durable Docker volume)
- **ORM & Migrations:** Drizzle ORM + Drizzle Kit versioned SQL migrations
- **Styling & Design:** Tailwind CSS (AFK Matte-Black, Charcoal, Olive, and Off-White brand palette)
- **Deployment:** Docker Compose + Windows PowerShell automation
- **Test Framework:** Vitest with real transactional database assertions

---

## 3. Quickstart Guide (Windows 11)

### Prerequisites:
- Windows 11 (64-bit) with Docker Desktop running.
- Node.js v20+ and pnpm installed.

### Fast Installation:
Open Windows PowerShell in the project directory:

```powershell
# 1. Automated setup (migrations + 5 partner provisioning + chart of accounts)
.\scripts\setup.ps1

# 2. Start the application
# For Docker Compose:
.\scripts\start.ps1

# Or for local development mode:
.\scripts\start.ps1 -Dev
```

Open your browser at: **`http://localhost:3000`**

---

## 4. PowerShell Management Commands

| Script | Purpose |
|---|---|
| `.\scripts\setup.ps1` | Verifies prerequisites, applies database migrations, and seeds initial data. |
| `.\scripts\start.ps1` | Starts Docker Compose stack safely with healthchecks. |
| `.\scripts\stop.ps1` | Stops services without removing database volumes. |
| `.\scripts\status.ps1` | Inspects Docker containers and queries `http://localhost:3000/api/health`. |
| `.\scripts\backup.ps1` | Exports consistent PostgreSQL dump, archives documents, and computes SHA256 manifest. |
| `.\scripts\verify-backup.ps1` | Verifies backup integrity against the SHA256 manifest. |
| `.\scripts\restore.ps1 -Isolated` | Drills a safe restore into a disposable test database (`afk_restore_test`) without touching live data. |
| `.\scripts\test.ps1` | Executes all 16 executable acceptance tests. |

---

## 5. Main Functional Modules

- **Executive Dashboard (`/`):** Real-time liquid cash/bank/bKash/Nagad wallet balances, net revenue, gross margin %, inventory at cost, recent journals, and partner summaries.
- **Finance & General Ledger (`/finance`):** 38 system accounts, double-entry journal ledger, expense logging, and voucher links.
- **Partner Accounts (`/partners`):** Individual statements for Shawon, Rafi, Tousif, Midhat, and Mueid; capital ledgers, partner loan balances, and equity contribution actions.
- **Catalog & Stock (`/inventory`):** SKU variants, inventory lots with unit costs, and immutable stock movement ledger.
- **Manufacturing Engine (`/manufacturing`):** Routes 1, 2, and 3; production orders, direct batch costs (CMT, printing), QC inspections, and unit cost calculation.
- **Sales & Logistics (`/orders`):** Order entry, stock reservations, courier waybills, COD tracking, settlement batching, and returns/RMAs.
- **Financial Reports (`/reports`):** Live Balance Sheet, Income Statement (P&L), Trial Balance, and Partner Equity drilldown.
- **A4 Printable Invoices & Vouchers (`/print/invoice/[id]`, `/print/voucher/[id]`):** Branded, printable A4 documents formatted with local typography.
- **Settings & Audits (`/settings`):** Audit trail viewer, database diagnostics, and one-click backup generation.

---

## 6. Acceptance Testing Summary

All 16 acceptance test scenarios are passing:
```text
Test Files  7 passed (7)
     Tests  16 passed (16)
  Duration  3.48s
```
Run anytime with:
```powershell
.\scripts\test.ps1
```

---

## 7. Documentation Index

- [Setup on Windows](docs/setup-windows.md)
- [LAN & Local HTTPS Setup](docs/setup-lan-https.md)
- [Accounting Policies & Rules](docs/accounting-policy.md)
- [Role & Permissions Matrix](docs/permissions-matrix.md)
- [Database Schema Specification](docs/database-schema.md)
- [Backup & Disaster Recovery Guide](docs/backup-and-restore.md)
- [User & Operator Manual](docs/user-guide.md)
- [System Test Results](docs/system-test-results.md)
- [Future Medusa Integrations](docs/future-integrations.md)
- [Implementation Progress Ledger](docs/PROGRESS.md)
