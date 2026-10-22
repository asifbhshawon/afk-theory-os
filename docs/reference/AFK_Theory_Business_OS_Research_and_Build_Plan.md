# AFK THEORY Business OS — Architecture and Build Blueprint
**Research date:** 22 October 2026  
**Business:** AFK THEORY (Bangladesh)  
**Founders:** Shawon, Rafi, Tousif, Midhat, Mueid  
**Objective:** Replace a starter accounting/operations spreadsheet with a dependable, fully owned, local-first, self-hosted, multi-user clothing-business application.

> **Status:** Planning / architecture recommendation. No application, database, remote-access service, or backup job has yet been deployed or tested. Policies and accounting flows should be reviewed by the business's accountant before actual operations.

## 1. Decision
Build a **modular monolith** using **Next.js + TypeScript + PostgreSQL + Drizzle ORM + Docker Compose**. Run it initially on one Windows PC using Docker Desktop / WSL2 and later move the identical containers to a dedicated Linux mini-PC or server if all-day uptime becomes critical. Put all writes in **one central PostgreSQL database**, and let all five partners use the browser. Secure remote browser access with **Cloudflare Tunnel + Cloudflare Access** (protect the app before publishing), using your own domain. Keep business documents in persistent private storage; back up both database and documents to an external local device and encrypted Cloudflare R2 storage. Do not expose PostgreSQL to the internet.

**Why not five independently writable PCs?** Multi-master offline database synchronisation introduces conflict and split-brain accounting/stock risks. A central server is safer; a backup permits recovery on a different host but does not provide automatic failover. A cold standby can be added later.

**Important:** The serving computer must remain on and network-connected for remote use; the LAN may continue working without internet if local authentication and the app are available. A local-first central database is not equivalent to offline operation for all devices. An internet outage can prevent Cloudflare-mediated access while LAN access still works.

## 2. Investigation of the uploaded workbook
The source workbook `AFK_Theory_Business_Manager(1).xlsx` has **18 worksheets**:
`Dashboard`, `Settings`, `Financial Report`, `Partner Report`, `Accounts`, `Partners`, `Entries`, `Items`, `Lots`, `Stock Log`, `Production`, `Sales`, `Contacts`, `Ideas`, `Reconciliation`, `Checks`, `Event Guide`, `Read Me`.

Strengths to preserve:
- Five founders set to 20% ownership and 20% profit sharing each, with those values maintained separately.
- BDT-based finance; cash/bank/bKash/Nagad; approved entries and reviewer fields.
- Item/SKU, lot, stock log, production, sales and customer/vendor contacts.
- Reconciliation, error checks, financial dashboard and partner report.

Limitations to remove in the web app:
- Workbook preallocated capacity: 500 finance rows; 200 sales/stock rows; 100 production/lot rows, rather than unlimited database rows.
- Sheet rows/formulas are not a reliable security or transactional control plane for simultaneous users.
- Current summary entries cannot substitute for a real general ledger; data model must store immutable posted journals and detailed journal lines.
- Source-of-truth for approved cash, stock movements, orders and factory production must be explicit and cross-linked.
- Attachments, notifications, approval workflow, remote auth, backup-and-restore, and PDF template management need native application features.

Do **not** migrate Excel formulas into the core accounting engine. Map workbook records into the normalized database. Import masters (contacts, products, accounts, partners) first; import transactions only after checking opening balances and duplicate references. The workbook appears to be a prepared starting template rather than an established ledger populated with actual transactions.

## 3. Architecture
```
PC / Phone / Tablet (five individual accounts)
             |                                      Local Wi-Fi / LAN
             | Remote browser                      /        |
     Cloudflare Access (identity)                 /         |
             |                                  /          |
     Cloudflare Tunnel (outbound-only)          /           |
             +-------------------------------> Reverse proxy (Caddy/Nginx)
                                                      |
                                              Next.js web/API server
                                              /       |          \
                                        Worker   PostgreSQL   Private files
                                     (PDF/jobs)   volume       volume
                                                      \          /
                                                Backup scheduler
                                                  /          \
                                            Local drive    encrypted R2
```

**Deployment principles:** Docker Compose for small-business scale, named durable volumes, one internal network, health checks, resource limits, no public DB ports, migration runner, backups outside request handlers, and independently testable services. Multi-stage Next.js standalone Docker image; no secrets in source control.

**Baseline software:**
- Next.js App Router + TypeScript; server-side business services/route handlers.
- PostgreSQL (supported fixed major version, upgraded deliberately), Drizzle ORM + versioned SQL migrations.
- Schema validation with Zod and PostgreSQL constraints. Amounts stored as `NUMERIC(18,2)` / integer minor currency units; never JS floating-point arithmetic for accounting.
- Stable session/auth library with per-user sessions, strong password hashing, optional passkeys/TOTP, password-reset and session invalidation. Authorization enforced on every server operation.
- Tailwind CSS + a well-supported accessible component system; charting on aggregated server data.
- Worker process for PDF generation, emails (future), imports and scheduled reports; PostgreSQL-backed jobs initially, not Redis unless required.
- HTML/CSS print templates rendered to PDFs by Playwright Chromium worker; optional CSV/XLSX exports.
- Private file storage on durable volume with database metadata, hashes, access control, and full backup coverage; optional S3 backend in future.
- Cloudflare Tunnel **with Access policy** protecting the complete app, or a commercially licensed private VPN. No public open router port / direct DB exposure.

## 4. Full product modules and major capabilities

### 4.1 Global dashboard
- Overview: balance by wallet, BDT in/out, receivable/payable, net sales, margin, stock at cost, pending orders, open production, outstanding COD, overdue debts, pending approvals and backup health.
- Date-range controls; per-drop profit; per-product profitability; current-period vs previous-period comparisons.
- Drill-through from every number to constituent journal/order/stock records.
- A configurable "requires attention" feed: negative-stock attempts, unreviewed costs, overdue factories, COD aging, stale backup.

### 4.2 Partners, equity and governance
- Five founder records: initial ownership 20% each and separately configurable profit-sharing percentages.
- Record equity contributions, founder loans, expenses paid personally, reimbursements, withdrawals, approved distributions, transfers and evidence.
- Separate **ownership**, **capital ledger**, **loan balances**, **drawings**, **profit allocation**. Cash contributed is not automatically sales income.
- Partner dashboard and period statements; legal changes to ownership require effective-dated approval and attachment of the agreement.
- Roles not hardcoded to owner names; changing operational roles does not change shareholding.

### 4.3 General ledger and core accounting
- Configurable chart of accounts, financial periods, fiscal year, opening balances, journals, journal lines, source references and audit history.
- Every posted journal has >=2 lines and total debit == total credit; posting occurs atomically within a DB transaction.
- Draft -> submitted -> approved -> posted -> reversed/corrected; never silently edit posted values.
- Income statement, balance sheet, trial balance, cash-flow reporting, general ledger, cash/bank book, expense-by-category, owner and vendor statements.
- Accrual-appropriate revenue/COGS and separate payment movements. Support tax/discount/returns without hardcoded tax assumptions.
- Payment reconciliation; bank/bKash/Nagad cashboxes; transfers recorded as two-sided postings, not as expenses.
- Multi-currency extensibility but **BDT default**, avoid adding FX complexity until actual need.

### 4.4 Cash, expenses, payment accounts and vouchers
- Cash, bank, bKash, Nagad, courier COD suspense and configurable wallets.
- Deposits, withdrawals, refunds, transfer fees, supplier payments, advance payments, petty cash and owner reimbursements.
- Categories and custom tags; split cost centers (collection, drop, order, product, production batch).
- Receipts, proof images/PDFs, payment references, reviewer, voucher numbering, printable payment/receipt vouchers.
- Approval thresholds configurable by BDT amount and risk; no self-approval for sensitive actions.

### 4.5 Procurement, vendor management
- Supplier/factory/courier/customer contacts, terms, credit limits, contracts, reference files and payment aging.
- RFQ / purchase request -> approval -> purchase order -> partial receipt -> invoice matching -> settlement.
- Separate prepayments/advances vs goods received vs final cost; landed costs can be allocated to item lots.

### 4.6 Products, collections and pricing
- Collection/drop, designs, variants, SKU per size/colour/fit; images, barcodes/QRs (future), brand labels, print techniques and status.
- Purchase cost, estimated COGS, actual lot cost, target retail, margin, discount rules, price history, tags, published/archived state.
- Stockable finished product, blank garment, material, consumable and service item types.
- Versioned recipes/BOMs (components per garment or printing job), reference artwork files and design approvals.

### 4.7 Fabric, manufacturing and quality
Three production routes:
1. Buy finished products, stock by SKU and lot.
2. Purchase blanks and add internal or outsourced printing, embroidery, wash, finishing and packaging.
3. Buy fabric, issue it to garment factory, record material quantity and wastage, track work in progress, pay factory and receive good/defective garments.

Track fabric by unit (metre, yard, kilogram, roll), colour/lot/vendor, conversions with validation, issue and returns; subcontract material ownership and location; factory order cost breakdown; fabric wastage; samples; design BOM; labour, tags, transport, rejects/rework; good/defective units; outstanding finished units and raw materials; milestone dates and proof-of-delivery.

**Cost allocation policy** must be explicit (e.g. actual identifiable materials + actual direct production charges + apportioned batch-specific direct overhead); do not divide cost by planned units when fewer good units are received without a configured treatment for defect/scrap.

### 4.8 Inventory and warehouses
- Immutable stock movement ledger with cause + source document, stock locations (own shelf, factory, in transit, damaged, returns).
- Reservations vs physical on-hand vs available-to-sell, low stock alerts, stock transfers, count adjustments, write-offs and spot counts.
- Lot/serial traceability; initial FIFO/actual-lot costing by lot, decide costing method before first post.
- Prevent stock going below zero on successful inventory posting unless explicitly authorised and logged.
- All stock and financial postings occur as one atomic workflow or using carefully designed reliable event processing.

### 4.9 Sales, orders and courier COD
- Manual orders from Facebook, Instagram, WhatsApp, in-person sales and website/API imported orders.
- Multi-line orders, customer delivery info, shipping zones, coupons, discounts, delivery fees, invoices, status history and payment methods.
- Draft -> confirmed -> packed -> shipped -> delivered / cancelled / returned, including partial fulfilment, advance, partial and split payments.
- Return/exchange/RMA workflows linked to original sale and lot; restockable vs defective decisions; correct reversal of revenue and COGS.
- Courier dispatch and settlement batches; COD collected vs money actually remitted, payout date, courier fee, penalty and shortfall; aging report.
- Future Medusa ecommerce integration via API/webhooks with signature validation, idempotency keys and duplicate/order mapping. Avoid importing every state change as a fresh sale.

### 4.10 Files, reports and documents
- Logo/letterhead and document themes, versioned templates, bilingual/Bangla labels and BDT formatting.
- PDF: sales invoice, order confirmation, payment receipt, expense voucher, partner capital statement, monthly partner report, production order, goods received note, stock count sheet, purchase order, vendor account statement, courier settlement, income statement, balance sheet, cash flow, audit pack.
- Report date range, filter by partner/drop/SKU/lot/channel/factory; export CSV/XLSX/PDF; scheduled monthly snapshots.
- Sensitive reports permissioned. Each generated report records filter selections, template revision, generation timestamp and user.

### 4.11 Ideas, work management and governance
- Idea/reference board, product design pipeline, expected/actual budgets, team assignments, milestones, comments, approvals and attachments.
- Notifications for pending approvals, overdue purchase orders/production, reconciliation and backups.
- A decision register for five partners with approval votes / discussions (start as simple comments + signed decisions).

### 4.12 Settings and safe customisation
- Custom categories, tags, transaction types, payment methods, locations, drop stages, order status display labels, notes and attachment requirements.
- Custom fields backed by typed field definitions with validations, ACLs, required flags and indexed search for common dimensions.
- Approval threshold matrix, report layouts, numbering prefixes, dashboard widgets, permissions, business logo and UI density/theme/language.
- **Never** allow arbitrary UI-defined accounting logic or SQL that can bypass ledger balancing, immutable posting, or permissions. Extensions use typed configuration, not changes to fundamental invariants.

## 5. Transaction examples and non-negotiable invariants
A normal scenario:

| Event | Ledger debit | Ledger credit | Operational consequence |
|---|---|---|---|
| Shawon contributes ৳50,000 as equity | Bank / cash 50,000 | Partner capital 50,000 | Equity increases; not revenue |
| Fabric bought for ৳15,000 in cash | Raw material inventory 15,000 | Bank / cash 15,000 | Fabric lot received |
| Fabric issued to factory | Work-in-progress inventory | Raw materials inventory | Fabric changes custodian/location and enters production |
| Direct production cost paid | Work-in-progress inventory | Bank / cash | Adds to batch cost |
| Good garments received | Finished goods inventory | Work-in-progress inventory | Production lot / SKU qty created |
| COD order fulfilled and sale recognised | Courier receivable | Sales revenue (and tax liability where applicable) | Stock consumed and COGS posted in linked journal |
| Courier remits ৳930 from ৳1,000 COD, keeps ৳70 service fee | Bank 930 and courier expense 70 | Courier receivable 1,000 | COD reconciliation closes |

Before implementing, agree a written posting policy for revenue recognition, freight, discounts, taxes, supplier advances, write-offs, returns, capital changes, WIP absorption and business/personal expenses. An accountant should approve these treatments.

**Enforce:** balanced journal; idempotent source document; unique human-readable reference within defined scope; immutable posted transaction; matching stock movements and COGS; no lost updates under concurrent users; explicit `created_at`, `created_by`, `approved_by`, `posted_at`, `reversal_of`; all sensitive approvals and downloads logged.

## 6. Proposed PostgreSQL data model
Use UUID or time-sortable IDs as internal primary keys plus human references such as `AFK-PO-2026-0001` and `AFK-JRN-2026-0001`. Use foreign keys, indexes, uniqueness, check constraints, soft-archive for master records, and reversible posted documents. Suggested domain entities:

| Domain | Core tables |
|---|---|
| Identity and governance | `businesses`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `approval_policies`, `approval_requests`, `audit_events`, `settings`, `custom_field_definitions`, `custom_field_values` |
| Finance | `fiscal_periods`, `accounts`, `journal_entries`, `journal_lines`, `payment_accounts`, `payment_transactions`, `bank_reconciliations`, `bank_reconciliation_lines`, `tax_codes`, `attachments` |
| Partners | `partners`, `ownership_history`, `capital_movements`, `partner_loans`, `partner_drawings`, `distribution_decisions` |
| Catalog and stock | `items`, `product_designs`, `product_variants`, `collections`, `bill_of_materials`, `bom_lines`, `inventory_lots`, `locations`, `stock_movements`, `stock_reservations`, `stock_counts`, `stock_count_lines` |
| Procurement and manufacturing | `contacts`, `supplier_invoices`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `production_orders`, `production_material_issues`, `production_outputs`, `quality_inspections`, `production_costs` |
| Sales and logistics | `customers`, `sales_orders`, `sales_order_lines`, `fulfilments`, `returns`, `return_lines`, `refunds`, `courier_shipments`, `courier_settlements`, `courier_settlement_lines`, `integration_events` |
| Planning and systems | `ideas`, `tasks`, `comments`, `documents`, `document_templates`, `report_runs`, `outbox_events`, `background_jobs`, `backup_runs`, `notification_events` |

This is an **initial logical inventory**, not the final migration count. Some tables may be consolidated or expanded after detailed design; do not create every table prematurely. Use indexed `business_id` where future multiple businesses or branches could be supported.

### Concurrency and accounting safety
- Use PostgreSQL ACID transactions for one business action, journal posting and stock effects.
- Unique idempotency keys for ecommerce imports, couriers, payment gateways, CSV imports and retried UI submissions.
- Database constraints and service validation both enforce conservation of value; ledger posting validates debit=credit inside transaction.
- Stock lots under row-level locks or appropriate serializable/optimistic concurrency to stop selling the same last item twice.
- Avoid calculating authoritative balances by writing to mutable "balance" fields without reconcilable source movements.
- Never let cancellation remove financial history: post formal reversals.

## 7. Remote access options and costs
| Option | Access | Assessment |
|---|---|---|
| Local-only network | Other devices on same LAN, no internet needed for local app | Good development and small-office use; no remote work |
| **Cloudflare Tunnel + Access** | Browser remotely, user passes Cloudflare Access policy then app login | **Recommended for five partners**; Cloudflare Access free plan advertises up to 50 users; a domain is normally required; configuration/security still essential |
| Tailscale Standard (business-appropriate) | Install private-network client per user/device | Good alternative, but paid for commercial use; Tailscale Personal free is stated to be non-commercial despite 6-user limit |
| Public port-forwarding | Anyone can reach exposed origin | **Not recommended** |
| Cloud VPS | Always-on hosted app + DB or tunnel | Better availability but recurring server and backup cost; retains portability of Compose stack |

Access controls: first create and test Cloudflare Access identity policy, then enable the published tunnel route. Do not expose an unprotected internal app via a public hostname. Even with Cloudflare Access, retain application-level role permissions and secure sessions.

## 8. Data protection and disaster recovery
**Three-copy minimum:** operational data on the host; independent local backup to a different disk; off-site encrypted backup in R2. A backup is not useful until restored in a test environment.

### Recommended launch backup policy
- Database: scheduled **nightly logical backup** with `pg_dump -Fc` to a temporary dedicated backup directory. `pg_dump` is a consistent logical export; do not copy live PostgreSQL data directories arbitrarily. Later consider 6-hour snapshots for active trading.
- Files: include private uploads, report templates and contracts with a manifest/hash list, plus `compose.yaml`, non-secret deployment configuration, migration versions and app release identifier.
- Off-site: client-side-encrypt artifacts with restic to private Cloudflare R2 S3-compatible bucket. Keep credentials and recovery password offline/in a trusted password manager (not in Git).
- Local: secondary external SSD/NAS, physically independent from the main Docker disk. Ideally encrypted.
- Retention starter policy: daily backups 14 days, weekly 8 weeks, month-end 12 months **subject to storage capacity and record-retention legal requirements**.
- Integrity: after each run record success/failure, snapshot ID, time and last verification. Periodically run repository checks, monthly full restore drills to an isolated disposable DB, and compare account totals, orders, inventory and document counts.
- Alert when backup age exceeds a chosen threshold or restore checks fail.
- When business scales: move DB to pgBackRest with base backups and archived WAL for point-in-time recovery; this requires higher administration effort/storage monitoring but can reduce data-loss window.

**RPO/RTO design targets (not guarantees):** a nightly backup allows up to 24h of recent data to be lost; 6-hour dumps allow up to 6h. Define an actual recovery-time objective only after rehearsal on a spare PC. Zero-loss recovery requires additional replication/log archiving and a robust failover plan.

Cloudflare R2 standard's published free tier is **10 GB-month storage**, 1 million Class A operations and 10 million Class B operations/month, with no egress charge; storage/operation prices beyond the free allowance apply. Cloudflare states that R2 bucket locks can prevent overwrite/deletion for retention periods, but **do not** activate broad locks on active restic repository prefixes before testing: ordinary backup pruning and retention may need to delete objects. For WORM retention use separate archival snapshots/prefixes and verify compatibility and quota.

### Recovery playbook
1. Acquire spare computer; install Docker/WSL2 if on Windows or Docker Engine on Linux.
2. Restore source code/config release and securely re-add secrets; retrieve encryption credentials.
3. Verify the backup checksum and restic repository, download chosen snapshot.
4. Bring up PostgreSQL container isolated; restore `pg_restore` dump plus all document assets.
5. Apply only compatible migrations and run read-only verification checks; compare sample customer invoices, journals, inventory and partner statements.
6. Update tunnel origin / private DNS to new host; rotate any potentially compromised credentials.
7. Record the restore result, downtime, recovery point and sign-off by two partners.

## 9. Security and approval design
- Five separate accounts with unique passwords; optional strong 2FA/passkeys.
- Roles: System Administrator, Finance Manager, Operations/Inventory Manager, Sales Operator, Partner Viewer, External Accountant (read-only except explicitly delegated tasks). Each founding partner can hold multiple roles.
- Policy matrix: read, create draft, submit, approve, post, reverse, export, configure, manage identities. Per-module and optionally per-money-threshold permissions.
- Security checks enforced **server side** and tested; hiding a button is not security.
- No approval of your own sensitive withdrawal, ownership change, capital distribution, deleted attachment or period close.
- Immutable application audit events + logged changes; database admin superusers still can rewrite underlying records, so backups/signed reports and separation of duties are vital.
- CSRF safeguards, secure cookies, HTTPS for remote clients, rate limits, input validation, parameterized SQL, file type/size screening, log redaction, dependabot/security scanning, secret rotation, owner-controlled backup credentials, periodic restore drills.
- Customers' names/phones/addresses visible only to roles that need them. Define retention/deletion procedure.
- Period close locks normal edits and requires authorised adjustment in new period.

## 10. UX and navigation
Desktop: left grouped sidebar, responsive top search, date/filter toolbar, notification/inbox and action panel. Mobile: a separate compact design with bottom navigation for Dashboard, Orders, Add, Inventory, More; accessible typography/tap targets, simplified forms and photo receipt capture. Bengali/English display option with correct Unicode font and both local and international date display; store `timestamptz` in UTC and present `Asia/Dhaka` local dates.

Main navigation: Overview; Money & Accounting; Partners; Products & Inventory; Purchases & Production; Sales & Delivery; Contacts; Tasks & Ideas; Reports; Approvals; Settings; Backup & Security.

Every main workflow should have list, details, filters, create, draft, activity timeline, approval, linked docs and export. Never display decorative actions that are not implemented.

## 11. Existing ecommerce integration strategy
AFK THEORY may continue its Next.js storefront with the existing Medusa backend. Business OS must initially work standalone for Facebook/Instagram/WhatsApp/manual sales. Later add a separate **integration adapter**:
- Store remote order IDs, webhook IDs, source channel and last sync state; verify webhook signatures.
- Map Medusa variant ID to AFK SKU and payment/delivery states to internal order states.
- Apply an idempotency guard so repeated webhooks never duplicate a sale or stock withdrawal.
- Define source of truth: storefront drives shopping cart/order events; Business OS drives accounting, purchasing, stock valuation and partner reports. Avoid two systems independently decrementing stock.
- Validate refunds, partial fulfilments, COD remittance, order cancellation, shipping charges and price overrides.
- Provide re-sync, retry queue, import preview and exception dashboard.

## 12. Phase-gated development plan (no calendar promise)
| Phase | Scope | Exit / acceptance |
|---|---|---|
| **0. Domain design and approvals** | Agree accounting policies, custom fields, SKU/lot convention, partner authority, flows; map Excel | Signed workflow/spec and example transactions reconciled manually |
| **1. Infrastructure and security foundation** | Next.js shell, Docker Compose, Postgres, migrations, auth, roles, file store, seeds and test runner | New PC can boot app; login and access restrictions pass; sample DB restored |
| **2. Financial foundation** | Partners, accounts, journal, cashbox, deposits/expense/transfers, approvals, receipts, cash report | Balancing, reversals, self-approval prevention and period checks pass |
| **3. Catalog, purchasing and stock** | SKUs, lots, purchase orders, receiving, stock ledger, costing, barcode-ready labels | Stock purchases/transfers/counts track correct quantities/costs under concurrency |
| **4. Production and quality** | BOM, factory POs, material issues, blanks customization, WIP, defects, final receipts | Three clothing production routes produce traceable finished-lot cost and remaining material report |
| **5. Sales, return and COD** | Manual/social orders, fulfilment, stock reserves, returns, courier recon, cash and revenue | Partial/cancel/return and COD payout scenarios reconcile exactly |
| **6. Analytics, PDFs and review** | Dashboards, finance reports, partner statements, exports, month-end close | Report numbers trace to source transactions and pass sample accountant checks |
| **7. Remote security and disaster readiness** | Cloudflare Access/Tunnel, encrypted offsite backups, alerts, restore playbook | All five users login with correct permissions; restore to fresh PC and verify documents/data |
| **8. Ecommerce integration and automation** | Medusa adapter, webhook queue, notifications, reports and advanced customizations | Duplicate/out-of-order webhook tests pass with no duplicate inventory/accounting effects |

**Mandatory testing at each phase:** unit and property tests for posting and stock invariants; DB integration tests on disposable PostgreSQL; end-to-end browser workflows on desktop and mobile; permissions matrix; concurrent order tests; backup-and-restore drill; accessibility, validation and PDF render checks.

## 13. Example acceptance scenarios (implement as executable tests)
1. 5 founding partner accounts exist with 20% ownership; role changes do not affect the shares.
2. A 20,000 BDT equity contribution raises bank/capital by 20,000 without raising sales.
3. Partner loan and reimbursement are separate from capital and expense posting.
4. Invalid journal where debit != credit is rejected before posting.
5. Repeated click/webhook for the same payment posts exactly one transaction.
6. Two simultaneous users cannot fulfil the only remaining SKU unit twice.
7. When fabric is issued to factory, stock location/ownership and WIP trace remain coherent.
8. Finished production lot cost includes configured direct costs and handles rejects explicitly.
9. Sales by size and colour flow to the correct lot and cost of goods sold.
10. Cancellation before fulfilment releases reserved stock; fulfilment and return execute defined reversal policy.
11. COD courier settlement correctly records gross receivable, fee, remittance and difference.
12. Expense voucher PDF shows unique ref, date, reason, approver, payment account and attachment hash/ref.
13. Accountant can inspect but not alter a posted journal or other owners' access.
14. Partners see same up-to-date dashboard and reports on different devices.
15. Cloudflare Access blocks unauthorised email, even before AFK login screen.
16. A full fresh-computer restore reproduces database, documents, user roles and generated report data.
17. A month-end close stops ordinary past-period edits; authorised correcting journal remains auditable.
18. Medusa repeated webhook/out-of-order event does not duplicate payment/revenue/COGS.

## 14. Repository and deployment layout
```
afk-business-os/
  apps/
    web/                      # Next.js App Router UI and API
    worker/                   # Background jobs and PDF generation
  packages/
    db/                       # Schema, migrations, seeds
    domain/                   # Ledger, stock, production, order services
    ui/                       # Reusable responsive components
    config/                   # Shared validation/config
  infra/
    compose.yaml
    compose.dev.yaml
    Dockerfile.web
    Dockerfile.worker
    reverse-proxy/
    backup/
  docs/
    decisions/
    operations/
    accounting-policy.md
    permissions-matrix.md
    recovery-runbook.md
  tests/
    integration/
    e2e/
  .env.example                 # No actual secrets
  README.md
```
Release should include documented commands for start/stop/update, back up, restore, seed demo, import, export, smoke test, clean failure recovery and rotation of secrets. Never include user actual customer data in test fixtures or git history.

## 15. Rough ongoing cost categories (not quotations)
| Component | Expected initial model | Notes |
|---|---|---|
| Application and PostgreSQL | No software licence cost | Hardware, labour, electricity and maintenance still cost money |
| Docker Desktop | Free for qualifying small businesses | Official criterion: <250 employees AND <$10M annual revenue |
| Local hosting | Reuse existing PC | Needs uptime and backups; small UPS + external storage recommended |
| Cloudflare Access | Free tier advertised up to 50 users | Configure identity restrictions; current plan terms can change |
| Cloudflare Tunnel | Setup as documented with own domain | Domain usually an annual cost; protect with Access |
| Cloudflare R2 | First 10 GB-month free on Standard class | Overages charged; backup retention/objects consume allowance; account setup may require billing method |
| Private VPN alternative | Tailscale business tier paid | The Personal plan may not be used as a business-free shortcut |
| Email/SMS/WhatsApp APIs | Optional ongoing cost | Only after integrations are needed |
| Accountant/legal compliance review | Professional service, if engaged | Important before calling PDFs financial statements or compliant tax invoices |

## 16. Open business decisions to resolve during Phase 0
These are policy decisions, not blockers to drafting a source-controlled skeleton:
- Legal entity and VAT/tax registration status; accountant's required invoice format and record retention.
- Named custodian and reviewer; single-vs-dual approval thresholds.
- Stock costing method (actual-lot/FIFO recommended for initial apparel lots) and WIP/defect treatment.
- Whether receiving stock is allowed before supplier invoice, and how landed costs are allocated.
- Revenue recognition point for COD/partial deliveries and courier fees.
- Whether office host can remain on, external-drive availability, backup cloud budget, domain ownership.
- Who may access customer addresses and partner balances.
- Initial connection timeline to Medusa storefront.

## 17. Research sources — primary documentation
- Next.js deployment and Docker support: https://nextjs.org/docs/app/getting-started/deploying
- Next.js self-hosting/security proxy: https://nextjs.org/docs/app/guides/self-hosting
- Docker Next.js container guide: https://docs.docker.com/guides/nextjs/
- Docker Desktop licensing: https://docs.docker.com/subscription-billing/desktop-license
- Docker Desktop on Windows/WSL2: https://docs.docker.com/desktop/setup/install/windows-install/
- PostgreSQL consistent logical dump: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL WAL/PITR: https://www.postgresql.org/docs/current/continuous-archiving.html
- Drizzle transactions and migrations: https://orm.drizzle.team/docs/transactions and https://orm.drizzle.team/docs/migrations
- Next.js auth guidance: https://nextjs.org/docs/app/guides/authentication
- OWASP authorization practices: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/get-started/
- Cloudflare Access for self-hosted apps: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- Cloudflare Zero Trust prices: https://www.cloudflare.com/plans/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/get-started/s3/
- Cloudflare R2 bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Tailscale licensing/price: https://tailscale.com/pricing
- restic repository/backup docs: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html
- pgBackRest backup/WAL options: https://pgbackrest.org/user-guide.html
- Playwright PDF generation: https://playwright.dev/docs/api/class-page#page-pdf
- Bangladesh NBR VAT regulations: https://nbr.gov.bd/regulations/gos/vat-gos/

**Tax caution:** NBR web FAQ and compliance guide pages currently return inconsistent threshold descriptions; avoid baking a turnover threshold, VAT amount or invoice assertion into code. The September/June 2026 NBR orders and applicable SROs need accountant verification before official tax invoice templates or tax calculations go live.
