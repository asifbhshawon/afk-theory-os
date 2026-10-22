# AFK THEORY Business OS — Accounting Policy & Financial Rules

**Document Version:** 1.0 (Local Build Baseline)  
**Effective Date:** 2026-10-22  
**Reporting Currency:** Bangladeshi Taka (BDT, ৳)  
**User Timezone:** Asia/Dhaka (UTC storage)  
**Review Notice:** *These accounting policies are designed to maintain mathematical and structural integrity in the software. Final tax compliance, statutory filing requirements, and annual audits must be reviewed and certified by a qualified Bangladeshi Chartered Accountant.*

---

## 1. Fundamental Accounting Invariants

1. **Balanced Double-Entry Journal:**
   Every posted journal entry must contain at least two journal lines, where:
   $$\sum \text{Debits} == \sum \text{Credits}$$
   The system rejects any journal entry where debits and credits do not balance to the paisa (0.01 BDT).

2. **Immutable Posted History & Reversals:**
   Posted journal entries cannot be edited or deleted. Corrections must be executed via an explicit reversing journal entry (`reversal_of_id`) and, if required, a corrected replacement entry. Both the original, the reversal, and the correction are preserved with full audit trails.

3. **Separation of Capital, Loans, and Revenue:**
   - Money deposited by a partner as equity increases **Cash/Bank** and credits **Partner Capital Account** (Equity). It does **NOT** constitute business revenue.
   - Money advanced by a partner as a loan credits **Due to Partner / Partner Loans Payable** (Liability).
   - Payments made personally by a partner on behalf of the business credit **Due to Partner** and debit the relevant Expense or Asset.
   - Partner drawings or distributions debit **Partner Drawings** and credit Cash/Bank. Earnings are not automatically distributable without a formally approved Partner Decision.

4. **Closed Fiscal Periods:**
   Posting transactions to closed fiscal periods is prohibited. Authorised post-closing adjustments must post in an open adjustment period with explicit administrative approval.

---

## 2. Inventory & Manufacturing Valuation Policies

1. **Costing Methodology:**
   - **Finished Goods & Raw Materials:** Valued at **Actual Lot Cost** (identifiable cost per purchase/production lot) or FIFO where lots are homogeneous.
   - Floating-point arithmetic is strictly forbidden for monetary calculation. All values use `NUMERIC(18,2)` or integer paisa.

2. **Three Manufacturing Pathways:**
   - **Route 1: Finished Garment Purchases:**
     - Invoice cost + direct freight allocated directly to finished goods inventory lot.
     - Debit: `Finished Inventory` | Credit: `Cash / Bank / Trade Payables`
   - **Route 2: Blank Garment Customisation:**
     - Blanks cost + printing/embroidery service charges + trims/packaging = Finished unit cost.
     - Material issue: Debit: `Work in Progress (WIP)` | Credit: `Materials / Blank Inventory`
     - Service charge: Debit: `Work in Progress (WIP)` | Credit: `Cash / Bank / Trade Payables`
     - Receipt: Debit: `Finished Inventory` | Credit: `Work in Progress (WIP)`
   - **Route 3: Own Fabric to Outsourced Factory:**
     - Fabric purchase: Debit: `Materials Inventory (Fabric)` | Credit: `Bank / Trade Payables`
     - Fabric issue to factory: Debit: `Work in Progress (Fabric at Factory)` | Credit: `Materials Inventory`
     - Factory CMT (Cut-Make-Trim) & wash/finish: Debit: `Work in Progress (Direct Production Costs)` | Credit: `Cash / Trade Payables`
     - Receipt of finished garments:
       $$\text{Unit Cost} = \frac{\text{Total Accumulated WIP Cost}}{\text{Good Units Received}}$$
       Debit: `Finished Inventory` | Credit: `Work in Progress`
     - Factory remains accountable for unconsumed raw fabric rolls until returned or formally written off.

3. **Defect & Scrap Treatment:**
   - Minor normal production scrap is absorbed into good finished garment lot cost.
   - Abnormal damage or rejected garments not recoverable are recorded as:
     Debit: `Production Wastage & Defect Expense` | Credit: `Work in Progress`

---

## 3. Revenue Recognition & Sales Logistics

1. **Point of Revenue Recognition:**
   - **Direct / Walk-in / Prepaid Sales:** Revenue is recognised at the point of confirmed dispatch/handover.
   - **Courier Cash-on-Delivery (COD):**
     - When order is shipped: Inventory moves to `Inventory in Transit`.
     - Upon confirmed delivery by courier:
       - Debit: `Courier Receivables (Steadfast / Pathao / Paperfly)`
       - Credit: `Sales Revenue`
       - Debit: `Cost of Goods Sold (COGS)`
       - Credit: `Inventory in Transit`
   - Configurable setting allows conservative recognition on actual courier remittance if preferred.

2. **Courier Remittance & Reconciliation:**
   - Courier collects gross COD from customer, deducts delivery and COD handling fees, and remits net cash to AFK THEORY's bank or bKash merchant wallet:
     - Debit: `Bank / bKash (Net Remittance Received)`
     - Debit: `Courier Delivery & Handling Expense (Fee Deducted)`
     - Credit: `Courier Receivables (Gross COD)`
   - Any difference between gross courier billing and remitted amount remains on `Courier Receivables` as an open claim until resolved.

3. **Sales Returns & Exchanges:**
   - Customer return:
     - Debit: `Sales Returns (Contra Revenue)` | Credit: `Customer Receivables / Cash Refund`
   - Inventory disposition:
     - If garment is inspected and restockable:
       Debit: `Finished Inventory` | Credit: `Cost of Goods Sold`
     - If damaged/unsellable:
       Debit: `Damaged Stock Expense` | Credit: `Inventory in Transit / COGS`

---

## 4. Taxation & VAT Stance (NBR Bangladesh)

- Tax rules and VAT rates in Bangladesh are subject to periodic NBR SROs and business turnover registration thresholds.
- **System Default:** Configurable tax codes (e.g. standard 5%, 7.5%, or 0% exempt) with tax liability accounts.
- **Accountant Review Flag:** The system displays a clear banner on tax summaries stating:
  > *"Tax and VAT rates are user-configured and must be verified by AFK THEORY's legal/tax advisor before generating statutory VAT invoices."*

---

## 5. Standard Chart of Accounts (COA) Structure

| Account Code | Account Name | Type | Normal Balance | Description |
|---|---|---|---|---|
| `1010` | Cash on Hand | Asset | Debit | Petty cash & physical cash drawer |
| `1020` | Bank Account (Primary) | Asset | Debit | Scheduled bank checking account |
| `1030` | bKash Merchant Wallet | Asset | Debit | Mobile financial service wallet |
| `1040` | Nagad Merchant Wallet | Asset | Debit | Mobile financial service wallet |
| `1110` | Customer Receivables | Asset | Debit | Unpaid customer orders / credit sales |
| `1120` | Courier Receivables (COD) | Asset | Debit | Delivered parcels awaiting courier remittance |
| `1130` | Supplier Advances | Asset | Debit | Advances paid to fabric mills/factories |
| `1210` | Materials Inventory | Asset | Debit | Raw fabric, labels, packaging, blanks |
| `1220` | Work in Progress (WIP) | Asset | Debit | Fabric and costs at outsourced factories |
| `1230` | Finished Goods Inventory | Asset | Debit | Packaged garments ready for sale |
| `1240` | Inventory in Transit | Asset | Debit | Shipped with courier, not yet delivered |
| `2010` | Trade Payables | Liability | Credit | Bills due to suppliers, mills, printers |
| `2020` | Tax / VAT Payable | Liability | Credit | Collected tax pending NBR deposit |
| `2110` | Due to Shawon (Partner Loan) | Liability | Credit | Personal funds loaned or expenses paid |
| `2120` | Due to Rafi (Partner Loan) | Liability | Credit | Personal funds loaned or expenses paid |
| `2130` | Due to Tousif (Partner Loan)| Liability | Credit | Personal funds loaned or expenses paid |
| `2140` | Due to Midhat (Partner Loan)| Liability | Credit | Personal funds loaned or expenses paid |
| `2150` | Due to Mueid (Partner Loan) | Liability | Credit | Personal funds loaned or expenses paid |
| `3010` | Partner Capital - Shawon | Equity | Credit | Shawon equity contributions (20% ownership) |
| `3020` | Partner Capital - Rafi | Equity | Credit | Rafi equity contributions (20% ownership) |
| `3030` | Partner Capital - Tousif | Equity | Credit | Tousif equity contributions (20% ownership) |
| `3040` | Partner Capital - Midhat | Equity | Credit | Midhat equity contributions (20% ownership) |
| `3050` | Partner Capital - Mueid | Equity | Credit | Mueid equity contributions (20% ownership) |
| `3110-3150` | Partner Drawings (x5) | Equity | Debit | Approved capital or profit withdrawals |
| `4010` | Sales Revenue | Revenue | Credit | Gross revenue from clothing sales |
| `4020` | Sales Returns | Contra-Rev | Debit | Refunds and returns deducted from sales |
| `4030` | Delivery Fee Income | Revenue | Credit | Shipping charges collected from customers |
| `5010` | Cost of Goods Sold (COGS) | Expense | Debit | Cost of finished garments sold |
| `5020` | Production Wastage & Rejects | Expense | Debit | Unrecoverable manufacturing scrap |
| `6010` | Courier Delivery & COD Fees | Expense | Debit | Courier delivery charges and COD commissions |
| `6020` | Packaging & Branding Supplies| Expense | Debit | Bags, tags, stickers, tissue paper |
| `6030` | Marketing & Social Media Ads | Expense | Debit | Meta ads, photography, influencer campaigns |
| `6040` | Warehouse & Office Utilities | Expense | Debit | Storage rent, electricity, internet |
| `6050` | Professional & Legal Fees | Expense | Debit | Accounting, trade license, registration |
