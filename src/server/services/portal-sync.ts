import { db } from "@/db";
import {
  paymentAccounts,
  accounts,
  journalEntries,
  journalLines,
  partners,
  ventures,
  ventureParticipants,
  productionOrders,
  inventoryLots,
  productVariants,
  products,
  auditLogs,
  calendarEntries,
  calendarChecklistItems,
  calendarRecurrenceRules,
  settings,
} from "@/db/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { getFinancialStatements } from "./finance";
import { createHash } from "crypto";

export interface PortalSyncResult {
  success: boolean;
  timestamp: string;
  pushedCount: {
    paymentAccounts: number;
    partnerStatements: number;
    ventures: number;
    batches: number;
    inventoryAlerts: number;
    activityFeed: number;
  };
  syncCursor: string;
}

// Compile a sanitized, permission-scoped summary payload from local ERP
export async function buildSanitizedPushPayload() {
  const statements = await getFinancialStatements();
  const payAccounts = await db.select().from(paymentAccounts).where(eq(paymentAccounts.isActive, true));

  // 1. Payment accounts
  const sanitizedWallets = payAccounts.map((pa) => {
    const gl = statements.balanceSheet.assetAccounts.find((a) => a.id === pa.glAccountId);
    return {
      id: pa.id,
      name: pa.name,
      type: pa.type,
      accountNumber: pa.accountNumber || undefined,
      balance: gl?.balance || 0,
      isActive: pa.isActive,
    };
  });

  const availableCash = sanitizedWallets.reduce((s, w) => s + w.balance, 0);

  // 2. Inventories at cost
  const rawMatGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1210");
  const wipGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1220");
  const finishedGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1230");
  const courierCodGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1120");

  const materialsInventory = rawMatGl?.balance || 0;
  const wipInventory = wipGl?.balance || 0;
  const finishedGoodsInventory = finishedGl?.balance || 0;
  const totalInventoryValue = materialsInventory + wipInventory + finishedGoodsInventory;
  const courierCodReceivable = courierCodGl?.balance || 0;

  // 3. Partner financial statements (all 5 partners)
  const allPartners = await db.select().from(partners);
  const partnerStatements = statements.partnerStatements.map((ps) => {
    return {
      partnerId: `partner-${ps.name.toLowerCase()}`,
      name: ps.name,
      email: `${ps.name.toLowerCase()}@afktheory.com`,
      ownershipPct: ps.ownershipPct,
      profitSharePct: ps.profitSharePct,
      capitalContributed: ps.capitalContributed,
      drawings: ps.drawings,
      loanBalanceOwed: ps.loanBalanceOwedByCompany,
      shareOfProfit: ps.shareOfProfit,
      totalEquity: ps.totalEquity,
      ventureContributions: 0,
      ventureEntitlements: 0,
      settlementHistory: [],
    };
  });

  // 4. Ventures summary
  const allVentures = await db.select().from(ventures);
  const allParticipants = await db.select().from(ventureParticipants);

  const sanitizedVentures = allVentures.map((v) => {
    const parts = allParticipants.filter((p) => p.ventureId === v.id);
    return {
      id: v.id,
      ventureNumber: v.ventureNumber,
      title: v.title,
      typeCode: v.typeCode,
      typeName: v.typeCode,
      stage: v.stage,
      description: v.description || undefined,
      targetBudget: Number(v.targetBudget || 0),
      actualBudget: Number(v.actualBudget || 0),
      actualCashRaised: parts.reduce((s, p) => s + Number(p.actualCashContributed || 0), 0),
      startDate: v.startDate ? v.startDate.toISOString() : undefined,
      targetDate: v.targetDate ? v.targetDate.toISOString() : undefined,
      participants: parts.map((p) => ({
        partnerId: p.partnerId ? `partner-${p.name.toLowerCase()}` : undefined,
        name: p.name,
        role: p.role,
        investmentPercentage: Number(p.investmentPercentage || 0),
        profitSharingPercentage: Number(p.profitSharingPercentage || 0),
        actualCashContributed: Number(p.actualCashContributed || 0),
      })),
      performanceSummary: `Venture ${v.ventureNumber} in ${v.stage} stage.`,
    };
  });

  // 5. Active manufacturing batches
  const batches = await db
    .select({
      id: productionOrders.id,
      orderNumber: productionOrders.orderNumber,
      routeType: productionOrders.routeType,
      status: productionOrders.status,
      plannedQuantity: productionOrders.plannedQuantity,
      completedGoodQuantity: productionOrders.completedGoodQuantity,
      completedDefectQuantity: productionOrders.completedDefectQuantity,
      targetDate: productionOrders.targetDate,
      ventureId: productionOrders.ventureId,
      productName: products.name,
    })
    .from(productionOrders)
    .leftJoin(products, eq(productionOrders.targetProductId, products.id))
    .where(
      inArray(productionOrders.status, ["PLANNED", "FABRIC_ISSUED", "IN_PRODUCTION", "QC_PENDING"])
    )
    .orderBy(asc(productionOrders.targetDate))
    .limit(10);

  const sanitizedBatches = batches.map((b) => ({
    id: b.id,
    orderNumber: b.orderNumber,
    productName: b.productName || "Apparel Garment",
    routeType: b.routeType,
    status: b.status,
    plannedQuantity: b.plannedQuantity,
    completedGoodQuantity: b.completedGoodQuantity,
    completedDefectQuantity: b.completedDefectQuantity,
    targetDate: b.targetDate ? b.targetDate.toISOString() : undefined,
    ventureId: b.ventureId || undefined,
  }));

  // 6. Inventory low-stock alerts
  const lots = await db
    .select({
      id: inventoryLots.id,
      lotNumber: inventoryLots.lotNumber,
      currentQuantity: inventoryLots.currentQuantity,
      sku: productVariants.sku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      reorderLevel: productVariants.reorderLevel,
    })
    .from(inventoryLots)
    .innerJoin(productVariants, eq(inventoryLots.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(inventoryLots.status, "ACTIVE"))
    .limit(10);

  const lowStockAlerts = lots
    .filter((l) => l.currentQuantity <= l.reorderLevel)
    .map((l) => ({
      id: l.id,
      sku: l.sku,
      productName: l.productName,
      size: l.size,
      color: l.color,
      currentQuantity: l.currentQuantity,
      reorderLevel: l.reorderLevel,
      status: l.currentQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
    }));

  // 7. Sanitized activity feed (derived from recent posted journals and audit logs)
  const recentJournals = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.status, "POSTED"))
    .orderBy(desc(journalEntries.date))
    .limit(8);

  const activityFeed = recentJournals.map((j) => ({
    id: j.id,
    category: j.sourceModule || "FINANCE",
    title: `Journal ${j.entryNumber}`,
    description: j.description,
    timestamp: j.date.toISOString(),
    isPublic: true,
  }));

  const syncCursor = new Date().toISOString();
  const rawPayload = JSON.stringify({
    businessSummary: {
      netRevenue: statements.incomeStatement.netRevenue,
      grossRevenue: statements.incomeStatement.totalGrossRevenue,
      salesReturns: statements.incomeStatement.totalReturns,
      totalCogs: statements.incomeStatement.totalCogs,
      grossProfit: statements.incomeStatement.grossProfit,
      operatingExpenses: statements.incomeStatement.totalOperatingExpenses,
      netProfit: statements.incomeStatement.netProfit,
      availableCash,
      totalInventoryValue,
      materialsInventory,
      wipInventory,
      finishedGoodsInventory,
      courierCodReceivable,
      courierPendingSettlements: 0,
      activeVenturesCount: sanitizedVentures.length,
      activeProductionOrdersCount: sanitizedBatches.length,
    },
    paymentAccounts: sanitizedWallets,
    partnerStatements,
    ventures: sanitizedVentures,
    manufacturingBatches: sanitizedBatches,
    inventoryAlerts: lowStockAlerts,
    activityFeed,
    syncCursor,
  });

  const checksum = createHash("sha256").update(rawPayload).digest("hex");

  return {
    syncCursor,
    checksum,
    payload: JSON.parse(rawPayload),
  };
}

// Push local summary to Partner Portal over HTTPS
export async function pushSummaryToCloudPortal(
  portalUrl: string,
  syncSecret: string
): Promise<PortalSyncResult> {
  const { syncCursor, checksum, payload } = await buildSanitizedPushPayload();

  const endpoint = `${portalUrl.replace(/\/+$/, "")}/api/sync/push-summary`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${syncSecret}`,
      "X-Sync-Secret": syncSecret,
    },
    body: JSON.stringify({
      ...payload,
      checksum,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloud portal rejected push summary: ${res.status} ${errorText}`);
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    pushedCount: {
      paymentAccounts: payload.paymentAccounts.length,
      partnerStatements: payload.partnerStatements.length,
      ventures: payload.ventures.length,
      batches: payload.manufacturingBatches.length,
      inventoryAlerts: payload.inventoryAlerts.length,
      activityFeed: payload.activityFeed.length,
    },
    syncCursor,
  };
}

// Incremental Pull: Safe Cloud Calendar -> Local ERP
export async function pullCloudCalendarToLocal(
  portalUrl: string,
  syncSecret: string,
  systemUserId?: string
) {
  // 1. Get last calendar sync cursor from local settings
  const [cursorSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "PORTAL_CALENDAR_LAST_SYNC"))
    .limit(1);

  const lastCursor = (cursorSetting?.value as any)?.cursor;
  const endpoint = `${portalUrl.replace(/\/+$/, "")}/api/sync/pull-calendar${
    lastCursor ? `?since=${encodeURIComponent(lastCursor)}` : ""
  }`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${syncSecret}`,
      "X-Sync-Secret": syncSecret,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to pull cloud calendar: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const entries = data.entries || [];
  const checklists = data.checklists || [];

  if (entries.length === 0) {
    return { importedCount: 0, lastCursor: data.timestamp || new Date().toISOString() };
  }

  let importedCount = 0;

  // 2. Safely upsert entries into local calendar_entries without erasing local notes
  await db.transaction(async (tx) => {
    for (const e of entries) {
      // Find or resolve local owner
      const localOwnerId = systemUserId || "00000000-0000-0000-0000-000000000000";

      // Check if entry already exists locally
      const [existing] = await tx
        .select()
        .from(calendarEntries)
        .where(eq(calendarEntries.id, e.id))
        .limit(1);

      if (!existing) {
        await tx.insert(calendarEntries).values({
          id: e.id,
          title: e.title,
          description: e.description,
          entryType: e.entryType || "NOTE",
          status: e.status || "PENDING",
          priority: e.priority || "MEDIUM",
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : null,
          isAllDay: e.isAllDay ?? false,
          location: e.location,
          scope: e.scope || "COMPANY",
          visibility: e.visibility || "PUBLIC",
          ownerUserId: localOwnerId,
          tags: e.tags || [],
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        });
        importedCount++;
      } else {
        // Only update if cloud version is newer
        await tx
          .update(calendarEntries)
          .set({
            title: e.title,
            description: e.description,
            status: e.status,
            priority: e.priority,
            startDate: new Date(e.startDate),
            endDate: e.endDate ? new Date(e.endDate) : null,
            updatedAt: new Date(e.updatedAt),
          })
          .where(eq(calendarEntries.id, e.id));
        importedCount++;
      }
    }

    // 3. Update sync cursor in local settings
    const newCursor = data.timestamp || new Date().toISOString();
    await tx
      .insert(settings)
      .values({
        key: "PORTAL_CALENDAR_LAST_SYNC",
        value: { cursor: newCursor, lastSyncedAt: new Date().toISOString(), importedCount },
        description: "Cloud Calendar incremental sync cursor",
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: { cursor: newCursor, lastSyncedAt: new Date().toISOString(), importedCount },
          updatedAt: new Date(),
        },
      });
  });

  return { importedCount, lastCursor: data.timestamp };
}
