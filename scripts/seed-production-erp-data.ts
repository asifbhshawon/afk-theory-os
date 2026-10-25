import { db } from "../src/db";
import {
  partners,
  paymentAccounts,
  accounts,
  products,
  productVariants,
  ventures,
  ventureAgreements,
  ventureParticipants,
  ventureTypes,
  productionOrders,
  inventoryLots,
  journalEntries,
} from "../src/db/schema";
import { recordPartnerContribution, postJournalEntry } from "../src/server/services/finance";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();

async function seed() {
  console.log("Seeding full business operational data into local Business OS ERP...");

  // 1. Get partners & payment accounts
  const allPartners = await db.select().from(partners);
  const [bankAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
  const [cashAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

  const shawon = allPartners.find((p) => p.name === "Shawon");
  const rafi = allPartners.find((p) => p.name === "Rafi");
  const tousif = allPartners.find((p) => p.name === "Tousif");
  const midhat = allPartners.find((p) => p.name === "Midhat");
  const mueid = allPartners.find((p) => p.name === "Mueid");

  if (!shawon || !bankAcc) {
    throw new Error("Shawon partner or bank account not found");
  }

  // 2. Post Partner Capital Contributions (idempotent checks)
  console.log("Checking partner capital contributions...");
  const existingContributions = await db
    .select()
    .from(journalEntries)
    .where(
      inArray(journalEntries.reference, [
        "SHAWON-CAPITAL-2026",
        "RAFI-CAPITAL-2026",
        "TOUSIF-CAPITAL-2026",
        "MIDHAT-CAPITAL-2026",
        "MUEID-CAPITAL-2026",
      ])
    );

  const existingRefs = new Set(existingContributions.map((c) => c.reference));

  if (!existingRefs.has("SHAWON-CAPITAL-2026")) {
    await recordPartnerContribution({
      partnerId: shawon.id,
      amount: 100000,
      paymentAccountId: bankAcc.id,
      reference: "SHAWON-CAPITAL-2026",
      date: new Date(),
    });
    console.log("- Shawon: ৳100,000 capital deposited");
  }

  if (!existingRefs.has("RAFI-CAPITAL-2026")) {
    await recordPartnerContribution({
      partnerId: rafi!.id,
      amount: 50000,
      paymentAccountId: bankAcc.id,
      reference: "RAFI-CAPITAL-2026",
      date: new Date(),
    });
    console.log("- Rafi: ৳50,000 capital deposited");
  }

  if (!existingRefs.has("TOUSIF-CAPITAL-2026")) {
    await recordPartnerContribution({
      partnerId: tousif!.id,
      amount: 50000,
      paymentAccountId: bankAcc.id,
      reference: "TOUSIF-CAPITAL-2026",
      date: new Date(),
    });
    console.log("- Tousif: ৳50,000 capital deposited");
  }

  if (!existingRefs.has("MIDHAT-CAPITAL-2026")) {
    await recordPartnerContribution({
      partnerId: midhat!.id,
      amount: 10000,
      paymentAccountId: bankAcc.id,
      reference: "MIDHAT-CAPITAL-2026",
      date: new Date(),
    });
    console.log("- Midhat: ৳10,000 capital deposited");
  }

  if (!existingRefs.has("MUEID-CAPITAL-2026")) {
    await recordPartnerContribution({
      partnerId: mueid!.id,
      amount: 9000,
      paymentAccountId: bankAcc.id,
      reference: "MUEID-CAPITAL-2026",
      date: new Date(),
    });
    console.log("- Mueid: ৳9,000 capital deposited");
  }

  // 3. Products & Variants
  console.log("Upserting apparel products & variants...");
  let [teeProduct] = await db.select().from(products).where(eq(products.styleCode, "AFK-DS-T001")).limit(1);
  if (!teeProduct) {
    [teeProduct] = await db
      .insert(products)
      .values({
        id: randomUUID(),
        name: "AFK French Terry Drop-Shoulder Tee",
        styleCode: "AFK-DS-T001",
        category: "T-Shirts",
        fabricType: "French Terry (280 GSM)",
        baseCostPrice: "350.00",
        baseSellingPrice: "1250.00",
        targetGsm: 280,
        status: "ACTIVE",
      })
      .returning();
  }

  let [hoodieProduct] = await db.select().from(products).where(eq(products.styleCode, "AFK-HW-H001")).limit(1);
  if (!hoodieProduct) {
    [hoodieProduct] = await db
      .insert(products)
      .values({
        id: randomUUID(),
        name: "AFK Heavyweight Minimalist Hoodie",
        styleCode: "AFK-HW-H001",
        category: "Hoodies",
        fabricType: "Brushed Fleece (380 GSM)",
        baseCostPrice: "650.00",
        baseSellingPrice: "2450.00",
        targetGsm: 380,
        status: "ACTIVE",
      })
      .returning();
  }

  // Create variants
  const teeVariants = [
    { sku: "AFK-DS-T001-BLK-M", size: "M", color: "Matte Black", costPrice: "350.00", sellingPrice: "1250.00", reorderLevel: 50 },
    { sku: "AFK-DS-T001-BLK-L", size: "L", color: "Matte Black", costPrice: "350.00", sellingPrice: "1250.00", reorderLevel: 50 },
    { sku: "AFK-DS-T001-WHT-M", size: "M", color: "Vintage White", costPrice: "350.00", sellingPrice: "1250.00", reorderLevel: 40 },
    { sku: "AFK-DS-T001-WHT-L", size: "L", color: "Vintage White", costPrice: "350.00", sellingPrice: "1250.00", reorderLevel: 40 },
  ];

  for (const tv of teeVariants) {
    const [existing] = await db.select().from(productVariants).where(eq(productVariants.sku, tv.sku)).limit(1);
    if (!existing) {
      await db.insert(productVariants).values({
        id: randomUUID(),
        productId: teeProduct.id,
        sku: tv.sku,
        size: tv.size,
        color: tv.color,
        costPrice: tv.costPrice,
        sellingPrice: tv.sellingPrice,
        reorderLevel: tv.reorderLevel,
        status: "ACTIVE",
      });
    }
  }

  const hoodieVariants = [
    { sku: "AFK-HW-H001-BLK-M", size: "M", color: "Obsidian Black", costPrice: "650.00", sellingPrice: "2450.00", reorderLevel: 30 },
    { sku: "AFK-HW-H001-BLK-L", size: "L", color: "Obsidian Black", costPrice: "650.00", sellingPrice: "2450.00", reorderLevel: 30 },
  ];

  for (const hv of hoodieVariants) {
    const [existing] = await db.select().from(productVariants).where(eq(productVariants.sku, hv.sku)).limit(1);
    if (!existing) {
      await db.insert(productVariants).values({
        id: randomUUID(),
        productId: hoodieProduct.id,
        sku: hv.sku,
        size: hv.size,
        color: hv.color,
        costPrice: hv.costPrice,
        sellingPrice: hv.sellingPrice,
        reorderLevel: hv.reorderLevel,
        status: "ACTIVE",
      });
    }
  }

  // 4. Ventures & Agreements & Participants
  console.log("Upserting venture agreements...");
  let [typeDrop] = await db.select().from(ventureTypes).where(eq(ventureTypes.code, "PRODUCT_DROP")).limit(1);
  if (!typeDrop) {
    [typeDrop] = await db
      .insert(ventureTypes)
      .values({
        code: "PRODUCT_DROP",
        name: "Product Collection Drop",
        description: "Seasonal limited capsule drop venture",
        defaultAccountingMode: "RING_FENCED",
        isSharedEquity: false,
      })
      .returning();
  }

  // Venture 1: Drop 01 Tees
  let [vent1] = await db.select().from(ventures).where(eq(ventures.ventureNumber, "VENT-2026-0001")).limit(1);
  if (!vent1) {
    [vent1] = await db
      .insert(ventures)
      .values({
        id: randomUUID(),
        ventureNumber: "VENT-2026-0001",
        title: "Drop 01 — French Terry Oversized Tees",
        typeCode: "PRODUCT_DROP",
        stage: "ACTIVE",
        description: "Capsule Drop 01 featuring 500 units of custom 280 GSM French Terry drop-shoulder tees.",
        targetBudget: "250000.00",
        actualBudget: "250000.00",
        startDate: new Date("2026-10-01"),
        targetDate: new Date("2026-11-15"),
      })
      .returning();
  }

  let [agr1] = await db.select().from(ventureAgreements).where(eq(ventureAgreements.ventureId, vent1.id)).limit(1);
  if (!agr1) {
    [agr1] = await db
      .insert(ventureAgreements)
      .values({
        id: randomUUID(),
        ventureId: vent1.id,
        version: 1,
        status: "ACTIVE",
        participationMode: "CUSTOM_PROFIT",
        effectiveDate: new Date("2026-10-01"),
        notes: "Founding agreement for Drop 01 capsule",
      })
      .returning();
  }

  const existingParts1 = await db.select().from(ventureParticipants).where(eq(ventureParticipants.ventureId, vent1.id));
  if (existingParts1.length === 0) {
    await db.insert(ventureParticipants).values([
      {
        id: randomUUID(),
        agreementId: agr1.id,
        ventureId: vent1.id,
        partnerId: shawon.id,
        name: "Shawon",
        role: "LEAD_INVESTOR",
        investmentPercentage: "30.00",
        profitSharingPercentage: "30.00",
        investmentCommitment: "75000.00",
        actualCashContributed: "75000.00",
        status: "ACTIVE",
      },
      {
        id: randomUUID(),
        agreementId: agr1.id,
        ventureId: vent1.id,
        partnerId: rafi!.id,
        name: "Rafi",
        role: "CO_INVESTOR",
        investmentPercentage: "30.00",
        profitSharingPercentage: "30.00",
        investmentCommitment: "75000.00",
        actualCashContributed: "75000.00",
        status: "ACTIVE",
      },
      {
        id: randomUUID(),
        agreementId: agr1.id,
        ventureId: vent1.id,
        partnerId: tousif!.id,
        name: "Tousif",
        role: "CO_INVESTOR",
        investmentPercentage: "20.00",
        profitSharingPercentage: "20.00",
        investmentCommitment: "50000.00",
        actualCashContributed: "50000.00",
        status: "ACTIVE",
      },
      {
        id: randomUUID(),
        agreementId: agr1.id,
        ventureId: vent1.id,
        partnerId: midhat!.id,
        name: "Midhat",
        role: "CO_INVESTOR",
        investmentPercentage: "20.00",
        profitSharingPercentage: "20.00",
        investmentCommitment: "50000.00",
        actualCashContributed: "50000.00",
        status: "ACTIVE",
      },
    ]);
  }

  // Venture 2: Drop 02 Hoodies
  let [vent2] = await db.select().from(ventures).where(eq(ventures.ventureNumber, "VENT-2026-0002")).limit(1);
  if (!vent2) {
    [vent2] = await db
      .insert(ventures)
      .values({
        id: randomUUID(),
        ventureNumber: "VENT-2026-0002",
        title: "Drop 02 — Winter Heavyweight Hoodies",
        typeCode: "PRODUCT_DROP",
        stage: "PLANNING",
        description: "Winter capsule collection: 300 units of custom 380 GSM brushed fleece boxy hoodies.",
        targetBudget: "300000.00",
        actualBudget: "200000.00",
        startDate: new Date("2026-10-15"),
        targetDate: new Date("2026-12-20"),
      })
      .returning();
  }

  let [agr2] = await db.select().from(ventureAgreements).where(eq(ventureAgreements.ventureId, vent2.id)).limit(1);
  if (!agr2) {
    [agr2] = await db
      .insert(ventureAgreements)
      .values({
        id: randomUUID(),
        ventureId: vent2.id,
        version: 1,
        status: "ACTIVE",
        participationMode: "CUSTOM_PROFIT",
        effectiveDate: new Date("2026-10-15"),
        notes: "Founding agreement for Drop 02 capsule",
      })
      .returning();
  }

  const existingParts2 = await db.select().from(ventureParticipants).where(eq(ventureParticipants.ventureId, vent2.id));
  if (existingParts2.length === 0) {
    await db.insert(ventureParticipants).values([
      {
        id: randomUUID(),
        agreementId: agr2.id,
        ventureId: vent2.id,
        partnerId: shawon.id,
        name: "Shawon",
        role: "LEAD_INVESTOR",
        investmentPercentage: "40.00",
        profitSharingPercentage: "40.00",
        investmentCommitment: "120000.00",
        actualCashContributed: "80000.00",
        status: "ACTIVE",
      },
      {
        id: randomUUID(),
        agreementId: agr2.id,
        ventureId: vent2.id,
        partnerId: rafi!.id,
        name: "Rafi",
        role: "CO_INVESTOR",
        investmentPercentage: "30.00",
        profitSharingPercentage: "30.00",
        investmentCommitment: "90000.00",
        actualCashContributed: "60000.00",
        status: "ACTIVE",
      },
      {
        id: randomUUID(),
        agreementId: agr2.id,
        ventureId: vent2.id,
        partnerId: mueid!.id,
        name: "Mueid",
        role: "CO_INVESTOR",
        investmentPercentage: "30.00",
        profitSharingPercentage: "30.00",
        investmentCommitment: "90000.00",
        actualCashContributed: "60000.00",
        status: "ACTIVE",
      },
    ]);
  }

  // 5. Production Orders / Manufacturing Batches
  console.log("Upserting manufacturing batches...");
  let [batch1] = await db.select().from(productionOrders).where(eq(productionOrders.orderNumber, "AFK-MFG-2026-001")).limit(1);
  if (!batch1) {
    await db.insert(productionOrders).values({
      id: randomUUID(),
      orderNumber: "AFK-MFG-2026-001",
      targetProductId: teeProduct.id,
      ventureId: vent1.id,
      routeType: "FABRIC_OUTSOURCED",
      status: "QC_PENDING",
      plannedQuantity: 500,
      completedGoodQuantity: 420,
      completedDefectQuantity: 12,
      targetDate: new Date(Date.now() + 10 * 86400000),
    });
  }

  let [batch2] = await db.select().from(productionOrders).where(eq(productionOrders.orderNumber, "AFK-MFG-2026-002")).limit(1);
  if (!batch2) {
    await db.insert(productionOrders).values({
      id: randomUUID(),
      orderNumber: "AFK-MFG-2026-002",
      targetProductId: hoodieProduct.id,
      ventureId: vent2.id,
      routeType: "FABRIC_OUTSOURCED",
      status: "IN_PRODUCTION",
      plannedQuantity: 300,
      completedGoodQuantity: 150,
      completedDefectQuantity: 5,
      targetDate: new Date(Date.now() + 25 * 86400000),
    });
  }

  // 6. Inventories
  console.log("Upserting inventory lots...");
  const [variantM] = await db.select().from(productVariants).where(eq(productVariants.sku, "AFK-DS-T001-BLK-M")).limit(1);
  const [variantL] = await db.select().from(productVariants).where(eq(productVariants.sku, "AFK-DS-T001-BLK-L")).limit(1);
  const [variantH] = await db.select().from(productVariants).where(eq(productVariants.sku, "AFK-HW-H001-BLK-M")).limit(1);

  let [lot1] = await db.select().from(inventoryLots).where(eq(inventoryLots.lotNumber, "LOT-2026-001")).limit(1);
  if (!lot1 && variantM) {
    await db.insert(inventoryLots).values({
      id: randomUUID(),
      lotNumber: "LOT-2026-001",
      variantId: variantM.id,
      initialQuantity: 250,
      currentQuantity: 25, // <= 50, triggers low-stock indicator
      unitCost: "350.00",
      totalCost: "8750.00",
      status: "ACTIVE",
    });
  }

  let [lot2] = await db.select().from(inventoryLots).where(eq(inventoryLots.lotNumber, "LOT-2026-002")).limit(1);
  if (!lot2 && variantL) {
    await db.insert(inventoryLots).values({
      id: randomUUID(),
      lotNumber: "LOT-2026-002",
      variantId: variantL.id,
      initialQuantity: 250,
      currentQuantity: 180,
      unitCost: "350.00",
      totalCost: "63000.00",
      status: "ACTIVE",
    });
  }

  let [lot3] = await db.select().from(inventoryLots).where(eq(inventoryLots.lotNumber, "LOT-2026-003")).limit(1);
  if (!lot3 && variantH) {
    await db.insert(inventoryLots).values({
      id: randomUUID(),
      lotNumber: "LOT-2026-003",
      variantId: variantH.id,
      initialQuantity: 150,
      currentQuantity: 140,
      unitCost: "650.00",
      totalCost: "91000.00",
      status: "ACTIVE",
    });
  }

  // 7. Post Operational Transactions to GL
  console.log("Posting operational journals to double-entry ledger...");
  const [courierGl] = await db.select().from(accounts).where(eq(accounts.code, "1120")).limit(1);
  const [salesGl] = await db.select().from(accounts).where(eq(accounts.code, "4010")).limit(1);
  const [cogsGl] = await db.select().from(accounts).where(eq(accounts.code, "5010")).limit(1);
  const [fgGl] = await db.select().from(accounts).where(eq(accounts.code, "1230")).limit(1);
  const [mktGl] = await db.select().from(accounts).where(eq(accounts.code, "6030")).limit(1);
  const [pkgGl] = await db.select().from(accounts).where(eq(accounts.code, "6020")).limit(1);

  // 7.1 Finished Goods acquisition & inventory receipt
  const [stockEntry] = await db.select().from(journalEntries).where(eq(journalEntries.reference, "GRN-2026-001")).limit(1);
  if (!stockEntry && fgGl && bankAcc) {
    await postJournalEntry({
      date: new Date(),
      entryType: "INVENTORY_RECEIPT",
      description: "Finished goods stock acquisition & warehouse receipt for Drop 01 & Drop 02",
      reference: "GRN-2026-001",
      sourceModule: "INVENTORY",
      lines: [
        {
          accountId: fgGl.id,
          debit: 139250,
          credit: 0,
          memo: "Garment inventory on hand at cost (Tees + Hoodies)",
        },
        {
          accountId: bankAcc.glAccountId,
          debit: 0,
          credit: 139250,
          memo: "Vendor factory settlement for production batch",
        },
      ],
    });
    console.log("- Posted finished goods stock receipt: ৳139,250");
  }

  // 7.2 Direct online customer sales
  const [directSaleEntry] = await db.select().from(journalEntries).where(eq(journalEntries.reference, "PRE-ORD-2026-001")).limit(1);
  if (!directSaleEntry && salesGl && bankAcc) {
    await postJournalEntry({
      date: new Date(),
      entryType: "SALES_DIRECT",
      description: "Direct pre-order sales revenue received via Bank Transfer",
      reference: "PRE-ORD-2026-001",
      sourceModule: "SALES",
      lines: [
        {
          accountId: bankAcc.glAccountId,
          debit: 95000,
          credit: 0,
          memo: "Pre-order customer bank payments",
        },
        {
          accountId: salesGl.id,
          debit: 0,
          credit: 95000,
          memo: "Apparel direct sales revenue",
        },
      ],
    });
    console.log("- Posted direct bank sales: ৳95,000");
  }

  // 7.3 Courier dispatches (COD pending settlement via Steadfast / Pathao)
  const [courierEntry] = await db.select().from(journalEntries).where(eq(journalEntries.reference, "AFK-SET-2026-001")).limit(1);
  if (!courierEntry && courierGl && salesGl) {
    await postJournalEntry({
      date: new Date(),
      entryType: "SALES_DISPATCH",
      description: "Dispatched e-commerce sales batch via Steadfast & Pathao Courier COD",
      reference: "AFK-SET-2026-001",
      sourceModule: "SALES",
      lines: [
        {
          accountId: courierGl.id,
          debit: 68500,
          credit: 0,
          memo: "Courier COD pending settlement",
        },
        {
          accountId: salesGl.id,
          debit: 0,
          credit: 68500,
          memo: "Gross e-commerce sales revenue dispatched",
        },
      ],
    });
    console.log("- Posted Courier COD receivable: ৳68,500");
  }

  // 7.4 Cost of Goods Sold (COGS)
  const [cogsEntry] = await db.select().from(journalEntries).where(eq(journalEntries.reference, "COGS-2026-001")).limit(1);
  if (!cogsEntry && cogsGl && fgGl) {
    await postJournalEntry({
      date: new Date(),
      entryType: "COGS_RECOGNITION",
      description: "Cost of goods sold matched to fulfilled apparel orders",
      reference: "COGS-2026-001",
      sourceModule: "INVENTORY",
      lines: [
        {
          accountId: cogsGl.id,
          debit: 42000,
          credit: 0,
          memo: "COGS on dispatched tees and hoodies",
        },
        {
          accountId: fgGl.id,
          debit: 0,
          credit: 42000,
          memo: "Inventory depletion at weighted cost",
        },
      ],
    });
    console.log("- Posted COGS recognition: ৳42,000");
  }

  // 7.5 Marketing & Packaging Operating Expenses
  const [expEntry] = await db.select().from(journalEntries).where(eq(journalEntries.reference, "OPEX-2026-001")).limit(1);
  if (!expEntry && mktGl && pkgGl && bankAcc) {
    await postJournalEntry({
      date: new Date(),
      entryType: "EXPENSE_PAYMENT",
      description: "Operating expenses for Drop 01 campaign launch & custom boxes",
      reference: "OPEX-2026-001",
      sourceModule: "EXPENSES",
      lines: [
        {
          accountId: mktGl.id,
          debit: 15000,
          credit: 0,
          memo: "Meta ads & product photography",
        },
        {
          accountId: pkgGl.id,
          debit: 8500,
          credit: 0,
          memo: "Custom mailer boxes & woven label tags",
        },
        {
          accountId: bankAcc.glAccountId,
          debit: 0,
          credit: 23500,
          memo: "Bank settlement for marketing & packaging",
        },
      ],
    });
    console.log("- Posted operating expenses: ৳23,500");
  }

  console.log("\n[SUCCESS] Local ERP operational data successfully seeded and balanced!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
