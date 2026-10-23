import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  partners,
  paymentAccounts,
  journalEntries,
  journalLines,
  accounts,
  users,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  recordPartnerContribution,
  recordBusinessExpense,
  reverseJournalEntry,
  getPartnerTransactionHistory,
  getFinancialStatements,
} from "@/server/services/finance";

describe("Acceptance Suite 18: Transaction Reversal Engine", () => {
  let testUserId: string;
  let shawonPartner: any;
  let bankAccount: any;
  let expenseAccount: any;

  beforeAll(async () => {
    // 1. Fetch or create test user
    const [u] = await db.select().from(users).limit(1);
    if (u) {
      testUserId = u.id;
    } else {
      const [newU] = await db
        .insert(users)
        .values({
          email: "reversal_test@afktheory.local",
          name: "Reversal Tester",
          passwordHash: "test_hash",
          status: "ACTIVE",
        })
        .returning();
      testUserId = newU.id;
    }

    // 2. Fetch partner
    const allPartners = await db.select().from(partners);
    shawonPartner = allPartners.find((p) => p.name === "Shawon") || allPartners[0];

    // 3. Fetch payment account
    const allPayAccs = await db.select().from(paymentAccounts);
    bankAccount = allPayAccs[0];

    // 4. Fetch expense account
    const allExpAccs = await db
      .select()
      .from(accounts)
      .where(eq(accounts.group, "EXPENSE"));
    expenseAccount = allExpAccs[0];
  });

  it("1. Successfully records a partner contribution and reverses it with inverted double-entry lines", async () => {
    const contributionAmount = 25000;

    // Record contribution
    const originalEntry = await recordPartnerContribution({
      partnerId: shawonPartner.id,
      amount: contributionAmount,
      paymentAccountId: bankAccount.id,
      reference: "TEST_REV_001",
      userId: testUserId,
    });

    expect(originalEntry).toBeDefined();
    expect(originalEntry.status).toBe("POSTED");

    // Fetch original lines
    const originalLines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, originalEntry.id));
    expect(originalLines.length).toBe(2);

    const debitLine = originalLines.find((l) => Number(l.debit) === contributionAmount);
    const creditLine = originalLines.find((l) => Number(l.credit) === contributionAmount);
    expect(debitLine).toBeDefined();
    expect(creditLine).toBeDefined();

    // Perform reversal
    const reversalReason = "Accidental duplicate partner deposit";
    const reversalEntry = await reverseJournalEntry(
      originalEntry.id,
      reversalReason,
      testUserId
    );

    expect(reversalEntry).toBeDefined();
    expect(reversalEntry.entryType).toBe("REVERSAL");
    expect(reversalEntry.reversalOfId).toBe(originalEntry.id);
    expect(reversalEntry.reference).toBe(originalEntry.entryNumber);

    // Verify original entry is now marked REVERSED
    const [updatedOriginal] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, originalEntry.id));
    expect(updatedOriginal.status).toBe("REVERSED");

    // Verify reversal lines are exactly inverted
    const reversalLines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, reversalEntry.id));
    expect(reversalLines.length).toBe(2);

    const invertedDebit = reversalLines.find(
      (l) => l.accountId === creditLine!.accountId && Number(l.debit) === contributionAmount
    );
    const invertedCredit = reversalLines.find(
      (l) => l.accountId === debitLine!.accountId && Number(l.credit) === contributionAmount
    );
    expect(invertedDebit).toBeDefined();
    expect(invertedCredit).toBeDefined();
  });

  it("2. Prevents double reversal of an already reversed transaction", async () => {
    // Record contribution
    const originalEntry = await recordPartnerContribution({
      partnerId: shawonPartner.id,
      amount: 15000,
      paymentAccountId: bankAccount.id,
      userId: testUserId,
    });

    // First reversal succeeds
    await reverseJournalEntry(originalEntry.id, "First reversal", testUserId);

    // Second reversal attempt must fail
    await expect(
      reverseJournalEntry(originalEntry.id, "Second reversal attempt", testUserId)
    ).rejects.toThrow(/already reversed/i);
  });

  it("3. Successfully reverses an expense transaction and creates an audit trail", async () => {
    const expenseAmount = 5000;

    const expenseEntry = await recordBusinessExpense({
      expenseAccountId: expenseAccount.id,
      amount: expenseAmount,
      paymentAccountId: bankAccount.id,
      description: "Sample stationery expense to reverse",
      userId: testUserId,
    });

    expect(expenseEntry.status).toBe("POSTED");

    // Reverse the expense
    const reversal = await reverseJournalEntry(
      expenseEntry.id,
      "Incorrect billing receipt entered",
      testUserId
    );

    expect(reversal).toBeDefined();

    // Verify audit log exists
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, expenseEntry.id),
          eq(auditLogs.action, "REVERSE_JOURNAL")
        )
      );

    expect(log).toBeDefined();
    expect(log.action).toBe("REVERSE_JOURNAL");
    expect(log.details).toContain("Incorrect billing receipt entered");
  });

  it("4. Confirms partner history reflects the REVERSED status", async () => {
    const history = await getPartnerTransactionHistory();
    const reversedItems = history.filter((h) => h.status === "REVERSED");
    expect(reversedItems.length).toBeGreaterThan(0);
  });
});
