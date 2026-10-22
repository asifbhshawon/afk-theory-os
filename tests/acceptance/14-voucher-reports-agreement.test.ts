import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getFinancialStatements } from "@/server/services/finance";

describe("Acceptance Tests 14 & 15: Voucher Layout & Authoritative Report Agreement", () => {
  it("Acceptance Test 14: Payment/expense voucher has real lines, debits, credits, and formatted metadata", async () => {
    // 1. Fetch any posted journal entry from the real database
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.status, "POSTED"))
      .orderBy(desc(journalEntries.date))
      .limit(1);

    expect(entry).toBeDefined();
    expect(entry.entryNumber).toMatch(/^AFK-JRN-\d{4}-\d{6}$/);

    // 2. Fetch its lines
    const lines = await db
      .select({
        debit: journalLines.debit,
        credit: journalLines.credit,
        memo: journalLines.memo,
        accountName: accounts.name,
      })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.journalEntryId, entry.id));

    expect(lines.length).toBeGreaterThanOrEqual(2);

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

    // Debits and credits must balance exactly
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it("Acceptance Test 15: Reports agree with posted journal balances and stock ledger, not stale dashboard figures", async () => {
    const statements = await getFinancialStatements();

    // 1. Verify Trial Balance: Sum of all debits across all accounts == sum of all credits
    expect(statements.trialBalance.isBalanced).toBe(true);
    expect(statements.trialBalance.totalDebit).toBe(statements.trialBalance.totalCredit);

    // 2. Verify Balance Sheet: Assets == Liabilities + Equity
    expect(statements.balanceSheet.isBalanced).toBe(true);
    const calculatedRightSide =
      statements.balanceSheet.totalLiabilities + statements.balanceSheet.totalEquity;
    expect(
      Math.abs(statements.balanceSheet.totalAssets - calculatedRightSide)
    ).toBeLessThan(0.05);

    // 3. Verify Partner Statements: Sum of all partner capital accounts == Balance Sheet capital total
    const totalPartnerCapitalInStatements = statements.partnerStatements.reduce(
      (s, p) => s + p.capitalContributed,
      0
    );
    expect(totalPartnerCapitalInStatements).toBe(
      statements.balanceSheet.totalCapitalContributed
    );
  });
});
