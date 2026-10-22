import { db } from "@/db";
import {
  roles,
  accounts,
  paymentAccounts,
  locations,
  partners,
  users,
  userRoles,
  settings,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

export const INITIAL_ROLES = [
  { code: "ADMIN", name: "System Administrator", description: "Full system administration and user management" },
  { code: "FINANCE_MGR", name: "Finance Manager", description: "Manage ledger, payments, reconciliation and expenses" },
  { code: "FINANCE_APPROVER", name: "Finance Approver", description: "Approve partner reimbursements, capital actions, and period close" },
  { code: "INVENTORY_MGR", name: "Inventory Manager", description: "Manage warehouse stock, receipts, BOMs and transfers" },
  { code: "MFG_MGR", name: "Manufacturing Manager", description: "Manage production orders, fabric issues, and QC inspections" },
  { code: "SALES_OP", name: "Sales Operator", description: "Manage customer sales orders, packing and courier waybills" },
  { code: "PARTNER_VIEWER", name: "Partner Viewer", description: "View financial reports, partner statements and dashboards" },
  { code: "ACCOUNTANT", name: "External Accountant", description: "Audit and review financial statements, GL and journals" },
];

export const INITIAL_ACCOUNTS = [
  // Assets: Cash & Equivalents
  { code: "1010", name: "Cash on Hand", group: "CASH", normalBalance: "DEBIT", description: "Cash in drawer and petty cash", isSystem: true },
  { code: "1020", name: "Bank Account (Primary)", group: "CASH", normalBalance: "DEBIT", description: "Primary checking bank account", isSystem: true },
  { code: "1030", name: "bKash Merchant Wallet", group: "CASH", normalBalance: "DEBIT", description: "bKash MFS merchant wallet", isSystem: true },
  { code: "1040", name: "Nagad Merchant Wallet", group: "CASH", normalBalance: "DEBIT", description: "Nagad MFS merchant wallet", isSystem: true },
  // Receivables & Advances
  { code: "1110", name: "Customer Receivables", group: "RECEIVABLE", normalBalance: "DEBIT", description: "Direct credit sales due from customers", isSystem: true },
  { code: "1120", name: "Courier Receivables (COD)", group: "RECEIVABLE", normalBalance: "DEBIT", description: "COD amounts collected by courier pending remittance", isSystem: true },
  { code: "1130", name: "Supplier Advances", group: "ASSET", normalBalance: "DEBIT", description: "Prepayments to fabric mills and factories", isSystem: true },
  // Inventories
  { code: "1210", name: "Materials Inventory", group: "INVENTORY", normalBalance: "DEBIT", description: "Raw fabric, blank garments, tags, packaging", isSystem: true },
  { code: "1220", name: "Work in Progress (WIP)", group: "WIP", normalBalance: "DEBIT", description: "Materials and direct labor currently in manufacturing", isSystem: true },
  { code: "1230", name: "Finished Goods Inventory", group: "INVENTORY", normalBalance: "DEBIT", description: "Completed garments ready for dispatch", isSystem: true },
  { code: "1240", name: "Inventory in Transit", group: "INVENTORY", normalBalance: "DEBIT", description: "Dispatched with courier, not yet delivered", isSystem: true },
  // Liabilities
  { code: "2010", name: "Trade Payables", group: "LIABILITY", normalBalance: "CREDIT", description: "Bills due to suppliers and service providers", isSystem: true },
  { code: "2020", name: "Tax / VAT Payable", group: "LIABILITY", normalBalance: "CREDIT", description: "Tax and VAT collected pending deposit", isSystem: true },
  // Partner Loans (Due to Partner)
  { code: "2110", name: "Due to Shawon", group: "LIABILITY", normalBalance: "CREDIT", description: "Reimbursable expenses and loans from Shawon", isSystem: true },
  { code: "2120", name: "Due to Rafi", group: "LIABILITY", normalBalance: "CREDIT", description: "Reimbursable expenses and loans from Rafi", isSystem: true },
  { code: "2130", name: "Due to Tousif", group: "LIABILITY", normalBalance: "CREDIT", description: "Reimbursable expenses and loans from Tousif", isSystem: true },
  { code: "2140", name: "Due to Midhat", group: "LIABILITY", normalBalance: "CREDIT", description: "Reimbursable expenses and loans from Midhat", isSystem: true },
  { code: "2150", name: "Due to Mueid", group: "LIABILITY", normalBalance: "CREDIT", description: "Reimbursable expenses and loans from Mueid", isSystem: true },
  // Partner Capital (20% initial ownership each)
  { code: "3010", name: "Partner Capital - Shawon", group: "CAPITAL", normalBalance: "CREDIT", description: "Equity contributed by Shawon", isSystem: true },
  { code: "3020", name: "Partner Capital - Rafi", group: "CAPITAL", normalBalance: "CREDIT", description: "Equity contributed by Rafi", isSystem: true },
  { code: "3030", name: "Partner Capital - Tousif", group: "CAPITAL", normalBalance: "CREDIT", description: "Equity contributed by Tousif", isSystem: true },
  { code: "3040", name: "Partner Capital - Midhat", group: "CAPITAL", normalBalance: "CREDIT", description: "Equity contributed by Midhat", isSystem: true },
  { code: "3050", name: "Partner Capital - Mueid", group: "CAPITAL", normalBalance: "CREDIT", description: "Equity contributed by Mueid", isSystem: true },
  // Partner Drawings
  { code: "3110", name: "Partner Drawings - Shawon", group: "DRAWINGS", normalBalance: "DEBIT", description: "Withdrawals by Shawon", isSystem: true },
  { code: "3120", name: "Partner Drawings - Rafi", group: "DRAWINGS", normalBalance: "DEBIT", description: "Withdrawals by Rafi", isSystem: true },
  { code: "3130", name: "Partner Drawings - Tousif", group: "DRAWINGS", normalBalance: "DEBIT", description: "Withdrawals by Tousif", isSystem: true },
  { code: "3140", name: "Partner Drawings - Midhat", group: "DRAWINGS", normalBalance: "DEBIT", description: "Withdrawals by Midhat", isSystem: true },
  { code: "3150", name: "Partner Drawings - Mueid", group: "DRAWINGS", normalBalance: "DEBIT", description: "Withdrawals by Mueid", isSystem: true },
  // Revenue & Contra-Revenue
  { code: "4010", name: "Sales Revenue", group: "REVENUE", normalBalance: "CREDIT", description: "Gross apparel sales", isSystem: true },
  { code: "4020", name: "Sales Returns", group: "CONTRA_REVENUE", normalBalance: "DEBIT", description: "Customer returns and allowances", isSystem: true },
  { code: "4030", name: "Delivery Fee Income", group: "REVENUE", normalBalance: "CREDIT", description: "Shipping fees paid by customers", isSystem: true },
  // Cost of Goods Sold
  { code: "5010", name: "Cost of Goods Sold (COGS)", group: "COGS", normalBalance: "DEBIT", description: "Cost of finished garments sold", isSystem: true },
  { code: "5020", name: "Production Wastage & Rejects", group: "EXPENSE", normalBalance: "DEBIT", description: "Manufacturing scrap and unrecoverable defect costs", isSystem: true },
  // Operating Expenses
  { code: "6010", name: "Courier Delivery & COD Fees", group: "EXPENSE", normalBalance: "DEBIT", description: "Courier shipping fees and COD collection commissions", isSystem: true },
  { code: "6020", name: "Packaging & Branding Supplies", group: "EXPENSE", normalBalance: "DEBIT", description: "Bags, hang tags, stickers, thank you cards", isSystem: true },
  { code: "6030", name: "Marketing & Social Media Ads", group: "EXPENSE", normalBalance: "DEBIT", description: "Meta ads, photography shoots, campaign costs", isSystem: true },
  { code: "6040", name: "Warehouse & Utilities", group: "EXPENSE", normalBalance: "DEBIT", description: "Storage, electricity, packaging tools, internet", isSystem: true },
  { code: "6050", name: "Professional & Legal Fees", group: "EXPENSE", normalBalance: "DEBIT", description: "Accounting, trade license, legal advisory", isSystem: true },
];

export const INITIAL_LOCATIONS = [
  { code: "MAIN_WH", name: "Main Warehouse / Headquarters", type: "WAREHOUSE", address: "Dhaka, Bangladesh", custodianName: "Shawon" },
  { code: "FACTORY_WIP", name: "Factory Floor - Work in Progress", type: "FACTORY", address: "Contracted Factory", custodianName: "Outsourced Partner" },
  { code: "TRANSIT", name: "Courier In-Transit", type: "IN_TRANSIT", address: "Steadfast / Pathao Network", custodianName: "Courier Custodian" },
  { code: "DAMAGED", name: "Defect & Quarantine Bin", type: "DEFECT", address: "Main Warehouse - Quarantine Area", custodianName: "QC Lead" },
];

export const INITIAL_PARTNERS = [
  { name: "Shawon", email: "shawon@afktheory.local", ownershipPct: "20.00", profitSharePct: "20.00", roles: ["ADMIN", "FINANCE_MGR", "PARTNER_VIEWER"] },
  { name: "Rafi", email: "rafi@afktheory.local", ownershipPct: "20.00", profitSharePct: "20.00", roles: ["FINANCE_APPROVER", "PARTNER_VIEWER"] },
  { name: "Tousif", email: "tousif@afktheory.local", ownershipPct: "20.00", profitSharePct: "20.00", roles: ["INVENTORY_MGR", "PARTNER_VIEWER"] },
  { name: "Midhat", email: "midhat@afktheory.local", ownershipPct: "20.00", profitSharePct: "20.00", roles: ["MFG_MGR", "PARTNER_VIEWER"] },
  { name: "Mueid", email: "mueid@afktheory.local", ownershipPct: "20.00", profitSharePct: "20.00", roles: ["SALES_OP", "PARTNER_VIEWER"] },
];

export async function isSystemInitialized(): Promise<boolean> {
  const existingUsers = await db.select().from(users).limit(1);
  return existingUsers.length > 0;
}

export async function initializeSystem(partnerPasswords?: Record<string, string>) {
  // 1. Seed Roles
  for (const role of INITIAL_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.code, role.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(role);
    }
  }

  // 2. Seed Accounts
  for (const acc of INITIAL_ACCOUNTS) {
    const existing = await db.select().from(accounts).where(eq(accounts.code, acc.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(accounts).values(acc);
    }
  }

  // 3. Seed Payment Accounts
  const paymentAccountMappings = [
    { name: "Cash on Hand", type: "CASH", glCode: "1010", number: "CASH-01" },
    { name: "BRAC Bank Checking", type: "BANK", glCode: "1020", number: "BRAC-150120" },
    { name: "bKash Merchant", type: "BKASH", glCode: "1030", number: "01700000000" },
    { name: "Nagad Merchant", type: "NAGAD", glCode: "1040", number: "01800000000" },
  ];

  for (const pa of paymentAccountMappings) {
    const [glAcc] = await db.select().from(accounts).where(eq(accounts.code, pa.glCode)).limit(1);
    if (glAcc) {
      const existing = await db.select().from(paymentAccounts).where(eq(paymentAccounts.name, pa.name)).limit(1);
      if (existing.length === 0) {
        await db.insert(paymentAccounts).values({
          name: pa.name,
          type: pa.type,
          glAccountId: glAcc.id,
          accountNumber: pa.number,
        });
      }
    }
  }

  // 4. Seed Locations
  for (const loc of INITIAL_LOCATIONS) {
    const existing = await db.select().from(locations).where(eq(locations.code, loc.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(locations).values(loc);
    }
  }

  // 5. Seed Settings
  const defaultSettings = [
    { key: "BUSINESS_NAME", value: { name: "AFK THEORY", tagline: "Apparel Management & Operations" } },
    { key: "CURRENCY", value: { code: "BDT", symbol: "৳", decimals: 2 } },
    { key: "TIMEZONE", value: { zone: "Asia/Dhaka", utcOffset: "+06:00" } },
    { key: "TAX_POLICY", value: { isConfigured: false, defaultRate: 0, notice: "Pending qualified accountant review" } },
    { key: "REVENUE_RECOGNITION", value: { mode: "ON_DELIVERY", description: "Revenue recognised on confirmed courier delivery" } },
  ];

  for (const s of defaultSettings) {
    const existing = await db.select().from(settings).where(eq(settings.key, s.key)).limit(1);
    if (existing.length === 0) {
      await db.insert(settings).values({
        key: s.key,
        value: s.value,
        description: s.key,
      });
    }
  }

  // 6. Seed 5 Founding Partners & Users
  for (const p of INITIAL_PARTNERS) {
    // Check if partner exists
    const [existingPartner] = await db.select().from(partners).where(eq(partners.name, p.name)).limit(1);
    let partnerId = existingPartner?.id;

    if (!existingPartner) {
      const [newPartner] = await db
        .insert(partners)
        .values({
          name: p.name,
          ownershipPct: p.ownershipPct,
          profitSharePct: p.profitSharePct,
          status: "ACTIVE",
          notes: "Founding Partner (20% initial ownership)",
        })
        .returning();
      partnerId = newPartner.id;
    }

    // Check if user account exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, p.email)).limit(1);
    if (!existingUser) {
      // Secure local default password or operator password
      const password = partnerPasswords?.[p.name] || `Afk@${p.name}2026!`;
      const passwordHash = hashPassword(password);

      const [newUser] = await db
        .insert(users)
        .values({
          name: p.name,
          email: p.email,
          passwordHash,
          status: "ACTIVE",
        })
        .returning();

      // Link partner to user
      if (partnerId) {
        await db.update(partners).set({ userId: newUser.id }).where(eq(partners.id, partnerId));
      }

      // Assign roles
      for (const roleCode of p.roles) {
        await db.insert(userRoles).values({
          userId: newUser.id,
          roleCode,
        });
      }
    }
  }

  return { success: true };
}
