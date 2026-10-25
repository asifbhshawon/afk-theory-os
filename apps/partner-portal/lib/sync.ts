import { db } from "./db";
import {
  portalSyncMeta,
  portalBusinessSummaries,
  portalPaymentAccounts,
  portalPartnerStatements,
  portalVentures,
  portalManufacturingBatches,
  portalInventoryAlerts,
  portalActivityFeed,
  portalCalendarEntries,
  portalCalendarChecklists,
  portalCalendarRecurrence,
} from "./schema";
import { eq, gt, and, desc, sql } from "drizzle-orm";

export interface SyncPushPayload {
  syncCursor: string;
  checksum?: string;
  businessSummary: {
    periodStart?: string;
    periodEnd?: string;
    netRevenue: number;
    grossRevenue: number;
    salesReturns: number;
    totalCogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    availableCash: number;
    totalInventoryValue: number;
    materialsInventory: number;
    wipInventory: number;
    finishedGoodsInventory: number;
    courierCodReceivable: number;
    courierPendingSettlements: number;
    activeVenturesCount: number;
    activeProductionOrdersCount: number;
    metadata?: Record<string, any>;
  };
  paymentAccounts?: {
    id: string;
    name: string;
    type: string;
    accountNumber?: string;
    balance: number;
    isActive?: boolean;
  }[];
  partnerStatements?: {
    partnerId: string;
    name: string;
    email: string;
    ownershipPct: number;
    profitSharePct: number;
    capitalContributed: number;
    drawings: number;
    loanBalanceOwed: number;
    shareOfProfit: number;
    totalEquity: number;
    ventureContributions?: number;
    ventureEntitlements?: number;
    settlementHistory?: any[];
  }[];
  ventures?: {
    id: string;
    ventureNumber: string;
    title: string;
    typeCode: string;
    typeName: string;
    stage: string;
    description?: string;
    targetBudget: number;
    actualBudget: number;
    actualCashRaised: number;
    startDate?: string;
    targetDate?: string;
    productionProgress?: any;
    salesProgress?: any;
    participants?: any[];
    performanceSummary?: string;
  }[];
  manufacturingBatches?: {
    id: string;
    orderNumber: string;
    productName: string;
    routeType: string;
    status: string;
    plannedQuantity: number;
    completedGoodQuantity: number;
    completedDefectQuantity: number;
    targetDate?: string;
    ventureId?: string;
  }[];
  inventoryAlerts?: {
    id: string;
    sku: string;
    productName: string;
    size?: string;
    color?: string;
    currentQuantity: number;
    reorderLevel: number;
    status: string;
  }[];
  activityFeed?: {
    id: string;
    category: string;
    title: string;
    description: string;
    timestamp: string;
    actorName?: string;
    ventureId?: string;
    partnerId?: string;
    isPublic?: boolean;
  }[];
}

// Atomically process incoming push summary from local Business OS
export async function applyLocalErpPushSummary(payload: SyncPushPayload) {
  const now = new Date();

  return await db.transaction(async (tx) => {
    // 1. Upsert business overview snapshot (keyed as "latest")
    await tx
      .insert(portalBusinessSummaries)
      .values({
        id: "latest",
        periodStart: payload.businessSummary.periodStart ? new Date(payload.businessSummary.periodStart) : null,
        periodEnd: payload.businessSummary.periodEnd ? new Date(payload.businessSummary.periodEnd) : null,
        netRevenue: payload.businessSummary.netRevenue.toFixed(2),
        grossRevenue: payload.businessSummary.grossRevenue.toFixed(2),
        salesReturns: payload.businessSummary.salesReturns.toFixed(2),
        totalCogs: payload.businessSummary.totalCogs.toFixed(2),
        grossProfit: payload.businessSummary.grossProfit.toFixed(2),
        operatingExpenses: payload.businessSummary.operatingExpenses.toFixed(2),
        netProfit: payload.businessSummary.netProfit.toFixed(2),
        availableCash: payload.businessSummary.availableCash.toFixed(2),
        totalInventoryValue: payload.businessSummary.totalInventoryValue.toFixed(2),
        materialsInventory: payload.businessSummary.materialsInventory.toFixed(2),
        wipInventory: payload.businessSummary.wipInventory.toFixed(2),
        finishedGoodsInventory: payload.businessSummary.finishedGoodsInventory.toFixed(2),
        courierCodReceivable: payload.businessSummary.courierCodReceivable.toFixed(2),
        courierPendingSettlements: payload.businessSummary.courierPendingSettlements.toFixed(2),
        activeVenturesCount: payload.businessSummary.activeVenturesCount,
        activeProductionOrdersCount: payload.businessSummary.activeProductionOrdersCount,
        metadata: payload.businessSummary.metadata || {},
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: portalBusinessSummaries.id,
        set: {
          periodStart: payload.businessSummary.periodStart ? new Date(payload.businessSummary.periodStart) : null,
          periodEnd: payload.businessSummary.periodEnd ? new Date(payload.businessSummary.periodEnd) : null,
          netRevenue: payload.businessSummary.netRevenue.toFixed(2),
          grossRevenue: payload.businessSummary.grossRevenue.toFixed(2),
          salesReturns: payload.businessSummary.salesReturns.toFixed(2),
          totalCogs: payload.businessSummary.totalCogs.toFixed(2),
          grossProfit: payload.businessSummary.grossProfit.toFixed(2),
          operatingExpenses: payload.businessSummary.operatingExpenses.toFixed(2),
          netProfit: payload.businessSummary.netProfit.toFixed(2),
          availableCash: payload.businessSummary.availableCash.toFixed(2),
          totalInventoryValue: payload.businessSummary.totalInventoryValue.toFixed(2),
          materialsInventory: payload.businessSummary.materialsInventory.toFixed(2),
          wipInventory: payload.businessSummary.wipInventory.toFixed(2),
          finishedGoodsInventory: payload.businessSummary.finishedGoodsInventory.toFixed(2),
          courierCodReceivable: payload.businessSummary.courierCodReceivable.toFixed(2),
          courierPendingSettlements: payload.businessSummary.courierPendingSettlements.toFixed(2),
          activeVenturesCount: payload.businessSummary.activeVenturesCount,
          activeProductionOrdersCount: payload.businessSummary.activeProductionOrdersCount,
          metadata: payload.businessSummary.metadata || {},
          updatedAt: now,
        },
      });

    // 2. Upsert payment accounts
    if (payload.paymentAccounts && payload.paymentAccounts.length > 0) {
      for (const pa of payload.paymentAccounts) {
        await tx
          .insert(portalPaymentAccounts)
          .values({
            id: pa.id,
            name: pa.name,
            type: pa.type,
            accountNumber: pa.accountNumber || null,
            balance: pa.balance.toFixed(2),
            isActive: pa.isActive ?? true,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: portalPaymentAccounts.id,
            set: {
              name: pa.name,
              type: pa.type,
              accountNumber: pa.accountNumber || null,
              balance: pa.balance.toFixed(2),
              isActive: pa.isActive ?? true,
              updatedAt: now,
            },
          });
      }
    }

    // 3. Upsert partner statements
    if (payload.partnerStatements && payload.partnerStatements.length > 0) {
      for (const ps of payload.partnerStatements) {
        await tx
          .insert(portalPartnerStatements)
          .values({
            id: ps.partnerId,
            partnerId: ps.partnerId,
            name: ps.name,
            email: ps.email,
            ownershipPct: ps.ownershipPct.toFixed(2),
            profitSharePct: ps.profitSharePct.toFixed(2),
            capitalContributed: ps.capitalContributed.toFixed(2),
            drawings: ps.drawings.toFixed(2),
            loanBalanceOwed: ps.loanBalanceOwed.toFixed(2),
            shareOfProfit: ps.shareOfProfit.toFixed(2),
            totalEquity: ps.totalEquity.toFixed(2),
            ventureContributions: (ps.ventureContributions || 0).toFixed(2),
            ventureEntitlements: (ps.ventureEntitlements || 0).toFixed(2),
            settlementHistory: ps.settlementHistory || [],
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: portalPartnerStatements.id,
            set: {
              name: ps.name,
              email: ps.email,
              ownershipPct: ps.ownershipPct.toFixed(2),
              profitSharePct: ps.profitSharePct.toFixed(2),
              capitalContributed: ps.capitalContributed.toFixed(2),
              drawings: ps.drawings.toFixed(2),
              loanBalanceOwed: ps.loanBalanceOwed.toFixed(2),
              shareOfProfit: ps.shareOfProfit.toFixed(2),
              totalEquity: ps.totalEquity.toFixed(2),
              ventureContributions: (ps.ventureContributions || 0).toFixed(2),
              ventureEntitlements: (ps.ventureEntitlements || 0).toFixed(2),
              settlementHistory: ps.settlementHistory || [],
              updatedAt: now,
            },
          });
      }
    }

    // 4. Upsert ventures
    if (payload.ventures && payload.ventures.length > 0) {
      for (const v of payload.ventures) {
        await tx
          .insert(portalVentures)
          .values({
            id: v.id,
            ventureNumber: v.ventureNumber,
            title: v.title,
            typeCode: v.typeCode,
            typeName: v.typeName,
            stage: v.stage,
            description: v.description || null,
            targetBudget: v.targetBudget.toFixed(2),
            actualBudget: v.actualBudget.toFixed(2),
            actualCashRaised: v.actualCashRaised.toFixed(2),
            startDate: v.startDate ? new Date(v.startDate) : null,
            targetDate: v.targetDate ? new Date(v.targetDate) : null,
            productionProgress: v.productionProgress || {},
            salesProgress: v.salesProgress || {},
            participants: v.participants || [],
            performanceSummary: v.performanceSummary || null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: portalVentures.id,
            set: {
              ventureNumber: v.ventureNumber,
              title: v.title,
              typeCode: v.typeCode,
              typeName: v.typeName,
              stage: v.stage,
              description: v.description || null,
              targetBudget: v.targetBudget.toFixed(2),
              actualBudget: v.actualBudget.toFixed(2),
              actualCashRaised: v.actualCashRaised.toFixed(2),
              startDate: v.startDate ? new Date(v.startDate) : null,
              targetDate: v.targetDate ? new Date(v.targetDate) : null,
              productionProgress: v.productionProgress || {},
              salesProgress: v.salesProgress || {},
              participants: v.participants || [],
              performanceSummary: v.performanceSummary || null,
              updatedAt: now,
            },
          });
      }
    }

    // 5. Upsert manufacturing batches
    if (payload.manufacturingBatches && payload.manufacturingBatches.length > 0) {
      for (const m of payload.manufacturingBatches) {
        await tx
          .insert(portalManufacturingBatches)
          .values({
            id: m.id,
            orderNumber: m.orderNumber,
            productName: m.productName,
            routeType: m.routeType,
            status: m.status,
            plannedQuantity: m.plannedQuantity,
            completedGoodQuantity: m.completedGoodQuantity,
            completedDefectQuantity: m.completedDefectQuantity,
            targetDate: m.targetDate ? new Date(m.targetDate) : null,
            ventureId: m.ventureId || null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: portalManufacturingBatches.id,
            set: {
              orderNumber: m.orderNumber,
              productName: m.productName,
              routeType: m.routeType,
              status: m.status,
              plannedQuantity: m.plannedQuantity,
              completedGoodQuantity: m.completedGoodQuantity,
              completedDefectQuantity: m.completedDefectQuantity,
              targetDate: m.targetDate ? new Date(m.targetDate) : null,
              ventureId: m.ventureId || null,
              updatedAt: now,
            },
          });
      }
    }

    // 6. Upsert inventory alerts
    if (payload.inventoryAlerts && payload.inventoryAlerts.length > 0) {
      for (const a of payload.inventoryAlerts) {
        await tx
          .insert(portalInventoryAlerts)
          .values({
            id: a.id,
            sku: a.sku,
            productName: a.productName,
            size: a.size || null,
            color: a.color || null,
            currentQuantity: a.currentQuantity,
            reorderLevel: a.reorderLevel,
            status: a.status,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: portalInventoryAlerts.id,
            set: {
              productName: a.productName,
              size: a.size || null,
              color: a.color || null,
              currentQuantity: a.currentQuantity,
              reorderLevel: a.reorderLevel,
              status: a.status,
              updatedAt: now,
            },
          });
      }
    }

    // 7. Upsert activity feed items
    if (payload.activityFeed && payload.activityFeed.length > 0) {
      for (const act of payload.activityFeed) {
        await tx
          .insert(portalActivityFeed)
          .values({
            id: act.id,
            category: act.category,
            title: act.title,
            description: act.description,
            timestamp: new Date(act.timestamp),
            actorName: act.actorName || null,
            ventureId: act.ventureId || null,
            partnerId: act.partnerId || null,
            isPublic: act.isPublic ?? true,
          })
          .onConflictDoNothing();
      }
    }

    // 8. Update sync metadata singleton
    await tx
      .insert(portalSyncMeta)
      .values({
        id: "singleton",
        lastPushedAt: now,
        lastPushStatus: "SUCCESS",
        sourceSystem: "AFK_LOCAL_ERP",
        syncCursor: payload.syncCursor,
        summaryChecksum: payload.checksum || null,
        errorMessage: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: portalSyncMeta.id,
        set: {
          lastPushedAt: now,
          lastPushStatus: "SUCCESS",
          sourceSystem: "AFK_LOCAL_ERP",
          syncCursor: payload.syncCursor,
          summaryChecksum: payload.checksum || null,
          errorMessage: null,
          updatedAt: now,
        },
      });

    return {
      success: true,
      lastPushedAt: now.toISOString(),
      syncCursor: payload.syncCursor,
    };
  });
}

// Get the latest synchronization status and metadata
export async function getSyncStatus() {
  const [meta] = await db
    .select()
    .from(portalSyncMeta)
    .where(eq(portalSyncMeta.id, "singleton"))
    .limit(1);

  if (!meta) {
    return {
      isInitialized: false,
      lastPushedAt: null,
      lastPushStatus: "INITIAL",
      sourceSystem: "AFK_LOCAL_ERP",
      isLive: false,
      relativeTime: "Never synced",
    };
  }

  const isRecent = meta.lastPushedAt
    ? Date.now() - new Date(meta.lastPushedAt).getTime() < 30 * 60 * 1000 // 30 minutes
    : false;

  return {
    isInitialized: true,
    lastPushedAt: meta.lastPushedAt,
    lastPushStatus: meta.lastPushStatus,
    sourceSystem: meta.sourceSystem,
    syncCursor: meta.syncCursor,
    isLive: meta.lastPushStatus === "SUCCESS" && isRecent,
  };
}

// Fetch portal calendar entries modified since given timestamp for local ERP pull
export async function getCalendarEntriesSince(sinceTimestamp?: Date | string) {
  const query = db
    .select()
    .from(portalCalendarEntries)
    .where(
      sinceTimestamp
        ? gt(portalCalendarEntries.updatedAt, new Date(sinceTimestamp))
        : sql`1=1`
    )
    .orderBy(desc(portalCalendarEntries.updatedAt));

  const entries = await query;
  if (entries.length === 0) return { entries: [], checklists: [], recurrences: [] };

  const entryIds = entries.map((e) => e.id);

  const checklists = await db
    .select()
    .from(portalCalendarChecklists)
    .where(sql`${portalCalendarChecklists.calendarEntryId} IN ${entryIds}`);

  const recurrences = await db
    .select()
    .from(portalCalendarRecurrence)
    .where(sql`${portalCalendarRecurrence.calendarEntryId} IN ${entryIds}`);

  return {
    entries,
    checklists,
    recurrences,
  };
}
