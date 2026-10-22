import { describe, it, expect } from "vitest";
import { db } from "@/db";
import {
  paymentAccounts,
  accounts,
  stockMovements,
  inventoryLots,
  locations,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createProductWithVariants,
  receivePurchaseLot,
  issueFabricToFactory,
} from "@/server/services/inventory";
import { getFinancialStatements } from "@/server/services/finance";

describe("Acceptance Tests 3 & 4: Inventory Purchase & Factory Fabric Custody", () => {
  let fabricVariantId: string;
  let receivedLotId: string;

  it("Acceptance Test 3: Fabric purchase costs ৳15,000: cash -15,000, material asset +15,000; matched stock receipt quantity exists", async () => {
    // 1. Create Raw Material Product (French Terry Fabric)
    const { variants } = await createProductWithVariants({
      name: "Heavyweight French Terry Cotton 380 GSM",
      styleCode: "FAB-FT-380",
      category: "Fabric",
      productType: "RAW_MATERIAL",
      retailPrice: 0,
      variants: [
        {
          sku: "FAB-FT-380-BLK",
          size: "KG",
          color: "Matte Black",
          costPrice: 500, // ৳500 per KG
          sellingPrice: 0,
        },
      ],
    });
    fabricVariantId = variants[0].id;

    // 2. Get Cash / Bank payment account
    const [cashPaymentAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.type, "CASH"))
      .limit(1);
    expect(cashPaymentAcc).toBeDefined();

    // Snapshot before
    const beforeStatements = await getFinancialStatements();
    const beforeMat = beforeStatements.balanceSheet.assetAccounts.find(
      (a) => a.code === "1210"
    )?.balance || 0;
    const beforeCash = beforeStatements.balanceSheet.assetAccounts.find(
      (a) => a.id === cashPaymentAcc.glAccountId
    )?.balance || 0;

    // 3. Purchase 30 KG of fabric @ ৳500 = ৳15,000
    const runSuffix = Date.now().toString().slice(-5);
    const lot = await receivePurchaseLot({
      variantId: fabricVariantId,
      lotNumber: `LOT-FAB-${runSuffix}`,
      quantity: 30, // 30 KG
      unitCost: 500, // ৳500 / KG => Total = ৳15,000
      paymentAccountId: cashPaymentAcc.id,
      isRawMaterial: true,
      reference: `PO-FAB-${runSuffix}`,
    });
    receivedLotId = lot.id;

    expect(lot).toBeDefined();
    expect(lot.initialQuantity).toBe(30);
    expect(lot.currentQuantity).toBe(30);
    expect(Number(lot.totalCost)).toBe(15000);

    // 4. Verify stock receipt quantity exists in stock movement ledger
    const [movement] = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.lotId, lot.id))
      .limit(1);
    expect(movement).toBeDefined();
    expect(movement.movementType).toBe("PURCHASE_RECEIPT");
    expect(movement.quantity).toBe(30);

    // 5. Verify Accounting: Cash -15,000, Materials Asset +15,000
    const statements = await getFinancialStatements();
    const afterMat = statements.balanceSheet.assetAccounts.find(
      (a) => a.code === "1210"
    )?.balance || 0;
    expect(afterMat - beforeMat).toBe(15000);

    const afterCash = statements.balanceSheet.assetAccounts.find(
      (a) => a.id === cashPaymentAcc.glAccountId
    )?.balance || 0;
    expect(beforeCash - afterCash).toBe(15000);

    // Books must remain balanced
    expect(statements.trialBalance.isBalanced).toBe(true);
    expect(statements.balanceSheet.isBalanced).toBe(true);
  });

  it("Acceptance Test 4: Issue fabric to a factory: correct custody/location and WIP treatment; factory remains accountable for outstanding materials", async () => {
    const beforeStatements = await getFinancialStatements();
    const beforeWip = beforeStatements.balanceSheet.assetAccounts.find((a) => a.code === "1220")?.balance || 0;
    const beforeMat = beforeStatements.balanceSheet.assetAccounts.find((a) => a.code === "1210")?.balance || 0;

    // Issue 20 KG of the 30 KG fabric lot to factory for cutting/sewing
    const mfgRef = `MFG-2026-DROP-${Date.now().toString().slice(-5)}`;
    const result = await issueFabricToFactory({
      lotId: receivedLotId,
      quantity: 20,
      productionOrderId: mfgRef,
      notes: "Issued 20 KG fabric to Factory WIP for T-Shirt Drop 01",
    });

    expect(result.success).toBe(true);
    expect(result.issuedQuantity).toBe(20);
    expect(result.remainingInLot).toBe(10); // 30 - 20 = 10 KG remains in warehouse

    // Verify stock movement ledger recorded transfer to Factory WIP
    const [factoryLoc] = await db
      .select()
      .from(locations)
      .where(eq(locations.code, "FACTORY_WIP"))
      .limit(1);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.lotId, receivedLotId));

    const issueMovement = movements.find((m) => m.movementType === "PRODUCTION_ISSUE");
    expect(issueMovement).toBeDefined();
    expect(issueMovement?.toLocationId).toBe(factoryLoc.id);
    expect(issueMovement?.quantity).toBe(20);

    // Verify GL: WIP increased by 20 KG * ৳500 = ৳10,000; Materials decreased by ৳10,000
    const statements = await getFinancialStatements();
    const afterWip = statements.balanceSheet.assetAccounts.find((a) => a.code === "1220")?.balance || 0;
    const afterMat = statements.balanceSheet.assetAccounts.find((a) => a.code === "1210")?.balance || 0;

    expect(afterWip - beforeWip).toBe(10000); // ৳10,000 in WIP
    expect(beforeMat - afterMat).toBe(10000); // ৳10,000 consumed from materials

    expect(statements.trialBalance.isBalanced).toBe(true);
  });
});
