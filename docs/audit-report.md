# AFK THEORY Business OS — Comprehensive Technical Audit Report

**Date:** 2026-10-23  
**Audited Branch:** `fix/audit-and-repair`  
**Repository:** `https://github.com/asifbhshawon/afk-theory-os`  
**System Target:** Local-first, multi-user ERP for AFK THEORY clothing brand (PostgreSQL 16, Next.js 15 App Router, Drizzle ORM, Docker Compose, Windows PowerShell)

---

## Executive Summary

A comprehensive, file-by-file technical audit was conducted across the entire repository, inspecting database schemas, migrations, domain services, server actions, API routes, React components, PowerShell scripts, and test suites. 

While the system contains a solid architectural foundation with 41 PostgreSQL tables and core double-entry accounting principles, **critical vulnerabilities and integrity bugs were identified** that must be repaired before production deployment:
1. **Critical Security Advisories:** The installed Next.js version (15.2.0) has active Remote Code Execution (RCE GHSA-9qr9-h5gf-34mp, GHSA-3h52-269p-cp9r) and Middleware Authorization Bypass (GHSA-f82v-jwr5-mffw) vulnerabilities.
2. **Missing Access Control & Authentication Enforcement:** No `middleware.ts` exists; API endpoints (e.g. `/api/backup`) and Server Actions accept unauthenticated requests without verifying session cookies or user roles.
3. **Severe Financial Reversal Math Bug:** Reversing a posted journal marks the original as `REVERSED` (omitted from GL aggregation) while posting a negative reversing entry as `POSTED` (included in GL aggregation), doubling the deduction instead of netting to zero.
4. **Decoupled Database Transactions:** Domain services (`inventory.ts`, `manufacturing.ts`, `sales.ts`) invoke `postJournalEntry()` within their own `db.transaction()`, but `postJournalEntry()` initiates its own independent connection/transaction, violating atomic commit guarantees.
5. **Manufacturing WIP Disconnect:** Calling `issueFabricToFactory` fails to update `production_orders.totalMaterialCost` or register fabric consumption against the production order, forcing tests to manually mutate database rows.
6. **Predictable Credentials & Port Exposure:** Seeded partner accounts use predictable passwords (`Afk@<Name>2026!`), and Docker configurations expose PostgreSQL to public host interfaces without mandatory local binding.
7. **Backup Script Container Inconsistencies:** PowerShell scripts hardcode legacy container names (`afk-theory-postgres`) rather than dynamically resolving `compose.yaml` services, and backups lack authenticated encryption.

---

## Detailed Findings Matrix

| Finding ID | Domain | File Path(s) | Severity | Business Impact | Recommended Fix |
|:---|:---|:---|:---|:---|:---|
| **SEC-01** | Dependencies | `package.json`, `pnpm-lock.yaml` | **CRITICAL** | RCE on Windows hosts (GHSA-9qr9-h5gf-34mp, GHSA-3h52-269p-cp9r) & Middleware Bypass. | Upgrade Next.js to `>=15.2.6` or latest stable compatible (e.g. 15.5+), verify audit clean. |
| **SEC-02** | Auth / RBAC | `src/middleware.ts` (missing), `src/app/api/backup/route.ts`, Server Actions | **CRITICAL** | Any unauthenticated LAN client can trigger backups, post journals, or alter stock. | Implement `middleware.ts`, add server-side `requireAuth()` & `requireRole()` on all routes & actions. |
| **SEC-03** | Auth / Credentials | `src/server/services/setup.ts`, `scripts/seed.ts` | **HIGH** | Predictable default passwords (`Afk@Shawon2026!`) allow unauthorized partner impersonation. | Implement first-run provisioning wizard (`/setup`), generate unique cryptographic credentials. |
| **SEC-04** | Network Security | `compose.yaml`, `scripts/setup.ps1` | **HIGH** | PostgreSQL port exposed to 0.0.0.0; app bound to public IP before HTTPS is established. | Bind PostgreSQL and Next.js strictly to `127.0.0.1`. Add TLS cert setup for trusted LAN. |
| **FIN-01** | General Ledger | `src/server/services/finance.ts` (`reverseJournalEntry`, `getFinancialStatements`) | **CRITICAL** | Double deduction on reversal: original marked `REVERSED` (ignored), reversal marked `POSTED` (counted). | Keep original and reversal entries `POSTED` with linkage, or include both in GL ledger balance calculations. |
| **FIN-02** | Transactions | `src/server/services/finance.ts`, `inventory.ts`, `manufacturing.ts`, `sales.ts` | **CRITICAL** | Journal entries commit or fail independently of stock movements, breaking GL-inventory parity. | Allow `postJournalEntry(input, tx?)` to accept an existing transaction client `tx`. |
| **FIN-03** | Concurrency | `src/server/services/finance.ts`, `sales.ts` (`generateJournalNumber`, `generateOrderNumber`) | **MEDIUM** | Non-atomic `count(*)` generation causes race condition collisions under concurrent partner requests. | Use PostgreSQL sequences or UUID / nanoid / advisory locks to guarantee unique numbers. |
| **MFG-01** | Manufacturing | `src/server/services/inventory.ts`, `src/server/services/manufacturing.ts` | **HIGH** | Issuing fabric to factory WIP does not increment `productionOrders.totalMaterialCost`. | Update `production_orders.totalMaterialCost` inside `issueFabricToFactory` when `productionOrderId` is passed. |
| **BAK-01** | Backup & Recovery | `scripts/backup.ps1`, `scripts/restore.ps1`, `src/server/services/backup.ts` | **HIGH** | Script fails if Docker container is named `afk_business_os_db`; plain dumps lack authenticated encryption. | Dynamic container discovery (`afk_business_os_db` / `afk-theory-postgres`); AES-256-GCM encryption with password. |
| **UI-01** | User Interface | `src/components/Header.tsx`, `src/app/login/page.tsx` (missing) | **MEDIUM** | Hardcoded "Shawon" profile badge; no login/logout interface; partners cannot switch accounts. | Build `/login`, `/logout` server actions, dynamic header showing real logged-in partner and roles. |
| **TST-01** | Test Suite | `tests/acceptance/*.test.ts` | **MEDIUM** | Timestamp slice collision (`Date.now().slice(-5)`) triggers unique key violations on lot numbers. | Use cryptographically random suffix (`crypto.randomUUID()` or `nanoid`) for test entities. |

---

## Detailed Section Analyses

### 1. Security Architecture & Vulnerability Audit
- **Vulnerabilities in `package.json`**:
  `next: 15.2.0` is subject to GitHub Security Advisories:
  - `GHSA-9qr9-h5gf-34mp`: Remote Code Execution in React flight protocol.
  - `GHSA-f82v-jwr5-mffw`: Authorization Bypass in Next.js Middleware.
  - `GHSA-3h52-269p-cp9r`: Unauthenticated RCE on Windows-hosted servers.
- **Access Control & Session Handling**:
  `src/lib/auth.ts` provides `hashPassword`, `verifyPassword`, and `createSession`. However, there is no enforcement layer. Next.js App Router requests currently pass directly to page renderers and server actions without session verification.
- **Missing Negative Security Tests**:
  No tests verify that unauthenticated or non-admin users receive 401/403 or permission exceptions when calling financial or backup endpoints.

### 2. Financial & Accounting Integrity
- **Reversal Mathematics**:
  In `finance.ts`:
  ```ts
  // finance.ts line 191
  await tx.update(journalEntries).set({ status: "REVERSED" }).where(eq(journalEntries.id, original.id));
  // reversal entry inserted with status: "POSTED"
  ```
  In `getFinancialStatements()`:
  ```ts
  // finance.ts line 416
  .where(and(eq(journalEntries.status, "POSTED"), lte(journalEntries.date, asOfDate)))
  ```
  When an entry is reversed, the original lines are dropped because `status` is now `REVERSED`. But the reversal lines are included because `status` is `POSTED`. This doubles the negative impact rather than netting to zero!
  **Fix:** Both original and reversal entries must be included in ledger calculations so `(+Amount) + (-Amount) = 0`.
- **Atomic Transaction Propagation**:
  `inventory.ts`, `manufacturing.ts`, and `sales.ts` wrap logic in `await db.transaction(async (tx) => { ... })`, but then call `await postJournalEntry(...)`, which creates its own independent transaction on the root pool `db`. If the journal fails or the outer transaction fails, state diverges.
  **Fix:** `postJournalEntry(input: CreateJournalEntryInput, tx?: PgTransaction)` must execute against `tx` when supplied.

### 3. Inventory & Manufacturing Integration
- In `src/server/services/inventory.ts` (`issueFabricToFactory`), when fabric is issued for a `productionOrderId`, it records the stock movement and posts a journal (Debit WIP, Credit Materials), but fails to increment `productionOrders.totalMaterialCost`.
- In `tests/acceptance/05-manufacturing-production.test.ts`, the test author had to write:
  `await db.update(productionOrders).set({ totalMaterialCost: "10000.00" })`.
  This violates the business specification: material issuance must automatically accumulate into WIP costs.

### 4. Backup, Restore & Disaster Recovery
- `scripts/backup.ps1` executes `docker exec afk-theory-postgres pg_dump ...`. If running under `compose.yaml`, the container is `afk_business_os_db`. The script crashes if run in a clean compose deployment.
- The backups currently produce plaintext `.sql` and unencrypted `.tar.gz` with only SHA-256 hashes. Prompt requires authenticated encryption (AES-256-GCM or GPG/OpenSSL password encryption) with automated verification.

---

## Remediation Plan & Phase Roadmap

1. **Phase 2 (Immediate Security Fixes):**
   - Upgrade `next`, `react`, and dependencies. Run `pnpm audit`.
   - Implement `src/middleware.ts` for route protection and session verification.
   - Build `/login`, `/logout`, and `/setup` (first-run setup wizard with auto-generated secure credentials).
   - Implement `requireAuth` / `requireRole` guards on every server action and API route.
   - Write negative security acceptance tests (`tests/security/access-control.test.ts`).

2. **Phase 3 (Financial & Inventory Transaction Integrity):**
   - Refactor `postJournalEntry` to support `tx?: PgTransaction`.
   - Update all domain services (`inventory`, `manufacturing`, `sales`) to pass `tx`.
   - Fix reversal accounting logic in `getFinancialStatements` and `reverseJournalEntry`.
   - Implement automatic WIP cost accumulation in `issueFabricToFactory`.
   - Implement atomic rollback tests proving zero partial commits on failures.
   - Fix unique identifier collisions in tests with robust UUID/timestamp generators.

3. **Phase 4 (Backup & Recovery Reliability):**
   - Update `scripts/backup.ps1` and `scripts/restore.ps1` for dynamic container resolution.
   - Implement AES-256-GCM authenticated encryption for backups.
   - Provide isolated test restore verification.

4. **Phase 5 & 6 (Business Modules & Enterprise UI/UX):**
   - Complete missing interactive frontend dialogs (partner approvals, payments, order packing).
   - Implement dynamic header/sidebar displaying active authenticated user with logout.

5. **Phase 7 & 8 (PDFs, Reporting & Full Acceptance Verification):**
   - Real downloadable PDF generation for invoices, vouchers, and statements.
   - Full acceptance test suite passing end-to-end.
