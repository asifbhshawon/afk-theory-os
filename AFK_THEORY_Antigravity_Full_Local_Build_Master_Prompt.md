# MASTER IMPLEMENTATION PROMPT — AFK THEORY BUSINESS OS (FULLY LOCAL)

> Paste everything below this line into Google Antigravity in the project workspace. This is an implementation instruction, not a request for a plan or a UI mockup. You are expected to implement, run, verify, fix, and document the application on the user's local machine. Work in reviewed, tested phases. Never claim untested features are complete.

## 1. YOUR ROLE AND OBJECTIVE

Act as the lead software architect, full-stack engineer, database designer, accounting-systems engineer, apparel ERP specialist, product designer, security engineer, QA engineer, and local DevOps engineer for **AFK THEORY**, a Bangladesh-based clothing brand starting from zero.

**Build a real, fully local, Docker-powered, production-oriented business management system called `AFK THEORY Business OS`.** This is an internal app, not the customer-facing clothing store. It must replace spreadsheet-based management with reliable database-backed workflows. A mere dashboard, clickable prototype, hardcoded seed data, placeholder forms, or CRUD pages without functioning cross-module logic are UNACCEPTABLE.

The five founding partners are **Shawon, Rafi, Tousif, Midhat, and Mueid**. Each begins with **20% ownership**, while profit-share percentages are stored **separately** and may change through approved, effective-dated decisions. Business currency is **BDT (৳)**, locale is **en-BD** with optional Bangla labels, and user-facing timezone is **Asia/Dhaka** (store timestamps in UTC). The business sells drop-shoulder T-shirts first, later shirts, trousers, and more. Orders originate from website, Facebook, Instagram, WhatsApp, manual/in-person channels. Some garments are purchased finished, some blanks are printed/embroidered, and some are made by outsourced factories using AFK-provided fabric.

Inspect the existing workspace and do not destroy or rewrite unrelated files. If present, read `docs/reference/AFK_Theory_Business_Manager(1).xlsx` and `docs/reference/AFK_Theory_Business_OS_Research_and_Build_Plan.md` before designing schema. The workbook contains useful reference sections (Dashboard, Settings, Financial Report, Partner Report, Accounts, Partners, Entries, Items, Lots, Stock Log, Production, Sales, Contacts, Ideas, Reconciliation, Checks, Event Guide, Read Me). Use the workbook to map entities and workflows, **not** as the runtime database. If either source file is absent, document that and proceed from this specification; never pretend you read it.

## 2. CRITICAL NON-NEGOTIABLE: FULLY LOCAL RUNTIME

- Windows 11 development and hosting with **Docker Desktop + WSL2** and **PowerShell** instructions. Also ensure migration to a Linux Docker host is possible later.
- The entire finished application must work **after initial installation with no internet connectivity**: Next.js app, PostgreSQL DB, sign-in/auth/session validation, document uploads, invoice/PDF generation, dashboards, reporting, jobs, backups, and data restore.
- Do NOT require Supabase, Firebase, Vercel, Cloudflare, AWS, Auth0, Clerk, hosted Postgres, CDN, Google Fonts CDN, external authentication, remote image APIs, license-validation servers, analytics scripts, web fonts fetched over internet, or any SaaS runtime dependency.
- Installing dependencies, downloading Docker images, and software updates may need internet **during setup only**; give a reproducible offline-runtime test after the build. Bundle local UI assets, fonts (respecting licenses), and templates.
- Use **one central PostgreSQL database**. Partners use browser clients to connect to the host PC on the same LAN. No independent per-device writable database copies or unsafe bidirectional sync. The host PC must be running for clients to access it. Internet may be off; **LAN must remain functional**.
- Default deployment: **localhost-only**. Provide an explicitly configured **LAN mode** on the user's trusted private network; do not unintentionally expose the app on public interfaces or the internet. Never publish the PostgreSQL port. Protect LAN sessions with proper HTTPS (e.g., Caddy's local CA) and provide instructions for installing/trusting the CA on each client, including mobiles. Document the practical certificate/DNS/IP setup; never silently downgrade to insecure login. No public port-forwarding or UPnP. If LAN TLS isn't successfully configured, keep localhost-only as the verified mode and report LAN as pending.
- Provide complete backup and restore to migrate all data to another Windows/Linux Docker computer. **Backups stay local** for this version: separate external drive or network-attached storage path, optionally a second machine. No cloud account required. Do not claim backup equals live failover.
- Local user accounts, secure password hashing, offline admin-recovery process, session expiration, role-based and action-based server-side permissions. **Never ship default passwords** in production.
- An optional future cloud integration must be designed as a separate disabled adapter and must not be necessary for the local app.

## 3. ENGINEERING STACK

Use a maintained, compatible, pinned and documented version of:
- Next.js App Router + strict TypeScript, React, accessible Tailwind-based component system, responsive charts/tables/forms.
- PostgreSQL as the sole transactional source of truth, in a durable Docker volume; Drizzle ORM + versioned, reviewed SQL migrations (and handwritten SQL where necessary). Use foreign keys, check constraints, uniques and indexes. Avoid storing money in JS floating-point; use NUMERIC/decimal-safe operations or integer paisa, and show amounts in BDT.
- Modular monolith: clear domain services for identity, finance, partners, catalog, stock, purchasing, production, sales, courier, reporting, documents, and admin. All writes must go through validated application services, not direct client-side DB operations. Add separate background worker only for real jobs (PDF/export/backup metadata/scheduled tasks).
- Offline-compatible, maintained authentication approach: strong Argon2id/bcrypt as appropriate, secure session handling, brute-force/rate-limit protections, CSRF mitigations, secret rotation procedure, password recovery via local admin CLI or one-time local flow; deny by default. Every privileged API/mutation must re-check permissions server-side.
- Zod or equivalent input validation at boundaries. Parameterized SQL. Consistent server errors, transaction idempotency, optimistic lock/concurrent write protection.
- Playwright or a similarly reliable **locally installed/bundled** HTML-to-PDF engine; support Bangla typography if local fonts exist. Use a separate printable layout, correct pagination, file naming, repeatable report generation.
- Docker Compose with multi-stage non-root production images, health checks, startup ordering, `.env.example`, `.dockerignore`, `.gitignore`, persistent database+document volumes, structured logs, app-worker services. Never use `docker compose down -v` in any start/stop instructions.
- Vitest or equivalent for unit/domain tests, integration tests against disposable real PostgreSQL, and Playwright browser end-to-end tests including responsive/mobile widths.
- No Redis, external message broker, Kubernetes, or microservices unless a demonstrated concrete need arises. Prefer a database-backed job queue where possible.

Before implementation, inspect official docs to confirm current compatible versions and avoid deprecated APIs. Do not overengineer scaffolding at the expense of working transactions.

## 4. USER EXPERIENCE: WORLD-CLASS BUT FUNCTIONAL

Build a polished, professional admin application using AFK THEORY brand identity: matte-black/charcoal, olive-black, warm off-white, restrained accent colour, high contrast, consistent 8px-scale spacing, generous readable typography. Full keyboard navigation, form labels, actionable validation, empty states, skeleton loading, confirmations for financial operations, proper pagination, search/filter/sort, real breadcrumbs and error states. Add carefully implemented dark and light modes with no clashing colours.

**Desktop:** persistent grouped sidebar, header with business switch/context (single AFK business for now), unified search, date filters, notifications, approval inbox, user profile, breadcrumb, live dashboard; record list/detail pages, drill-down reports, export actions, printable pages.

**Mobile:** purpose-built responsive layouts, not crammed desktop tables. Bottom navigation (Overview, Orders, Add, Inventory, More), generous tap targets, camera/attachment upload, compact approval flow, cards and sheets replacing wide tables. Test 360px, 390px, 768px, 1280px, 1440px and larger fonts. No horizontal clipping, dead buttons or text smaller than comfortably readable.

**Main navigation:** Overview; Finance & Accounting; Partner Accounts; Products & Collections; Materials & Inventory; Suppliers & Purchasing; Manufacturing & QC; Sales & Orders; Courier & COD; Contacts & CRM; Ideas & Tasks; Documents & Reports; Approvals & Audit; Settings; Backup & System Health.

Every functional module must offer a useful index/list, creation/edit (as permitted), detail view, state/status changes, history/timeline, search, relevant filters and at least one actual end-to-end business workflow. No visible UI button can be purely decorative; hide or clearly mark genuinely future features.

## 5. COMPLETE FUNCTIONAL REQUIREMENTS

### A. Initial setup, organisations and system governance
- First-run wizard: business identity, address/contact/logo, BDT currency, fiscal period, date/time, document numbering, initial chart of accounts, initial warehouses/locations and five partner identities.
- Invite/create five **individual** partner accounts securely, force change of one-time passwords. Different **roles/permissions from ownership**. Roles such as Administrator, Finance Manager, Finance Approver, Inventory Manager, Manufacturing Manager, Sales Operator, Partner Viewer and External Accountant; assign multiple roles per user.
- Every partner can see entitled shared business reports, while only permitted people approve/reverse/edit; sensitive withdrawals/capital share changes/period closes require independent approval, not own approval.
- Configurable approval policies by module/type/amount, attachments required above thresholds, audit trail. Partner decision register and effective-dated ownership/profit-share changes. Settings editable without source-code changes.

### B. Finance and proper double-entry accounting
- Chart of accounts with account types, posting permissions and closing balances.
- Journals/journal lines, at least two lines per posted entry, total debit == total credit, unique idempotency/source references, append-only posted history with reversing entries instead of deletion. Draft > Submitted > Approved > Posted > Reversed/Corrected.
- Partner equity contributions; partner loans payable; personal payments on behalf of company; reimbursements; drawings; approved profit distributions; distinguish capital from revenue and loans from sales/expenses.
- Cash, bank, bKash, Nagad and custom cashboxes. Cash deposits, expenses, transfers, fees, advances, liabilities, receivables, refunds, petty cash and other income; receipt images and unique financial vouchers.
- Accounts payable/receivable; bills; supplier advance vs expense; bill settlement and outstanding balance; bank/wallet reconciliation and month-end period close. Expenses can be tagged to products/lots/orders/drops, where meaningful.
- Reports computed from posted journals: trial balance, general ledger, income statement, balance sheet, cash/bank book, partner statements, expense breakdown, supplier/customer aging, net sales, cash flow methodology documented and reconciled. Every KPI drill-down links to evidence.
- BDT rounding, user-defined tax codes and rates (NO fabricated legal compliance), manual adjustment types and transparent tax calculation. Do not assume Bangladesh VAT status/registration; configurable tax policy and compliance warning until accountant review.

### C. Partner management
- Shawon, Rafi, Tousif, Midhat, Mueid: initial shareholding 20% each; ownership vs profit-share distinct and effective dated.
- Capital ledger, loans, draws, distributions, reimbursements, individual contributions with mode/date/reference/attachment/approver. Per-partner statement showing opening, movements and closing. Capital account not synonymous with cash deposited; earnings not automatically distributable.

### D. Product catalogue, variants and drops
- Collections/drops, styles/designs, product images/design assets, blank items, finished garments, fabric, labels, packaging, production services; configurable status.
- Unique SKU for EVERY size/colour/fit variant (e.g. AFK-DS-T001-BLK-M), barcode-ready codes, categories, colourways, price lists, product cost and margin reports, design revisions and sample approvals.
- Product-specific Bills of Materials (BOM)/recipes with version history; cost components and supplier references. Archive instead of delete if referenced by transactions.

### E. Purchasing and suppliers
- Vendor/factory/courier/customer directory, purchase requests, quotation comparison (if practical), purchase orders with line items, discounts and taxes, delivery due dates, partial receipt, goods received notes, supplier bill matching, advance payments, returns to supplier, settlement and open payables.
- Capture bill/receipt/photo/contract attachments locally and associate with actual transactions.

### F. Stock, materials, lots and warehouses
- Source-of-truth **stock movement ledger**: receipts, issues, transfers, reservations, fulfilments, returns, adjustments, write-offs, damaged and factory/WIP custody. Track on-hand, reserved, available, incoming, at-factory and defect separately.
- Lot IDs per purchase/manufacturing batch; size/colour-specific stock by SKU; inventory locations and accountable custodian. Lot-specific actual cost or approved FIFO policy, stable and tested.
- Low-stock alerts, cycle counts, quantity reconciliation, negative stock prevention (unless special reviewed override), controlled adjustment approvals, stock valuation as of date, movement history.
- Use DB transactions and row locks/appropriate concurrency safety for the last unit. Never decrement stock from multiple independent event handlers without idempotency.

### G. Clothing manufacturing: THREE complete routes
1. **Finished-garment purchase:** supplier > purchase/receipt lot > SKU quantities > inventory > sale.
2. **Blank + customisation:** buy blanks > print/embroidery job > consumables/printing and wastage > QC > finished variant/lot > sale.
3. **Own fabric + outsourced production:** purchase fabric by type/colour/unit/roll/lot > transfer/issue fabric to factory > cut/sew/print/embroidery/labels/packaging/transport/other costs > partial output/defects/rework/unused fabric > receive by SKU/size/colour/lot > finish and cost allocation > sale.
- Production orders with customer/vendor, planned and actual output, factory location, BOM, deadlines, stage, material issue and returned materials, wastage, labour/printing charges, advances, batch costing, QC result and exception reports. Track who owns raw material and where it is held.
- Distinguish material inventory, work-in-progress and finished goods accounting. Handle yield loss/defect cost with configurable documented policy; don't divide cost by planned units blindly.
- Production summary per batch: fabric issued vs consumed vs returned vs still outstanding; units expected vs good vs defective; total cost; weighted unit cost by output SKU; vendor payable and status.

### H. Sales, channels, shipments, refunds and COD
- Manual/social/website order entry with customers, multiple items/variants, price, discount, delivery charge, shipping zone, advance, partial payments, notes, evidence, and confirmed orders.
- Order flow: Draft > Confirmed > Packed > Shipped > Delivered, plus cancellations and returns, with valid transition rules, inventory reservation and actual stock dispatch differentiated.
- Delivery, courier, COD: track courier waybill, gross COD collected, courier fee, actual remittance, other adjustments, receivable difference, remittance batches, overdue COD and settlement evidence.
- Sales invoice, payment receipt, delivery note, return receipt. Exchange/RMA: original order reference, inspection and restockable/defective decision, refund difference, correct journal/stock reversal.
- Separate order entry from recognised sale/payment; configurable/documented point of revenue recognition. Prevent double posting from repeated requests.
- Keep future Medusa integration **DISABLED** in local version. Provide documented extension points, mappings and idempotency strategy, but do not make the app depend on any Medusa or internet API.

### I. Contacts, ideas, tasks, collaboration
- Suppliers, factories, couriers, customers, notes, tags, contracts and important dates; restrict sensitive customer contact data to authorised roles.
- Product concepts, references and design stages, launch plans/drop budgets, assigned tasks, deadlines, priorities, checklist, comments, attachments and decision history. Partner collaboration within local system, no email/SMS dependency.

### J. Local files, forms, templates and reporting
- Files stored on persistent LOCAL disk/volume, with private download API checking access, metadata, hashes, MIME/type/size validation and backups. Never use public static upload directory.
- Professional branded **PDF + print + CSV/Excel** for sales invoices, receipts, expense/payment vouchers, capital contribution receipts, owner statements, purchase orders, goods receipt notes, production sheets, supplier statements, courier settlement sheets, inventory valuation, income statement, trial balance, balance sheet, monthly financial pack and audit export.
- PDF templates with local logo and Bangla/English support where configured; date, business identity, reference ID, company/contact details, line items, BDT breakdown, signature/approval fields, print preview, correct A4 pagination and repeating headers.
- Report filters by date, SKU, product, drop, lot, vendor/factory, partner, payment account and channel. Save immutable monthly report snapshots or versioned report runs; exports reflect exactly the selected filter + accounting cut-off.
- Avoid formula injection in CSV/XLSX output (escape spreadsheet executable prefixes); don't expose private reports to unauthorised users.

### K. Configuration and extensibility
- Admin UI for transaction/expense categories, account names/types under safe validation, payment methods, warehouses, SKU prefix, approval rules, product attributes, custom tags/fields, report logo/colours, dashboard widgets, date/currency display, light/dark theme and English/Bangla interface labels.
- Safe typed custom fields: text, number, date, boolean, select; optional/required, validation, role visibility, search where appropriate. Do NOT allow admin-supplied executable code, arbitrary SQL, unrestricted HTML, or unsafe direct editing of immutable financial records.
- Local-only backup schedule/path, report retention, fiscal year, and system diagnostics.

## 6. DATABASE DESIGN AND ACCOUNTING SAFETY

Use a proper relational schema with internal UUIDs and user-readable business references, e.g. `AFK-INV-2026-000001` / `AFK-PO-2026-000001`. Tables should be grouped roughly as:
- `users`, `roles`, `permissions`, `sessions`, `partners`, `ownership_history`, `profit_share_history`, `approval_policies`, `approval_requests`, `audit_events`, `settings`;
- `accounts`, `fiscal_periods`, `journal_entries`, `journal_lines`, `payment_accounts`, `payments`, `reconciliations`, `tax_codes`, `attachments`;
- `products`, `designs`, `collections`, `product_variants`, `items`, `boms`, `bom_lines`, `lots`, `locations`, `stock_movements`, `stock_reservations`, `stock_counts`;
- `contacts`, `purchase_orders`, `purchase_lines`, `goods_receipts`, `supplier_bills`, `supplier_payments`;
- `production_orders`, `material_issues`, `production_costs`, `production_outputs`, `qc_results`, `material_returns`;
- `sales_orders`, `sales_lines`, `payments_received`, `fulfilments`, `returns`, `refunds`, `shipments`, `courier_settlements`;
- `ideas`, `tasks`, `comments`, `documents`, `report_runs`, `background_jobs`, `backup_runs`, `integration_events` (extension only).

This is a logical guide, NOT a command to generate 70 empty tables. Normalise and implement actual constraints. Clear migration history, indexes for filter/report paths, FK restrictions, unique references, typed enums/state transitions, strict nullability, created/updated/by columns, and audit entries for sensitive changes.

Business invariants enforceable via domain services AND constraints:
1. Posted journal debits equal credits (reject imbalance); financial reports derive from posted journal entries.
2. Equity deposit debits bank and credits **partner capital**, NOT revenue.
3. Supplier payment and goods receipt are separate; raw materials, WIP, finished inventory, COGS and cash flow are not interchangeable.
4. All money-related operations are atomic and idempotent on retries.
5. Posted journals cannot be edited/deleted; correction by linked reversing journal and replacement where necessary.
6. No unauthorised self-approval for sensitive operations.
7. No overselling when two users order the last item simultaneously.
8. Stock movements link to SKU, lot, location, quantity, source and valuation policy.
9. Realised profit isn't defined as money collected minus cash expenses; correctly account for liabilities, inventory and COGS.
10. Closed fiscal periods cannot be silently altered.
11. Business document references cannot be duplicated on retry.
12. Time/date and currency rounding are predictable and tested.

Require a written `docs/accounting-policy.md` explicitly specifying transaction recognition for partner contributions, loans, purchases, supplier advances, WIP, defects, sales/COD, discounts, delivery fees, returns and write-offs. Unknown legal/tax policy MUST be configurable and marked for qualified accountant review, not guessed.

## 7. BACKUP, RESTORE, DISASTER RECOVERY — LOCAL ONLY

Design a practical recovery strategy for Windows Docker hosts:
- PostgreSQL data remains in durable named volume; attachments in persistent private volume. **Docker volumes are NOT backups.**
- Provide a tested database export using `pg_dump -Fc` (or a documented equivalent) plus application files, business configuration, schema/app version and manifest/checksums. A backup job must not report success if any component fails or uploaded attachments are omitted.
- Write backups **outside** the main database volume and application working directory, ideally on a user-configurable host-mounted **external drive** (for example `E:\\AFK-Backups`, NOT hardcoded). A backup on the same physical drive is not independent protection. Support optional second local copy/NAS.
- Provide encryption-at-rest for backup archives using a maintained offline-capable mechanism such as restic; keys/passwords stored separately from the backup and source control. Require operator to set the repository password securely and document lost-key implications.
- Implement retention examples such as 7 daily / 4 weekly / 12 monthly if supported, but no automatic deletion without a clearly verified policy. Maintain a `backup_runs` audit log and warn on failed/old backups.
- Provide scripts `scripts/backup.ps1`, `scripts/restore.ps1`, `scripts/verify-backup.ps1`, plus portable shell counterparts if feasible. Scripts must not embed real secrets. Fully document exact PowerShell commands.
- **Restore must be tested into an isolated disposable environment with new volumes** without overwriting the main installation. Verify ledger totals, partner accounts, SKU quantities, attached documents, login recovery path and representative PDFs. Only allow replacing the live DB after operator confirmation and safety pre-backup.
- Offer scheduled backups that continue while the Docker stack is operating, explicitly note Windows Docker Desktop/scheduled task dependencies. No false claim of zero recovery-point loss. Document both RPO and RTO limitations.
- A different computer must be able to run Docker Compose, restore backup, and serve the same five-user business OS via browser.
- Avoid direct live PostgreSQL volume copy while DB is running; use consistent logical backup or a documented database-native physical backup procedure.

## 8. SECURITY

- Strong password hashing, unique partner sessions, server-enforced RBAC and transaction authorisation, state/approval checks, CSRF and session protections, audit of login and critical actions, rate limit authentication, configurable account lockout that cannot permanently lock out all admins, secure local account recovery.
- Don't publish database, worker, backup interface, admin debug endpoints, files, or environment secrets. Use internal Docker network and minimally necessary port bindings.
- Protect files and PDFs with authorisation per route. Sanitize file names, verify media signatures where sensible and enforce storage quota/size limits. Reject path traversal.
- No insecure test credentials in production seed, no anonymous access, no public demo route in live mode. If demo data is needed, isolate it behind DEMO_MODE or disposable test database.
- All key mutations audited. For transparent five-partner operations, capture who did what, when, against which prior version, source/ref and approval context. Do not pretend DB-superuser modifications are cryptographically impossible; prefer separate restore copies and signed periodic exports for tamper evidence.
- Never run destructive DB reinitialisation, `DROP`, `TRUNCATE`, `docker compose down -v`, or delete user data without explicit user approval. Before schema changes, backup and use migrations with a recovery plan.

## 9. REQUIRED DOCKER + LOCAL OPERATIONS DELIVERABLES

Create actual files, not pseudocode:
- `compose.yaml`, tested `Dockerfile`(s), health checks, sensible resource limits, `.env.example`, separate dev/production compose overrides where useful.
- `README.md`, `docs/setup-windows.md`, `docs/setup-lan-https.md`, `docs/user-guide.md`, `docs/permissions-matrix.md`, `docs/accounting-policy.md`, `docs/database-schema.md`, `docs/backup-and-restore.md`, `docs/system-test-results.md`, `docs/future-integrations.md`.
- PowerShell helpers: `scripts/setup.ps1`, `scripts/start.ps1`, `scripts/stop.ps1`, `scripts/status.ps1`, `scripts/backup.ps1`, `scripts/restore.ps1`, `scripts/test.ps1`; Bash counterparts optional.
- `.env.example` and secure first-run secrets wizard. Demonstrate exact `docker compose up -d --build`, `docker compose ps`, and health endpoint/status checks from actual execution.
- Migrations and deterministic demo/test seed data in test-only mode; prod starts empty except permitted core reference data and the explicit setup wizard.
- Non-secret error and audit logs, standard health/readiness endpoints, admin System Health screen with database/worker/disk/backup status, and a troubleshooting guide.
- All server routes, client hooks and form actions implemented end-to-end. Clean `lint`, `typecheck`, build and tests (or explicit truthful results for blockers).

## 10. MILESTONE-GATED EXECUTION — BUILD AND VERIFY, DO NOT ONLY PLAN

**Begin by auditing prerequisites and creating a concise implementation plan and durable `docs/PROGRESS.md`. Then immediately start implementing.** Do not stop after writing a plan, architecture diagrams or a pretty UI. Work in vertical slices and execute tests after each slice.

**Phase 0: Workspace audit/design.** Examine source files if available, confirm Docker and Node availability, explain blockers without faking results, define accounting events, permissions matrix and relational schema. Initialise repository without overwriting unrelated work.

**Phase 1: Local foundation.** Deliver `docker compose up -d --build` running actual Next.js + PostgreSQL, migrations, auth wizard, five private partner accounts, protected pages, roles and audited actions; test host-only login. Set up local assets and offline-runtime verification. Add a real smoke-test suite.

**Phase 2: Money + partners.** Deliver fully working chart of accounts, capital/loans/expenses/transfers/journals, approval states and valid PDFs/receipts. Show a real sample equity deposit, cash expense and partner statement; verify balanced books and money in/out.

**Phase 3: Products + inventory + purchases.** Deliver SKU variants and lots, receiving, warehouse transfers, stock movements, reservations and costs. Test two users attempting to consume the last unit simultaneously.

**Phase 4: Manufacturing.** Deliver the three routes (finished, blank customisation, own fabric to outsourced factory); receiving, WIP and costs, defects, return of unused materials and documented valuations. Test each workflow end to end with journal/stock reconciliation.

**Phase 5: Sales + courier.** Deliver social/manual order, sales recognition, fulfilment, delivery, COD, courier settlement, refund/return/exchange and relevant reports. Test partial payments, courier deduction, cancellation, and duplicate payment.

**Phase 6: Reports + advanced modules.** Deliver dashboard KPIs and drilldowns, audit center, full PDF/CSV/XLSX reporting, docs/templates, approval matrix, contacts, tasks/ideas, custom fields and settings. Test selected reports against known journal/stock facts.

**Phase 7: LAN, backup and portability.** Configure/test safe LAN HTTPS with local CA if feasible. Test application with internet disconnected; test encrypted external-drive backup and isolated restore with files and financial totals. Explain any OS trust/onboarding steps not executable automatically.

**Phase 8: UX and security hardening.** Run end-to-end tests with desktop and mobile, accessibility checks, threat review, permissions checks, race-condition tests, backup drill and performance sanity tests. Fix issues before marking done.

For **every phase** update `docs/PROGRESS.md` with files changed, exact commands run, tests passed/failed, screenshots where browser tools permit, unresolved risks, and next smallest executable task. If Antigravity loses context, resume by reading `docs/PROGRESS.md` and repo history. Prefer small safe commits at verified milestones. Do not claim any phase complete solely because UI exists.

## 11. REQUIRED EXECUTABLE ACCEPTANCE TESTS

Create and run tests for these real cases:
1. Five partners initially each have 20% ownership; changing a user's role does not change ownership.
2. Shawon contributes ৳50,000: bank +50,000, Shawon capital +50,000, profit/revenue +0.
3. Fabric purchase costs ৳15,000: cash -15,000, material asset +15,000; matched stock receipt quantity exists.
4. Issue fabric to a factory: correct custody/location and WIP treatment; factory remains accountable for outstanding materials.
5. Complete production: total cost and per-good-unit lot valuation reconcile; rejects and unused material properly accounted.
6. Sell SKU size M black: only matching SKU/lot stock decreases and sale/COGS posted exactly once under defined recognition policy.
7. Two users simultaneously sell one remaining SKU: only one successful stock fulfilment.
8. Repeated request/payment/import with same idempotency reference creates no duplicate journal, receipt or stock movement.
9. Debit/credit mismatch rejected; unauthorised post, reverse, self-approval rejected.
10. Courier collects ৳1,000 COD, deducts ৳70 fees and remits ৳930: bank +930, courier fee 70, courier receivable closes; no double-counting sale.
11. Return after delivery: correct refund, return inspection/stock disposition, COGS reversal and account effect.
12. Period close stops backdated normal posting and requires authorised adjustment.
13. Partner Viewer cannot create/edit money movements; no user can inspect another role's restricted documents via direct URL.
14. Expense/payment voucher PDF is real, formatted and downloadable; printed A4 layout renders offline with local fonts.
15. Filtered monthly reports agree with posted journal balances and stock ledger, not stale dashboard figures.
16. Full external-drive backup from live app can be restored to a separate disposable Docker project; data, attachments, accounts, references and PDFs survive.
17. Stop internet access but keep LAN and Docker: host and correctly configured LAN browser clients can still log in and use existing business records, upload, generate PDFs and query reports.
18. Restart Docker services without data loss; safe `start/stop` do not delete volumes.
19. Mobile UI at 360/390px has no clipped major actions, overlaps or broken navigation; desktop table layout readable.
20. Run security tests for CSRF/session, upload validation, direct-object access, rate limits, and server permission checks.

## 12. EXACT DEFINITION OF DONE AND OUTPUT FORMAT

It is only **READY FOR REAL BUSINESS REVIEW** when:
- The application is actually running locally, with its URL displayed (normally `http://localhost:3000` for host-only development; use HTTPS for authenticated LAN operation).
- Core business records persist in PostgreSQL across Docker restarts and are not browser-local mock state.
- The above tested workflows, reports, PDF generation and recovery are functional.
- `docker compose ps` shows expected healthy service states.
- The app works with internet disconnected AFTER initial installation/build, without any required SaaS runtime.
- Secret and recovery material is delivered securely to the local operator, not checked into Git or printed in public reports.
- User docs and backup+restore documentation include verified commands for Windows PowerShell.

At the end of each execution session, produce:
**A. Implemented and demonstrated:** real routes/features, actual commands, tests and test results.
**B. Not implemented or blocked:** explicit honest list, no misleading 100%-complete declaration.
**C. Local entry point:** URL, how to start, how to set up initial accounts, how to stop.
**D. Data protection:** where volumes and backups live, next scheduled backup, recovery caveats.
**E. Changed files and commit:** repo changes summary and tests run.
**F. Next milestone:** the exact next implementation tasks, not vague recommendations.

**START NOW:** Inspect the workspace and local toolchain, write the plan, then build and run Phase 1 immediately; continue through subsequent phases as tool access and user-approved operations permit. Do not ask me to manually write code. Do not substitute fake/demo interactions for real business logic. Avoid unnecessary clarifications; use documented safe defaults when policy is not specified, clearly flag accountancy/legal decisions for review. Do not perform destructive operations or expose the business system externally without explicit approval. Do not report completion without proof.
