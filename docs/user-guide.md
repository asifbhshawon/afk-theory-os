# AFK THEORY Business OS — User & Operator Guide

Welcome to the internal operations management manual for founding partners **Shawon, Rafi, Tousif, Midhat, and Mueid**.

---

## 1. Daily Operations Workflow

### A. Morning Review
1. Open `http://localhost:3000` (or `https://afk.local` on LAN).
2. Check the **Liquid Cash & Merchant Wallets** section to confirm available balances across Cash on Hand, BRAC Bank Checking, bKash Merchant, and Nagad Merchant.
3. Review the **Stock Valuation (Cost)** card to check raw material fabric and finished goods stock levels.

---

## 2. Partner Management & Capital Contributions

- Every partner begins with **20% equity ownership** and **20% profit sharing**.
- **Equity Contributions:** When a partner deposits money into the business bank account, go to **Partner Accounts** -> **Record Partner Equity Contribution**. Select the partner, receiving payment account, amount in BDT, and bank slip reference.
  - *Invariant:* Increases the partner's capital account and increases business bank balance. It does **not** register as sales revenue.
- **Partner Loans:** If a partner provides temporary liquidity or pays for business fabric personally, select **Record Partner Loan Advance**. This creates a liability (Due to Partner) without altering equity percentages.

---

## 3. Inventory & Fabric Purchasing

1. Go to **Catalog & Stock** (`/inventory`).
2. When receiving finished garments or fabric rolls, use the **Receive Goods / Raw Materials Lot** form:
   - Select SKU variant (e.g., `AFK-DS-T001-BLK-M` or `FAB-FT-380-BLK`).
   - Enter unique lot ID (e.g. `LOT-2026-001`).
   - Enter quantity and purchase cost.
   - Select payment account (or Trade Payables).
3. The system creates the traceable lot in the **Stock Movement Ledger** and posts balanced debits to Inventory Assets and credits to Bank/Cash.

---

## 4. Apparel Manufacturing (3 Routes)

Go to **Manufacturing** (`/manufacturing`):

### Route 1: Finished Garment Purchases
Received directly via `/inventory` with SKU variant quantities and costs.

### Route 2: Blank Customisation
1. Purchase blanks (e.g. Blank Heavyweight Tee).
2. Create Production Order with Route `BLANK_CUSTOMIZATION`.
3. Add printing/embroidery direct charges via **Add Direct Batch Cost**.
4. Complete production to receive the customized finished garments at absorbed cost.

### Route 3: Own Fabric to Outsourced Factory
1. Purchase fabric rolls into materials inventory.
2. Issue fabric to factory floor WIP.
3. Add direct factory charges (CMT labor, screen printing, wash).
4. Perform QC inspection: record good garments vs defect units.
5. Complete production: The system calculates exact unit cost:
   $$\text{Unit Cost} = \frac{\text{Fabric Cost} + \text{Direct Charges}}{\text{Good Units Received}}$$
   Finished garments are moved from Factory WIP to Main Warehouse, and WIP closes out to zero.

---

## 5. Sales Orders & Courier COD Logistics

Go to **Sales & Orders** (`/orders`). Press **N** from anywhere on the page to start a new sale.

1. **New Sale:** type the customer's phone (a returning customer's name and address fill in), then search the product by name, SKU, size or colour. The list shows live stock and fills in the selling price. Add as many items as needed, set channel, delivery zone, delivery charge (remembered per zone), discount and an optional note. **Confirm & reserve stock** reserves the exact lots with row-level locking, so the same unit can never be sold twice. Double-clicking is safe — a repeat submission is recognised and ignored.
2. **Ship:** click **Ship**, pick the courier and enter the waybill (both required). Stock moves to `TRANSIT`.
3. **Mark delivered:** when the courier confirms, click **Delivered**. This posts revenue and cost of goods and moves the COD amount to `Courier Receivables`.
4. **Cancel:** an order that has not been delivered can be cancelled with a reason. The reservation is released (or the parcel's stock is brought back from transit). No revenue was booked, so no journal is needed.
5. **Courier payout:** open **Courier payouts** at the bottom of the page. Pick the courier, tick the parcels they paid for, correct the COD amount or fee where their statement differs, choose the account and post. One balanced journal records the bank receipt, the courier fees and the cleared receivables. A parcel can only be settled once.
6. **Returns:** only delivered orders can be returned. Choose **Restockable** (back to finished goods) or **Defective** (written off); the refund cannot exceed the order total.

**Finding and following orders**
- **List** and **Board** views (keys **L** / **B**): the board shows To ship → With courier → Awaiting payout → Settled → Cancelled/returned, oldest first, and flags parcels that have not moved for too long.
- Search (**/**) by order number, customer, phone, waybill, courier, SKU or product; filter by channel and period.
- Click any order for its panel: customer (tap to call, copy delivery details), items, cost and gross profit, courier, full status timeline, linked ledger entries and attached proof (courier slips, delivery photos — **Add proof**).

---

## 5b. Partner Portal (partners' online view)

The portal (`apps/partner-portal`, hosted on Vercel) is a read-only mirror of the local OS. Partners see:

- **Overview:** revenue, orders, net profit and cash with trends, a cash chart, wallet split, things needing attention, latest orders and money movements.
- **Sales:** KPIs, order pipeline, channels, top products, delivery zones and a searchable orders list with a detail panel and timeline.
- **Money:** cash in / out, expense breakdown, balances and the full ledger (deposits, expenses, payouts, drawings, transfers).
- **My Investments, Ventures, Updates, Reports, Calendar & Notes.**

Customer names, phone numbers and addresses never leave the local machine; the portal shows a masked label such as "R. C. · •••000".

**How data gets there.** The local OS pushes changes automatically about 10 seconds after any sale, order update, journal entry or calendar note (and retries if the internet is down). The **Sync Cloud** button forces a push; its pop-over shows *Auto-sync: Up to date / Changes pending / Retrying*. Requirements in the local `.env`: `SUPABASE_DATABASE_URL`; optionally `PARTNER_PORTAL_URL` and `SYNC_SHARED_SECRET` so the Vercel pages refresh instantly (otherwise within an hour). Set `PORTAL_AUTOSYNC=false` to turn automatic pushing off.

**Portal navigation.** Desktop has a sidebar; phones get a bottom bar (Overview, Sales, Money, Mine, More). The pill at the top shows how fresh the data is — a quiet day without changes is normal.

---

## 6. Financial Reports & A4 Printable Invoices

1. Go to **Reports & Drilldown** (`/reports`):
   - **Income Statement (P&L):** Displays gross revenue, returns, COGS, gross margin, and operating expenses.
   - **Balance Sheet:** Real-time assets vs liabilities and partner equity.
   - **Trial Balance:** Verifies total ledger debits equal credits.
2. **Printable Invoices & Vouchers:**
   - Navigate to `/print/invoice/[orderId]` for customer invoices.
   - Navigate to `/print/voucher/[journalEntryId]` for payment/journal vouchers.
   - Click **Print / Save as PDF** to generate formatted A4 documents using local system fonts.
