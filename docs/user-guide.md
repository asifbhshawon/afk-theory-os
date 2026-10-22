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

Go to **Sales & Courier** (`/orders`):
1. **Order Entry:** Enter customer name, phone number, delivery address, shipping zone (Inside Dhaka / Outside Dhaka), and item variant.
   - The system immediately reserves the required lot stock with row-level locking to prevent overselling.
2. **Dispatch & Shipping:** Click **Ship** and enter courier waybill number (e.g. Steadfast / Pathao). Inventory moves to `TRANSIT`.
3. **Confirmed Delivery & Revenue Recognition:** When courier confirms delivery, click **Confirm Delivered**.
   - Posts sales revenue, recognizes COGS, and moves total COD amount to `Courier Receivables`.
4. **Courier Remittance Settlement:** When the courier transfers remittance:
   - Bank receives net remittance (e.g. ৳930).
   - Courier delivery expense recorded (e.g. ৳70).
   - Courier receivables closed (৳1,000).
5. **Returns & Exchanges:** If an item is returned, process the RMA: choose **Restockable** (returns to inventory) or **Defective** (written off to scrap).

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
