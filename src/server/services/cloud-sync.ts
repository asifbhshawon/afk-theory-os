import { buildSanitizedPushPayload } from "@/server/services/portal-sync";
import { db } from "@/db";
import { calendarEntries, partners, calendarCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export interface CloudSyncResult {
  success: boolean;
  timestamp: string;
  counts: {
    paymentAccounts: number;
    partnerStatements: number;
    ventures: number;
    batches: number;
    activityFeed: number;
    calendarNotes: number;
    inventoryAlerts: number;
  };
  summary: {
    netRevenue: number;
    netProfit: number;
    availableCash: number;
    stockValue: number;
    operatingExpenses: number;
  };
  error?: string;
}

export interface CloudSyncStatus {
  isConfigured: boolean;
  lastPushedAt: string | null;
  lastPushStatus: string | null;
  isLive: boolean;
  sourceSystem?: string;
  error?: string;
}

function getCloudConnectionString(): string {
  return (
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_BACKUP_URL ||
    ""
  );
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const connectionString = getCloudConnectionString();
  if (!connectionString) {
    return {
      isConfigured: false,
      lastPushedAt: null,
      lastPushStatus: "NOT_CONFIGURED",
      isLive: false,
    };
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT last_pushed_at, last_push_status, source_system FROM portal_sync_meta WHERE id = $1 LIMIT 1",
        ["singleton"]
      );

      if (res.rows.length === 0) {
        return {
          isConfigured: true,
          lastPushedAt: null,
          lastPushStatus: "NEVER_SYNCED",
          isLive: false,
        };
      }

      const meta = res.rows[0];
      const lastPushed = meta.last_pushed_at ? new Date(meta.last_pushed_at) : null;
      const isLive = lastPushed
        ? Date.now() - lastPushed.getTime() < 30 * 60 * 1000 // 30 minutes
        : false;

      return {
        isConfigured: true,
        lastPushedAt: lastPushed ? lastPushed.toISOString() : null,
        lastPushStatus: meta.last_push_status || "SUCCESS",
        sourceSystem: meta.source_system || "AFK_LOCAL_ERP",
        isLive,
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      isConfigured: true,
      lastPushedAt: null,
      lastPushStatus: "ERROR",
      isLive: false,
      error: err.message,
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function syncLocalErpToCloud(): Promise<CloudSyncResult> {
  const connectionString = getCloudConnectionString();
  if (!connectionString) {
    throw new Error("No SUPABASE_DATABASE_URL or SUPABASE_BACKUP_URL configured in .env");
  }

  // 1. Compile sanitized summary strictly from local Business OS ERP
  const { syncCursor, checksum, payload } = await buildSanitizedPushPayload();

  // 2. Fetch real calendar entries from local ERP
  const localCalendarNotes = await db
    .select()
    .from(calendarEntries)
    .where(eq(calendarEntries.isArchived, false));

  let localCategoriesRes: any[] = [];
  try {
    localCategoriesRes = await db.select().from(calendarCategories);
  } catch {
    localCategoriesRes = [];
  }

  const slugToCloudCatId: Record<string, string> = {
    production: "cat-prod",
    finance: "cat-fin",
    "partner-meeting": "cat-meet",
    supplier: "cat-sup",
    "sales-delivery": "cat-sales",
    marketing: "cat-mkt",
    photoshoot: "cat-photo",
    "product-launch": "cat-drop",
    design: "cat-dsgn",
    personal: "cat-pers",
    general: "cat-gen",
  };

  const allPartners = await db.select().from(partners);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  const now = new Date();

  try {
    await client.query("BEGIN");

    // Clean prior synthetic/test records in cloud read model
    await client.query("DELETE FROM portal_ventures;");
    await client.query("DELETE FROM portal_manufacturing_batches;");
    await client.query("DELETE FROM portal_inventory_alerts;");
    await client.query("DELETE FROM portal_activity_feed;");
    await client.query(
      "DELETE FROM portal_calendar_entries WHERE origin = 'SYNC_TEST' OR id LIKE 'cal-mfg-%' OR id LIKE 'cal-sales-%' OR id LIKE 'cal-board-%';"
    );

    // 1. Upsert business overview snapshot ('latest')
    await client.query(
      `INSERT INTO portal_business_summaries (
        id, period_start, period_end, net_revenue, gross_revenue, sales_returns,
        total_cogs, gross_profit, operating_expenses, net_profit, available_cash,
        total_inventory_value, materials_inventory, wip_inventory, finished_goods_inventory,
        courier_cod_receivable, courier_pending_settlements, active_ventures_count,
        active_production_orders_count, metadata, updated_at
      ) VALUES (
        'latest', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) ON CONFLICT (id) DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        net_revenue = EXCLUDED.net_revenue,
        gross_revenue = EXCLUDED.gross_revenue,
        sales_returns = EXCLUDED.sales_returns,
        total_cogs = EXCLUDED.total_cogs,
        gross_profit = EXCLUDED.gross_profit,
        operating_expenses = EXCLUDED.operating_expenses,
        net_profit = EXCLUDED.net_profit,
        available_cash = EXCLUDED.available_cash,
        total_inventory_value = EXCLUDED.total_inventory_value,
        materials_inventory = EXCLUDED.materials_inventory,
        wip_inventory = EXCLUDED.wip_inventory,
        finished_goods_inventory = EXCLUDED.finished_goods_inventory,
        courier_cod_receivable = EXCLUDED.courier_cod_receivable,
        courier_pending_settlements = EXCLUDED.courier_pending_settlements,
        active_ventures_count = EXCLUDED.active_ventures_count,
        active_production_orders_count = EXCLUDED.active_production_orders_count,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at;`,
      [
        payload.businessSummary.periodStart ? new Date(payload.businessSummary.periodStart) : null,
        payload.businessSummary.periodEnd ? new Date(payload.businessSummary.periodEnd) : null,
        payload.businessSummary.netRevenue,
        payload.businessSummary.grossRevenue,
        payload.businessSummary.salesReturns,
        payload.businessSummary.totalCogs,
        payload.businessSummary.grossProfit,
        payload.businessSummary.operatingExpenses,
        payload.businessSummary.netProfit,
        payload.businessSummary.availableCash,
        payload.businessSummary.totalInventoryValue,
        payload.businessSummary.materialsInventory,
        payload.businessSummary.wipInventory,
        payload.businessSummary.finishedGoodsInventory,
        payload.businessSummary.courierCodReceivable,
        payload.businessSummary.courierPendingSettlements || 0,
        payload.businessSummary.activeVenturesCount || 0,
        payload.businessSummary.activeProductionOrdersCount || 0,
        JSON.stringify(payload.businessSummary.metadata || {}),
        now,
      ]
    );

    // 2. Upsert payment accounts
    for (const pa of payload.paymentAccounts || []) {
      await client.query(
        `INSERT INTO portal_payment_accounts (id, name, type, account_number, balance, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           account_number = EXCLUDED.account_number,
           balance = EXCLUDED.balance,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at;`,
        [pa.id, pa.name, pa.type, pa.accountNumber || null, pa.balance, pa.isActive ?? true, now]
      );
    }

    // 3. Upsert partner statements (with settlement history)
    for (const ps of payload.partnerStatements || []) {
      await client.query(
        `INSERT INTO portal_partner_statements (
          id, partner_id, name, email, ownership_pct, profit_share_pct, capital_contributed,
          drawings, loan_balance_owed, share_of_profit, total_equity, venture_contributions,
          venture_entitlements, settlement_history, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          ownership_pct = EXCLUDED.ownership_pct,
          profit_share_pct = EXCLUDED.profit_share_pct,
          capital_contributed = EXCLUDED.capital_contributed,
          drawings = EXCLUDED.drawings,
          loan_balance_owed = EXCLUDED.loan_balance_owed,
          share_of_profit = EXCLUDED.share_of_profit,
          total_equity = EXCLUDED.total_equity,
          venture_contributions = EXCLUDED.venture_contributions,
          venture_entitlements = EXCLUDED.venture_entitlements,
          settlement_history = EXCLUDED.settlement_history,
          updated_at = EXCLUDED.updated_at;`,
        [
          ps.partnerId,
          ps.partnerId,
          ps.name,
          ps.email,
          ps.ownershipPct,
          ps.profitSharePct,
          ps.capitalContributed,
          ps.drawings,
          ps.loanBalanceOwed,
          ps.shareOfProfit,
          ps.totalEquity,
          ps.ventureContributions || 0,
          ps.ventureEntitlements || 0,
          JSON.stringify(ps.settlementHistory || []),
          now,
        ]
      );
    }

    // 4. Upsert ventures
    if (payload.ventures && payload.ventures.length > 0) {
      for (const v of payload.ventures) {
        await client.query(
          `INSERT INTO portal_ventures (
            id, venture_number, title, type_code, type_name, stage, description,
            target_budget, actual_budget, actual_cash_raised, start_date, target_date,
            production_progress, sales_progress, participants, performance_summary, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          ) ON CONFLICT (id) DO UPDATE SET
            venture_number = EXCLUDED.venture_number,
            title = EXCLUDED.title,
            type_code = EXCLUDED.type_code,
            type_name = EXCLUDED.type_name,
            stage = EXCLUDED.stage,
            description = EXCLUDED.description,
            target_budget = EXCLUDED.target_budget,
            actual_budget = EXCLUDED.actual_budget,
            actual_cash_raised = EXCLUDED.actual_cash_raised,
            start_date = EXCLUDED.start_date,
            target_date = EXCLUDED.target_date,
            production_progress = EXCLUDED.production_progress,
            sales_progress = EXCLUDED.sales_progress,
            participants = EXCLUDED.participants,
            performance_summary = EXCLUDED.performance_summary,
            updated_at = EXCLUDED.updated_at;`,
          [
            v.id,
            v.ventureNumber,
            v.title,
            v.typeCode,
            v.typeName,
            v.stage,
            v.description || null,
            v.targetBudget,
            v.actualBudget,
            v.actualCashRaised,
            v.startDate ? new Date(v.startDate) : null,
            v.targetDate ? new Date(v.targetDate) : null,
            JSON.stringify(v.productionProgress || {}),
            JSON.stringify(v.salesProgress || {}),
            JSON.stringify(v.participants || []),
            v.performanceSummary || null,
            now,
          ]
        );
      }
    }

    // 5. Upsert manufacturing batches
    if (payload.manufacturingBatches && payload.manufacturingBatches.length > 0) {
      for (const m of payload.manufacturingBatches) {
        await client.query(
          `INSERT INTO portal_manufacturing_batches (
            id, order_number, product_name, route_type, status,
            planned_quantity, completed_good_quantity, completed_defect_quantity,
            target_date, venture_id, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          ) ON CONFLICT (id) DO UPDATE SET
            order_number = EXCLUDED.order_number,
            product_name = EXCLUDED.product_name,
            route_type = EXCLUDED.route_type,
            status = EXCLUDED.status,
            planned_quantity = EXCLUDED.planned_quantity,
            completed_good_quantity = EXCLUDED.completed_good_quantity,
            completed_defect_quantity = EXCLUDED.completed_defect_quantity,
            target_date = EXCLUDED.target_date,
            venture_id = EXCLUDED.venture_id,
            updated_at = EXCLUDED.updated_at;`,
          [
            m.id,
            m.orderNumber,
            m.productName,
            m.routeType,
            m.status,
            m.plannedQuantity,
            m.completedGoodQuantity,
            m.completedDefectQuantity,
            m.targetDate ? new Date(m.targetDate) : null,
            m.ventureId || null,
            now,
          ]
        );
      }
    }

    // 6. Upsert inventory alerts
    if (payload.inventoryAlerts && payload.inventoryAlerts.length > 0) {
      for (const a of payload.inventoryAlerts) {
        await client.query(
          `INSERT INTO portal_inventory_alerts (
            id, sku, product_name, size, color,
            current_quantity, reorder_level, status, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) ON CONFLICT (id) DO UPDATE SET
            sku = EXCLUDED.sku,
            product_name = EXCLUDED.product_name,
            size = EXCLUDED.size,
            color = EXCLUDED.color,
            current_quantity = EXCLUDED.current_quantity,
            reorder_level = EXCLUDED.reorder_level,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at;`,
          [
            a.id,
            a.sku,
            a.productName,
            a.size || null,
            a.color || null,
            a.currentQuantity,
            a.reorderLevel,
            a.status,
            now,
          ]
        );
      }
    }

    // 7. Upsert activity feed
    for (const act of payload.activityFeed || []) {
      await client.query(
        `INSERT INTO portal_activity_feed (
          id, category, title, description, timestamp, actor_name, is_public
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        ) ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          timestamp = EXCLUDED.timestamp,
          actor_name = EXCLUDED.actor_name,
          is_public = EXCLUDED.is_public;`,
        [
          act.id,
          act.category,
          act.title,
          act.description,
          new Date(act.timestamp),
          "AFK ERP",
          act.isPublic ?? true,
        ]
      );
    }

    // 8. Upsert real local ERP calendar notes
    for (const cn of localCalendarNotes) {
      const ownerPartner = allPartners.find((p) => p.userId === cn.ownerUserId);
      const ownerPartnerId = ownerPartner
        ? `partner-${ownerPartner.name.toLowerCase()}`
        : "partner-shawon";

      const matchedCat = localCategoriesRes.find((c) => c.id === cn.categoryId);
      const cloudCatId = (matchedCat && slugToCloudCatId[matchedCat.slug]) ? slugToCloudCatId[matchedCat.slug] : "cat-prod";

      await client.query(
        `INSERT INTO portal_calendar_entries (
          id, title, description, entry_type, status, priority,
          start_date, end_date, is_all_day, location, scope, visibility,
          category_id, owner_partner_id, version, origin, is_archived, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1, 'LOCAL_ERP', false, $15, $15
        ) ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          entry_type = EXCLUDED.entry_type,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          is_all_day = EXCLUDED.is_all_day,
          location = EXCLUDED.location,
          scope = EXCLUDED.scope,
          visibility = EXCLUDED.visibility,
          category_id = EXCLUDED.category_id,
          owner_partner_id = EXCLUDED.owner_partner_id,
          updated_at = EXCLUDED.updated_at;`,
        [
          cn.id,
          cn.title,
          cn.description || "",
          cn.entryType || "NOTE",
          cn.status || "CONFIRMED",
          cn.priority || "MEDIUM",
          cn.startDate,
          cn.endDate,
          cn.isAllDay,
          cn.location,
          cn.scope,
          cn.visibility,
          cloudCatId,
          ownerPartnerId,
          now,
        ]
      );
    }

    // 9. Update sync metadata singleton
    await client.query(
      `INSERT INTO portal_sync_meta (
        id, last_pushed_at, last_push_status, source_system, sync_cursor, summary_checksum, updated_at
      ) VALUES ('singleton', $1, 'SUCCESS', 'AFK_LOCAL_ERP', $2, $3, $1)
      ON CONFLICT (id) DO UPDATE SET
        last_pushed_at = EXCLUDED.last_pushed_at,
        last_push_status = 'SUCCESS',
        source_system = 'AFK_LOCAL_ERP',
        sync_cursor = EXCLUDED.sync_cursor,
        summary_checksum = EXCLUDED.summary_checksum,
        error_message = NULL,
        updated_at = EXCLUDED.updated_at;`,
      [now, syncCursor, checksum || null]
    );

    await client.query("COMMIT");

    return {
      success: true,
      timestamp: now.toISOString(),
      counts: {
        paymentAccounts: payload.paymentAccounts?.length || 0,
        partnerStatements: payload.partnerStatements?.length || 0,
        ventures: payload.ventures?.length || 0,
        batches: payload.manufacturingBatches?.length || 0,
        activityFeed: payload.activityFeed?.length || 0,
        calendarNotes: localCalendarNotes.length,
        inventoryAlerts: payload.inventoryAlerts?.length || 0,
      },
      summary: {
        netRevenue: payload.businessSummary.netRevenue,
        netProfit: payload.businessSummary.netProfit,
        availableCash: payload.businessSummary.availableCash,
        stockValue: payload.businessSummary.totalInventoryValue,
        operatingExpenses: payload.businessSummary.operatingExpenses,
      },
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}
