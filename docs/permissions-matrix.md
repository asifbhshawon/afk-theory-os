# AFK THEORY Business OS — Role & Permissions Matrix

**System Security Principle:** Server-side enforcement with deny-by-default. Client-side navigation visibility is for user experience only and never replaces server-side authorization.
**Partner Governance Rule:** Operational roles and system permissions are separate from equity ownership. Every founding partner starts with 20% equity ownership regardless of their administrative role. Self-approval of personal reimbursements, loan repayments, capital distributions, or share changes is strictly forbidden.

---

## Roles Overview

| Role Key | Role Name | Intended Users | Description |
|---|---|---|---|
| `ADMIN` | System Administrator | Shawon (Primary Admin) | Full system configuration, backup management, user accounts, audit oversight |
| `FINANCE_MGR` | Finance Manager | Finance lead partner | Full ledger creation, bill payments, reconciliation, expense logging |
| `FINANCE_APPROVER`| Finance Approver | Independent partner | Approves partner reimbursements, capital withdrawals, period closures |
| `INVENTORY_MGR`| Inventory Manager | Operations partner | Receives lots, initiates transfers, audits physical stock, manages BOM |
| `MFG_MGR` | Manufacturing Manager | Production partner | Manages production orders, material issues, factory WIP, QC inspections |
| `SALES_OP` | Sales Operator | Sales/Dispatch team | Order entry, pack & ship, waybills, customer details |
| `PARTNER_VIEWER` | Partner Viewer | All partners | Full view of reports, dashboards, partner statements; read-only on ledger writes |
| `ACCOUNTANT` | External Accountant | External advisor | Read-only access to General Ledger, Trial Balance, Statements, and Audit Trails |

---

## Detailed Permissions Matrix

| Functional Module | Action / Permission | ADMIN | FINANCE_MGR | FINANCE_APPROVER | INVENTORY_MGR | MFG_MGR | SALES_OP | PARTNER_VIEWER | ACCOUNTANT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Identity & Users** | View Users & Roles | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| | Create/Edit Users & Reset Pwd | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Configure Approval Thresholds| ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Finance & Ledger**| View Financial Statements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | Create Draft Journal / Expense | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Post Journal Entries | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Reverse Posted Journal Entry | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Record Partner Contribution | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Approve Partner Reimbursement| ✅* | ❌ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Approve Profit Distribution | ❌** | ❌ | ✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Close Fiscal Period | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Partners** | View All Partner Statements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | Record Partner Loan / Draw | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Change Equity/Profit % | ✅*** | ❌ | ✅*** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Catalog & Stock**| View Catalog & Stock Levels | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Create Products, SKUs, BOMs | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Create Goods Receipt (GRN) | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Stock Adjustments / Write-off | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Warehouse Transfer | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manufacturing** | Create Production Order | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| | Issue Fabric / Blanks to WIP | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Record QC & Defect Results | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| | Finish Production & Lot Cost | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sales & Courier** | Enter Order (Manual/Social) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Pack & Generate Waybill | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| | Reconcile Courier Settlement | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Process Return / RMA | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **System & Health**| View Audit Logs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | Execute Local Backup | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Execute Restore Operation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*\* Self-approval rule: An approver cannot approve their own reimbursement voucher or loan settlement.*  
*\*\* Dual partner approval required for equity distributions or withdrawals.*  
*\*\*\* Requires unanimous approval recorded in the Partner Decision Register with signed document attachment.*
