import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { partners, paymentAccounts, users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  recordPartnerContribution,
  postJournalEntry,
  getFinancialStatements,
} from "@/server/services/finance";

describe("Acceptance Test 2 & 9: Financial Ledger Invariants & Partner Equity", () => {
  it("rejects an imbalanced journal entry where debits do not equal credits (Test 9)", async () => {
    const [cashAcc] = await db.select().from(accounts).where(eq(accounts.code, "1010")).limit(1);
    const [revAcc] = await db.select().from(accounts).where(eq(accounts.code, "4010")).limit(1);

    await expect(
      postJournalEntry({
        date: new Date(),
        entryType: "MANUAL",
        description: "Imbalanced Test",
        lines: [
          { accountId: cashAcc.id, debit: 1000, credit: 0 },
          { accountId: revAcc.id, debit: 0, credit: 800 }, // Mismatch: 1000 != 800
        ],
      })
    ).rejects.toThrow(/Debit and Credit mismatch/);
  });

  it("Shawon contributes ৳50,000: bank +50,000, Shawon capital +50,000, profit/revenue +0 (Test 2)", async () => {
    // 1. Get Shawon partner and user
    const [shawon] = await db.select().from(partners).where(eq(partners.name, "Shawon")).limit(1);
    expect(shawon).toBeDefined();

    const [user] = await db.select().from(users).where(eq(users.id, shawon.userId!)).limit(1);
    expect(user).toBeDefined();

    // 2. Get Bank payment account
    const [bankAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.type, "BANK"))
      .limit(1);
    expect(bankAcc).toBeDefined();

    // Snapshot statements before contribution
    const beforeStatements = await getFinancialStatements();
    const beforeBankBalance = beforeStatements.balanceSheet.assetAccounts.find(
      (a) => a.id === bankAcc.glAccountId
    )?.balance || 0;
    const beforeShawonCapital = beforeStatements.partnerStatements.find(
      (p) => p.name === "Shawon"
    )?.capitalContributed || 0;
    const beforeNetRevenue = beforeStatements.incomeStatement.netRevenue;
    const beforeNetProfit = beforeStatements.incomeStatement.netProfit;

    // 3. Record Shawon's ৳50,000 contribution
    const entry = await recordPartnerContribution({
      partnerId: shawon.id,
      amount: 50000,
      paymentAccountId: bankAcc.id,
      reference: `DEP-SHAWON-${Date.now().toString().slice(-5)}`,
      userId: user.id,
    });
    expect(entry).toBeDefined();
    expect(entry.status).toBe("POSTED");

    // 4. Verify statements after contribution
    const afterStatements = await getFinancialStatements();

    // Bank asset balance must have increased by ৳50,000
    const afterBankBalance = afterStatements.balanceSheet.assetAccounts.find(
      (a) => a.id === bankAcc.glAccountId
    )?.balance || 0;
    expect(afterBankBalance - beforeBankBalance).toBe(50000);

    // Shawon's partner capital account must increase by ৳50,000
    const afterShawonCapital = afterStatements.partnerStatements.find(
      (p) => p.name === "Shawon"
    )?.capitalContributed || 0;
    expect(afterShawonCapital - beforeShawonCapital).toBe(50000);

    // CRITICAL ACCOUNTING INVARIANT: Revenue and Net Profit must NOT change (+0)
    expect(afterStatements.incomeStatement.netRevenue).toBe(beforeNetRevenue);
    expect(afterStatements.incomeStatement.netProfit).toBe(beforeNetProfit);
    expect(afterStatements.incomeStatement.netRevenue - beforeNetRevenue).toBe(0);
    expect(afterStatements.incomeStatement.netProfit - beforeNetProfit).toBe(0);

    // Trial balance must balance
    expect(afterStatements.trialBalance.isBalanced).toBe(true);
    // Balance sheet must balance
    expect(afterStatements.balanceSheet.isBalanced).toBe(true);
  });
});
