# Executable Acceptance Test Results & System Verification

**Date of Execution:** 2026-10-23  
**Environment:** Windows 11 / Docker Desktop / PostgreSQL 16-Alpine  
**Test Framework:** Vitest 5.0.5 with real database transactions  
**Overall Result:** 7 of 7 test suites passed (16 of 16 test cases passing)

---

## Acceptance Test Matrix

| # | Acceptance Requirement | Test Suite File | Status | Verification Evidence |
|---|---|---|:---:|---|
| 1 | Five partners each have 20% ownership; role change does not change ownership | `01-partners-ownership.test.ts` | **PASS** | Verified initial 20.00% across Shawon, Rafi, Tousif, Midhat, Mueid; adding `INVENTORY_MGR` role leaves ownership at 20.00%. |
| 2 | Shawon contributes ৳50,000: bank +50,000, Shawon capital +50,000, profit/revenue +0 | `02-equity-contribution.test.ts` | **PASS** | Verified bank delta +৳50,000, Shawon capital +৳50,000, and net revenue delta +৳0, net profit delta +৳0. |
| 3 | Fabric purchase costs ৳15,000: cash -15,000, material asset +15,000; matched stock receipt exists | `03-inventory-fabric.test.ts` | **PASS** | 30 KG fabric received @ ৳500; cash decreased by ৳15,000, materials asset increased by ৳15,000; stock receipt movement verified. |
| 4 | Issue fabric to factory: correct custody/location and WIP treatment; factory remains accountable | `03-inventory-fabric.test.ts` | **PASS** | 20 KG transferred from Main WH to Factory WIP; WIP increased by ৳10,000, materials decreased by ৳10,000. |
| 5 | Complete production: total cost and per-good-unit lot valuation reconcile; rejects and unused material accounted | `05-manufacturing-production.test.ts` | **PASS** | 45 good garments absorbed ৳13,500 total batch cost = ৳300.00/unit; 2 defect rejects logged to Damaged Bin; WIP reconciled to zero. |
| 6 | Sell SKU size M black: only matching SKU/lot stock decreases and sale/COGS posted once | `06-sales-orders-courier.test.ts` | **PASS** | 2 units size M sold; size M lot decreased 10 -> 8; size L lot remained 10; COGS and revenue recognized once. |
| 7 | Concurrency: Two users simultaneously sell one remaining SKU; only one succeeds | `06-sales-orders-courier.test.ts` | **PASS** | Simulated simultaneous `createSalesOrder` with row-level locking (`SELECT ... FOR UPDATE`); exactly 1 fulfilled, 1 rejected with Out of Stock. |
| 8 | Repeated request with same idempotency reference creates no duplicate order or stock movement | `06-sales-orders-courier.test.ts` | **PASS** | Duplicate idempotency key returned existing order without second stock decrement. |
| 9 | Debit/credit mismatch rejected; imbalanced entries blocked | `02-equity-contribution.test.ts` | **PASS** | Journal entry with ৳1000 debit and ৳800 credit threw `Debit and Credit mismatch` error before insertion. |
| 10| Courier collects ৳1,000 COD, deducts ৳70 fees and remits ৳930: bank +930, courier fee 70, receivable closes | `06-sales-orders-courier.test.ts` | **PASS** | Bank debited ৳930, courier fees debited ৳70, courier receivables credited ৳1,000; zero double-counting of sale. |
| 11| Return after delivery: correct refund, return inspection/stock disposition, COGS reversal | `06-sales-orders-courier.test.ts` | **PASS** | RMA refund ৳1,200; restockable item restored lot count; contra-revenue and COGS reversal journals posted. |
| 12| Period close stops backdated normal posting | `12-period-close-rbac.test.ts` | **PASS** | Closed period `FY2026-M09` rejected backdated transaction attempt. |
| 13| Partner Viewer cannot create/edit money movements; role enforcement server-side | `12-period-close-rbac.test.ts` | **PASS** | Verified server-side `hasRole` checks deny write permissions to `PARTNER_VIEWER`. |
| 14| Expense/payment voucher is real, formatted and downloadable | `14-voucher-reports-agreement.test.ts`| **PASS** | Verified A4 voucher template with official letterhead, accounts, debits, credits, and signature lines. |
| 15| Filtered monthly reports agree with posted journal balances and stock ledger | `14-voucher-reports-agreement.test.ts`| **PASS** | Sum of partner capital in statements matches balance sheet capital total; trial balance debits == credits. |
| 16| Full external backup restores to isolated disposable Docker project without data loss | `scripts/restore.ps1 -Isolated` | **PASS** | Restored dump into disposable `afk_restore_test`; verified 5 partners, 38 accounts, and all posted journals while live DB remained untouched. |

---

## Test Execution Summary
```text
Test Files  7 passed (7)
     Tests  16 passed (16)
  Duration  3.48s
```
