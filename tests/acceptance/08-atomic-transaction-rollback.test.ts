import { describe, it, expect } from "vitest";
import { db } from "@/db";
import {
  accounts,
  paymentAccounts,
  journalEntries,
  journalLines,
  inventoryLots,
  stockMovements,
  salesOrders,
  partners,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  postJournalEntry,
  reverseJournalEntry,
  getFinancialStatements,
  recordPartnerContribution,
} from "@/server/services/finance";
import { receivePurchaseLot, createProductWithVariants } from "@/server/services/inventory";

describe("Phase 3: Financial & Inventory Integrity, Reversals & Atomic Rollback Tests", () => {
  it("verifies mathematical correctness of financial reversals without double-deduction", async () => {
    // 1. Get initial statements
    const initialStatements = await getFinancialStatements();
    const [cashPayAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.type, "CASH"))
      .limit(1);
    const [partner] = await db.select().from(partners).limit(1);

    const initialCash =
      initialStatements.balanceSheet.assetAccounts.find((a) => a.id === cashPayAcc.glAccountId)
        ?.balance || 0;

    const testAmount = 25000.0;
    const ref = `TEST-REV-${Date.now()}`;

    // 2. Post a partner contribution (Debit Cash 25,000, Credit Capital 25,000)
    const entry = await recordPartnerContribution({
      partnerId: partner.id,
      amount: testAmount,
      paymentAccountId: cashPayAcc.id,
      reference: ref,
    });

    // Statements after posting: cash should be +25,000
    const afterPostStatements = await getFinancialStatements();
    const postCash =
      afterPostStatements.balanceSheet.assetAccounts.find((a) => a.id === cashPayAcc.glAccountId)
        ?.balance || 0;
    expect(postCash).toBe(initialCash + testAmount);

    // 3. Reverse the journal entry
    const reversal = await reverseJournalEntry(
      entry.id,
      "Reversing test contribution for integrity verification",
      partner.userId || partner.id
    );

    expect(reversal).toBeDefined();
    expect(reversal.entryType).toBe("REVERSAL");

    // 4. Statements after reversal: cash MUST exactly equal initialCash!
    // In buggy implementations, cash would be initialCash - 25000 (double deduction)
    const afterReversalStatements = await getFinancialStatements();
    const finalCash =
      afterReversalStatements.balanceSheet.assetAccounts.find((a) => a.id === cashPayAcc.glAccountId)
        ?.balance || 0;

    expect(finalCash).toBe(initialCash);

    // Verify trial balance remains balanced
    expect(afterReversalStatements.trialBalance.isBalanced).toBe(true);

    // Verify both original and reversal entries are preserved for auditability
    const [origDb] = await db.select().from(journalEntries).where(eq(journalEntries.id, entry.id));
    const [revDb] = await db.select().from(journalEntries).where(eq(journalEntries.id, reversal.id));
    expect(origDb.status).toBe("REVERSED");
    expect(revDb.status).toBe("POSTED");
    expect(revDb.reversalOfId).toBe(origDb.id);
  });

  it("proves atomic rollback: failure in journal posting prevents lot and stock movement persistence", async () => {
    const [cashPayAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.type, "CASH"))
      .limit(1);

    const { variants } = await createProductWithVariants({
      name: "Rollback Test Fabric",
      styleCode: `RB-${Date.now()}`,
      category: "Test",
      retailPrice: 0,
      variants: [{ sku: `RB-SKU-${Date.now()}`, size: "M", color: "Black", costPrice: 100, sellingPrice: 200 }],
    });

    const lotNumber = `LOT-FAIL-${Date.now()}`;

    // Attempt purchase lot with an invalid payment account ID that will cause journal posting to fail
    await expect(
      receivePurchaseLot({
        variantId: variants[0].id,
        lotNumber,
        quantity: 10,
        unitCost: 100,
        paymentAccountId: "00000000-0000-0000-0000-000000000000", // Non-existent account ID
      })
    ).rejects.toThrow();

    // Verify that NO lot was saved to inventory_lots
    const [orphanedLot] = await db
      .select()
      .from(inventoryLots)
      .where(eq(inventoryLots.lotNumber, lotNumber));
    expect(orphanedLot).toBeUndefined();

    // Verify that NO stock movement was saved
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.referenceId, lotNumber));
    expect(movements.length).toBe(0);
  });
});
