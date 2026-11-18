# Plan: Easy Local Sales + Live Partner Dashboard (Vercel Free Tier)

Goal: make selling fast and hard to get wrong in the **local OS**, and make every
sale, order, deposit and expense visible in a **better-looking partner portal** —
without a rewrite. Both apps keep their current architecture and design tokens.

---

## 1. What exists today (audit)

**Architecture (keep it):** local Next.js + Postgres ERP is the authority. The
"Sync to Cloud" button pushes a sanitized read model straight into **Supabase**
(`src/server/services/cloud-sync.ts`). The portal on Vercel only *reads* Supabase
(`apps/partner-portal`, every page `force-dynamic`).

### Local sales/orders (`src/app/orders/page.tsx`, `services/sales.ts`)
| Problem | Evidence |
|---|---|
| One item per order only | form posts a single `variantId`; service already accepts `lines[]` |
| Price ignores the product | price field hard-coded to `1200`, though `product_variants.selling_price` exists |
| No stock visibility while selling | SKU dropdown shows `sku (size/color)` only; out-of-stock is discovered *after* submit as a thrown error |
| Delivery charge / discount / channel / notes can't be entered | service supports them, form doesn't expose them (channel always `MANUAL`) |
| "Ship" asks for nothing | `handleShipOrder` form only has a hidden `orderId` → courier and waybill are never captured, though the handler reads them |
| No way to cancel | `CANCELLED` status exists but no action; reserved lots can never be released |
| No order detail / timeline | list shows number, customer, total, status only — no items, no profit, no "what's next" |
| No search / filter / status tabs | fixed `limit(50)` table |
| Courier settlement is manual retyping | user re-enters COD amount per order, one order at a time; amount isn't pre-filled from the order |
| Errors are raw thrown exceptions | server actions throw; no inline validation/toast |
| Every action = full page reload | no optimistic UI |

### Cloud sync (`portal-sync.ts`, `cloud-sync.ts`)
- **Manual only** — partners see stale data until someone presses the button.
- **No sales, no transaction ledger** in the read model. Portal gets only KPI
  totals, 8 recent journals, wallet balances, partner statements.
- Delete-all + re-insert for ventures/batches/alerts/feed on every push.
- **Accuracy bugs found while reading:**
  - Low-stock alerts are computed from `lots … limit(10)` *then* filtered → most
    alerts are silently missed; also per-lot instead of per-SKU.
  - `courierPendingSettlements: 0`, `ventureContributions: 0` are hard-coded;
    ventures never fill `salesProgress` / `productionProgress`.
  - Partner "profit share" history row uses a hard-coded date (`2026-10-26`) and
    ref `GL-ALLOC-OCT2026`.
  - Partner email is synthesized as `<name>@afktheory.com`.

### Portal UI (`apps/partner-portal`)
- Top tab bar with 7 items, KPI cards, plain lists. **No charts, no sales page,
  no money-in/money-out view**, no trend or period comparison, no filters.
- Numbers are totals only — a partner can't answer "how much did we sell this
  week?" or "what was spent on Tuesday?".

---

## 2. Vercel free-tier ground rules (design constraints)

Verify current limits on vercel.com/pricing before launch; design so we're far
from them regardless:

1. **No heavy work on Vercel.** All aggregation happens locally at sync time; the
   portal reads small pre-computed rows. No joins over thousands of rows per page.
2. **Cache reads, invalidate on push.** Wrap portal queries in `unstable_cache`
   with one tag (`portal-data`). Local ERP calls a tiny
   `POST /api/sync/revalidate` (existing `SYNC_SHARED_SECRET`) after each push →
   pages are static-fast between syncs and cost ~0 DB queries. This also protects
   the Supabase free DB and the portal's 2-connection pool.
3. **No cron dependency** (Hobby cron is daily-only). Freshness is driven by the
   local push, not by Vercel.
4. **Keep functions short** (<10 s default): sync push goes local → Supabase
   directly (already true), never through a Vercel function.
5. **No chart library, no image optimisation.** Hand-rolled SVG charts (tiny
   bundle, no `next/image`/sharp usage on Vercel's metered optimiser).
6. **Use the Supabase pooler URL** (transaction mode) for Vercel. Keep detail
   rows bounded (last ~12 months); aggregates kept forever → stays well under the
   free 500 MB DB. Local pushes also keep a free Supabase project from pausing.

---

## 3. Target experience

### 3A. Local OS — "sell in 20 seconds"
**Sales workspace** (`/orders`) becomes a 2-pane screen, same tokens/components:

- **Quick Sale drawer** (primary button, also `N` shortcut + dashboard button)
  - SKU search-as-you-type (name / SKU / size / colour) showing **live available
    stock** and auto-filling **selling price** (editable, with margin hint).
  - Multi-item cart, per-line qty/discount, order discount, delivery charge
    preset by zone (Inside/Outside Dhaka defaults in settings).
  - Channel chips (Facebook / Instagram / WhatsApp / Website / In-person).
  - Payment: COD (default) or *Paid now* (cash / bKash / Nagad / bank) → records
    the deposit in one step.
  - Returning-customer lookup by phone (autofills name/address from past orders).
  - Inline validation + out-of-stock warning *before* submit; success toast with
    "Print invoice" / "Add another".
- **Status board** — tabs/columns: New → Packed → Shipped → Delivered → Settled
  (+ Returned / Cancelled). Search, date range, channel filter, count badges.
- **Order detail slide-over**: items, totals, COGS & profit, timeline of status
  changes, customer, courier/waybill, linked journals, proof upload, actions.
- **One-tap next action** per order, with the missing info asked in a small
  modal: *Ship* → courier + waybill (required); *Delivered*; *Cancel* → releases
  reservation; *Return* → prefilled from order lines.
- **COD reconciliation table**: courier-grouped list of delivered-unsettled
  orders, tick several, COD amount auto-filled, enter courier fee once (or per
  order), pick deposit account → one settlement journal (service already accepts
  `settlements[]`).
- **Daily strip** at top: today's orders, sales, COD pending, to-ship count.

**Local UI polish (not a redesign):** consistent page header + KPI strip,
status pills with one colour system, sticky table headers, empty states, toasts
instead of thrown errors, keyboard shortcuts, mobile-friendly forms.

### 3B. Partner Portal — "see everything, beautifully"
Keep the olive/charcoal brand, replace the top tab bar with a **left sidebar on
desktop / bottom bar on mobile**, and add real data pages:

| Page | Content |
|---|---|
| **Overview** (redesign) | Hero KPI row with sparklines & vs-last-period deltas (Sales, Orders, Net profit, Cash); 30-day sales/expense/deposit chart; wallet strip; "needs attention" (COD pending, low stock, overdue batches); live activity ticker; sync freshness pill ("Live · synced 2 min ago") |
| **Sales** (new) | Period switcher (Today / 7d / 30d / Month / Custom); revenue + orders + units + AOV + margin; trend chart; channel & zone breakdown; top products; order-status funnel; searchable orders table → order drawer (items, status timeline, courier, profit) |
| **Money** (new) | Cash-flow chart (in vs out); filterable ledger of **deposits, expenses, drawings, loans, courier settlements, returns, transfers**; category donut for expenses; per-wallet balances & movement |
| **Inventory & Production** | Merge alerts + batches: stock by product, low-stock list, batch progress bars |
| **My Account** | existing partner statement / settlement history, restyled |
| **Ventures / Calendar / Reports / Settings** | keep, apply new shell + components |

Design system additions (shared tokens, no new libs): `StatCard`+sparkline,
`AreaChart/BarChart/Donut` (SVG), `DataTable` (sort, filter, sticky head,
mobile cards), `StatusPill`, `Drawer`, `PeriodPicker`, `EmptyState`,
skeleton loaders, light/dark-safe contrast, tabular numbers, ৳ compact format.

Partners are **read-only** for operational data. No customer name/phone/address
leaves the local machine — portal shows a masked label (e.g. "T. A. · 017••••344").

---

## 4. Data & sync design

### New cloud read-model tables (Supabase, created by `lib/migrate.ts`)
- `portal_sales_orders` — id, order_number, order_date, status, channel,
  city_zone, units, subtotal, discount, delivery_charge, total, cogs, profit,
  payment_status, courier_name, waybill, customer_label (masked), `items` jsonb
  (`[{sku,name,size,color,qty,unitPrice}]`), `timeline` jsonb, updated_at.
- `portal_transactions` — id, date, kind (`SALE | EXPENSE | DEPOSIT | DRAWING |
  LOAN | SETTLEMENT | RETURN | TRANSFER | PURCHASE | REVERSAL`), direction
  (`IN | OUT | NEUTRAL`), title, category, amount, account_label, partner_name,
  venture, journal_no, reversed flag, updated_at. Derived from posted journals +
  `entry_type`/`source_module` (already stored on `journal_entries`).
- `portal_daily_metrics` — one row per day: orders, units, gross_sales, returns,
  cogs, expenses, deposits (cash in), withdrawals, net_cash_change, by-channel /
  by-category jsonb. Charts read **only this table**.
- Existing tables kept. Fill the currently-zero fields (`courier_pending`,
  venture sales/production progress) and fix the low-stock query.

### Sync behaviour
1. **Auto-sync, not button-only.** After any committed sale / order status change
   / expense / deposit / settlement, local calls `schedulePortalSync()`:
   debounced (~10 s), single-flight, fire-and-forget; failures leave a
   "dirty" flag in local `settings` and retry with backoff and on app start.
   The existing button stays as "Sync now".
2. **Incremental upserts** keyed by id + `updated_at`/hash for new tables; delete
   only rows that vanished *inside the sync window* (replaces delete-all).
3. **Revalidate hook**: after COMMIT, ping portal `/api/sync/revalidate` so the
   cached pages refresh immediately.
4. **Honest status**: header pill shows *Live / Delayed / Offline snapshot* from
   `portal_sync_meta`; local header shows *Synced / Pending N / Failed*.
5. Reversals/cancels propagate (rows flagged, not silently dropped) so partner
   views match the ledger.

---

## 5. Phased delivery (each phase shippable on its own)

| # | Phase | Scope | Size |
|---|---|---|---|
| 0 | Data correctness | Fix low-stock query, hard-coded zeros/dates, partner email source; tests | S |
| 1 | Local sales core | Multi-item `createSalesOrder` UI, price autofill, stock-aware picker, ship modal (courier+waybill), **cancel order** service + action, return prefill; toast/inline errors | M |
| 2 | Local sales workspace UI | Status board, order slide-over, search/filters, batch COD settlement, daily strip, shortcuts | M |
| 3 | Sync v2 | New tables + migration, builders for orders/transactions/daily metrics, incremental upsert, auto-sync + outbox/dirty flag, revalidate endpoint, cached reads | M |
| 4 | Portal shell + design system | Sidebar/bottom nav, shared components, SVG charts, new Overview | M |
| 5 | Portal Sales + Money pages | Pages in §3B with filters, drawer, ledger | M |
| 6 | Polish & hardening | Mobile pass, a11y/contrast, skeletons, empty states, perf check, docs update, acceptance tests | S |

Order matters: **0 → 1 → 3 → 4 → 5** gives partners live sales/money data soonest;
**2** and **6** can interleave. Phases 1–2 touch only `src/`; 4–5 only
`apps/partner-portal/`; 3 touches both (service + migration + route) — so 1/2 and
4/5 can run in parallel once Phase 3's table contracts are agreed.

---

## 6. Testing & safety
- Extend `tests/acceptance/06-sales-orders-courier.test.ts` (multi-line, cancel
  releases reservation, ship requires courier, batch settlement).
- New acceptance test for payload builders (orders/transactions/daily metrics
  totals reconcile to the GL: Σ daily gross sales = income statement gross revenue).
- Extend `21`/`22` sync tests: incremental sync idempotent; second push with no
  changes writes 0 rows; PII never present in payload.
- Accounting invariants untouched: all postings still go through
  `postJournalEntry` (balanced, period-locked, reversible).
- Migrations are additive (`CREATE TABLE IF NOT EXISTS`); no destructive change to
  existing portal tables, so the live portal keeps working during rollout.

## 7. Decisions to confirm (defaults chosen if you don't object)
1. Partners see **orders without customer PII** (masked label only). *Default: yes.*
2. Auto-sync after each business event + manual "Sync now". *Default: yes.*
3. Portal navigation: **sidebar on desktop, bottom bar on mobile** replacing top tabs. *Default: yes.*
4. Detail retention in cloud: **12 months**, daily aggregates forever. *Default: yes.*
5. Per-order COGS/profit visible to partners (vs. revenue only). *Default: show — all 5 are owners.*
6. Add courier-fee per-order entry in COD reconciliation (vs. one fee per batch). *Default: per order, with batch default.*

---

## 8. Progress log

**Phase 0 — done** (`src/server/services/portal-sync.ts`)
- Low-stock alerts now computed per SKU over all active lots (available = on hand − reserved), sellable goods only, includes out-of-stock.
- `courierPendingSettlements` = COD value of shipped (in-transit) orders; venture `salesProgress` / `productionProgress` and per-partner `ventureContributions` are now real.
- Profit-share history row uses the sync date and a dated `GL-ALLOC-YYYYMM` ref (was hard-coded Oct 2026).
- **Privacy fix found by the new test:** sales journal descriptions contain "(Customer Name)" and were being pushed into the portal activity feed — customer names are now redacted at sync time.
- Not changed: partner emails (`<name>@afktheory.com`) match the portal's own login constants, so that is consistent, not a bug.

**Phase 1 — done** (`src/server/services/sales.ts`, `src/app/orders/*`, `src/components/orders/*`)
- Service guards: ship only from CONFIRMED/PACKED; deliver only from SHIPPED; return only from DELIVERED with refund ≤ order total; courier settlement rejects double-settling, non-delivered orders and fee > COD; input validation (qty, price).
- New `cancelSalesOrder` (releases reservation; brings stock back from transit if already shipped; audit-logged).
- Idempotency key now coexists with a user note (`IDEMPOTENCY:key\nnote`).
- Orders page rebuilt: Quick Sale form (stock-aware search, price auto-fill, multi-item cart, channel, zone, delivery charge remembered per zone, discount, note, returning-customer autofill, live COD total and est. profit), status tabs + search, expandable rows with items/profit/courier, Ship (courier + waybill required), Delivered, Cancel, Return modals, prefilled COD payout form, toasts instead of error pages.
- Deferred on purpose: "paid now" (prepaid) orders — needs a customer-advance account in the chart of accounts; to be designed with Phase 3.
- Tests: `tests/acceptance/23-sales-order-workflow.test.ts` (7 cases). Verified against a throw-away Postgres DB: full suite 101/103 pass; the 2 failures are `22-local-erp-sync-button` which needs a live `SUPABASE_DATABASE_URL`.

**Phase 3 — done** (sync v2)
- **Cloud read model** (`src/server/services/portal-read-model.ts`, DDL mirrored in `apps/partner-portal/lib/migrate.ts` + Drizzle tables in `lib/schema.ts`, parity enforced by test): `portal_sales_orders` (items, cogs/profit, status timeline, masked customer label), `portal_transactions` (money ledger classified from posted journals: SALE / RETURN / EXPENSE / DEPOSIT / LOAN / DRAWING / REIMBURSEMENT / SETTLEMENT / TRANSFER / PURCHASE / REVERSAL …, direction IN/OUT/NEUTRAL, internal COGS/inventory journals skipped), `portal_daily_metrics` (all-time per-day aggregates incl. by-channel and expense-by-category). Detail rows cover the last 365 days; daily aggregates are kept forever. Day boundaries use Asia/Dhaka.
- **Incremental writes:** every row carries a content hash; a sync reads `(key, hash)` from the cloud, upserts only changed rows in batches, and prunes rows that vanished. Measured on the test data: 2nd push with no changes wrote 0 rows (75 ms vs 120 ms first push).
- **Auto-sync** (`portal-autosync.ts`): `schedulePortalSync()` is called from `postJournalEntry`, order create/ship/cancel and calendar create/update/delete; 10 s debounce (60 s max wait), single-flight, "changes landed mid-push → go again", exponential backoff on failure (30 s … 10 min), persisted dirty flag (`settings.PORTAL_SYNC_STATE`), resumes at server start via `src/instrumentation.ts`, 10-min watchdog. Inert under tests, with `PORTAL_AUTOSYNC=false`, or without a cloud DB URL. The manual button uses the same bookkeeping and the header popover now shows *Auto-sync: Up to date / Changes pending / Retrying*.
- **Vercel side:** `POST /api/sync/revalidate` (shared-secret, timing-safe) drops the `portal-data` cache tag; `lib/portal-data.ts` has cached loaders (`getDailyMetrics`, `getSalesOrders`, `getTransactions`, `getSyncFreshness`) with a 1-hour safety TTL. Verified on a local portal instance: first read 41 ms, cached read 1 ms, 401 without/with a wrong secret, 200 + fresh read after revalidate. Pages are not switched over to these loaders yet — that is Phase 4/5.
- `cloud-sync.ts` also skips TLS for `localhost` cloud URLs so the whole path can be tested against a plain Postgres.
- Known limit: the legacy HTTP route `POST /api/sync/push-summary` (+ `pushSummaryToCloudPortal`) does not carry the new tables; the Sync button / auto-sync use the direct database path.
- Fixed while verifying: daily `unitsBooked` was 0 (correlated subquery lost its table qualifier); cash in/out double-counted funding journals typed `TRANSFER` — now computed per journal and only pure wallet-to-wallet journals are excluded.
- New env (all optional, in `.env.example`): `PARTNER_PORTAL_URL`, `SYNC_SHARED_SECRET`, `PORTAL_AUTOSYNC`. Add `TEST_CLOUD_DATABASE_URL` to run the cloud-write tests.

**Phase 4 — done** (portal shell + design system, `apps/partner-portal`)
- **Shell:** left sidebar on desktop (grouped nav, settings, partner card + sign-out), slim top bar with a freshness pill (*Live* < 30 min, *Updated Xh ago*, amber only after 48 h of silence — the ERP pushes on change, so a quiet day is normal; never needs a network call), and a phone bottom tab bar with four tabs + a *More* sheet. One nav config (`components/shell/nav.ts`) drives all three; Phase 5 adds Sales and Money by appending two entries. Old `PortalHeader` / `PortalNav` / `SyncStatusBadge` removed.
- **Design system** (no new dependencies): `components/ui` (`Card`, `CardHeader`, `Pill`, `orderStatusTone`, `EmptyState`, `Skeleton`, `ProgressBar`, `StatCard` with delta + sparkline, `PeriodPicker` 7/30/90 d via `?range=`), `components/charts` (hand-rolled SVG `AreaChart` with hover tooltip + ResizeObserver, `Sparkline`, `Donut`). `loading.tsx` skeleton for instant feedback.
- **New Overview** (`app/(portal)/page.tsx`): greeting + period picker; KPI row (revenue, orders, net profit, cash) with period-over-period deltas and trend lines; revenue/expenses/cash-in chart; wallet donut; *Needs attention* (orders to ship, COD in transit/awaiting payout, out-of-stock/low-stock, overdue batches); latest orders; money movements; personal position; ventures and factory batches with progress bars; activity feed; upcoming calendar. Falls back to all-time snapshot figures until the first sync of the new daily data.
- **Cache:** the page now reads through `getOverviewSnapshot`, `getPartnerStatement`, `getDailyMetrics`, `getSalesOrders`, `getTransactions` (all tagged `portal-data`) — only the calendar query still hits the database.
- `lib/analytics.ts` (pure, unit-tested in `tests/analytics.test.ts`): Dhaka-day keys, zero-filling, period splits, % change, running-balance reconstruction, channel/category totals.
- Verified against scratch databases: desktop and 375 px phone layouts, More sheet, all 7 existing routes return 200 inside the new shell, `next build` passes (Overview first-load JS 116 kB), no hydration warnings after fixing the sync-pill timestamp.
- Not yet linked: *Latest orders* and *Money movements* have no "View all" because the Sales and Money pages arrive in Phase 5.

**Phase 5 — done** (portal Sales and Money pages)
- **Sales** (`/sales`): 7/30/90-day KPIs with deltas (revenue, orders booked, average order value, gross margin), a booked-vs-recognised trend chart, order pipeline, channel donut, top products, delivery zones, and a searchable, filterable, paged orders list. Tapping an order opens a detail drawer (side panel on desktop, bottom sheet on phones): items, amounts, cost and gross profit, delivery info and the full status timeline.
- **Money** (`/money`): money in / out / net cash flow / expenses with deltas, cash-in-vs-out chart, expenses-by-category donut, wallet balances with partner capital in and drawings out, and the ledger with eight filter groups (deposits & loans, expenses, courier payouts, sales & returns, drawings, stock, transfers & reversals), search, paging and a cash-movement total for the filtered view. Reversed entries are struck through and tagged.
- **How it stays cheap on Vercel:** every filter, search term and page number lives in the URL, and the data comes from tagged cached loaders (`lib/portal-data-pages.ts`), so each distinct view costs one database query until the next sync clears the tag. Pagination and filtering are done in SQL, so a page only ever ships 15 rows to the browser.
- Nav now has Sales and Money (phone tabs: Overview · Sales · Money · Mine · More). Overview's "Latest orders" and "Money movements" cards link to them.
- `lib/query.ts` (URL builders, filter maps, LIKE-escaping, page parsing; 6 unit tests). Verified on scratch databases: filters, search, junk/oversized inputs, paging, drawer, phone layout (no horizontal overflow), `next build` (Sales 120 kB, Money 116 kB first-load JS).
- Fixed along the way: orders header ignored the active search; chart drew at a fixed width before measuring (overflowed on phones) and now draws only after measuring.

**Phase 2 — done** (local orders workspace)
- **Order detail panel** (`OrderDrawer`): opens from any row or board card; customer (tap-to-call, copy phone / delivery details), items, money with cost and gross profit, courier + waybill, **status timeline**, linked **ledger entries** (revenue, COGS, return and courier-payout journals), proof & documents (existing evidence uploader/gallery, entity `SALES_ORDER`), and the next actions (ship / mark delivered / return / cancel / invoice) that reuse the confirmation dialogs.
- **Board view** (`OrderBoard`): To ship → With courier → Awaiting payout → Settled → Cancelled/returned, oldest first, with age badges and a warning flag when a parcel has not moved (2 d to ship, 5 d with courier, 10 d awaiting payout). List/board choice is remembered.
- **Filters:** search (order, customer, phone, waybill, courier, SKU, product), channel, period (today / 7 / 30 days / all), plus a new *Awaiting payout* tab; the page now loads the latest 300 orders.
- **Batch courier payout** (`CourierPayoutPanel`): chips per courier with parcel count and COD value, tick the parcels the courier paid for, COD pre-filled from each order and editable, courier fee per parcel (batch default + per-row override), pick the account, optional reference → **one balanced journal** (`settleCourierBatchAction`). Service now also rejects a payout that mixes in another courier's parcel.
- **Shortcuts:** `N` new sale, `/` search, `B` board, `L` list, `Esc` closes the panel; a hint row shows them.
- `order-timeline.ts` is shared by the panel and the portal read model (one source of truth for the status history).
- Tests: `25-sales-workspace` (timeline, linked journals, cleaned notes, 3-parcel single-journal payout with a short-paid parcel, mixed-courier and repeat-settlement rejection) and `26-instrumentation-edge-safe`. Full suite on a scratch database: 120/122 (the 2 failures need a live Supabase URL).

**Regression found and fixed in this phase (introduced in Phase 3):** `src/instrumentation.ts` statically pulled the Node-only sync code into the Edge bundle, so `next dev` / `next build` of the local ERP failed with `Can't resolve 'fs'` and every page returned 500. It was missed in Phase 3 because the sync was exercised through `tsx`, never through a booted Next server. Fixed by moving the work to `src/instrumentation-node.ts` behind a positive `NEXT_RUNTIME === "nodejs"` check; verified with a production `next build`, a booted dev server and a regression test that guards the pattern.
