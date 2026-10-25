import { buildSanitizedPushPayload } from "../src/server/services/portal-sync";
import { db } from "../src/db";
import { calendarEntries, partners, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_BACKUP_URL ||
  "";

if (!connectionString) {
  console.error("No SUPABASE_DATABASE_URL or SUPABASE_BACKUP_URL configured in .env");
  process.exit(1);
}

console.log("Connecting to Supabase Cloud:", connectionString.replace(/:[^:]*@/, ":****@"));

async function syncExactLocalToCloud() {
  // 1. Compile sanitized summary strictly from local Business OS ERP
  const { syncCursor, checksum, payload } = await buildSanitizedPushPayload();

  console.log("\n=== AUTHORITATIVE LOCAL ERP READ MODEL ===");
  console.log("- Net Revenue: ৳" + payload.businessSummary.netRevenue);
  console.log("- Gross Revenue: ৳" + payload.businessSummary.grossRevenue);
  console.log("- Operating Expenses: ৳" + payload.businessSummary.operatingExpenses);
  console.log("- Net Profit: ৳" + payload.businessSummary.netProfit);
  console.log("- Available Liquid Cash: ৳" + payload.businessSummary.availableCash);
  console.log("- Stock Value: ৳" + payload.businessSummary.totalInventoryValue);
  console.log("- Courier COD: ৳" + payload.businessSummary.courierCodReceivable);
  console.log("- Payment Accounts count:", payload.paymentAccounts?.length);
  console.log("- Partner Statements count:", payload.partnerStatements?.length);
  console.log("- Ventures count:", payload.ventures?.length);
  console.log("- Batches count:", payload.manufacturingBatches?.length);
  console.log("- Activity Feed count:", payload.activityFeed?.length);

  // 2. Fetch real calendar entries from local ERP
  const localCalendarNotes = await db
    .select()
    .from(calendarEntries)
    .where(eq(calendarEntries.isArchived, false));

  const allPartners = await db.select().from(partners);
  console.log("- Real Local Calendar Notes count:", localCalendarNotes.length);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  const now = new Date();

  try {
    await client.query("BEGIN");

    // Clean any prior synthetic records so Supabase is an exact mirror of local ERP
    console.log("\nCleaning legacy synthetic/test records in cloud read model...");
    await client.query("DELETE FROM portal_ventures;");
    await client.query("DELETE FROM portal_manufacturing_batches;");
    await client.query("DELETE FROM portal_inventory_alerts;");
    await client.query("DELETE FROM portal_activity_feed;");
    await client.query("DELETE FROM portal_calendar_entries WHERE origin = 'SYNC_TEST' OR id LIKE 'cal-mfg-%' OR id LIKE 'cal-sales-%' OR id LIKE 'cal-board-%';");

    // 1. Upsert business overview snapshot ('latest')
    console.log("1. Upserting portal_business_summaries...");
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
    console.log("2. Upserting portal_payment_accounts...");
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

    // 3. Upsert partner statements
    console.log("3. Upserting portal_partner_statements...");
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

    // 4. Upsert ventures (if any exist in local ERP)
    if (payload.ventures && payload.ventures.length > 0) {
      console.log(`4. Upserting ${payload.ventures.length} ventures...`);
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

    // 5. Upsert manufacturing batches (if any exist in local ERP)
    if (payload.manufacturingBatches && payload.manufacturingBatches.length > 0) {
      console.log(`5. Upserting ${payload.manufacturingBatches.length} manufacturing batches...`);
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

    // 6. Upsert inventory alerts (if any exist in local ERP)
    if (payload.inventoryAlerts && payload.inventoryAlerts.length > 0) {
      console.log(`6. Upserting ${payload.inventoryAlerts.length} inventory alerts...`);
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

    // 7. Upsert activity feed from real local posted journal entries
    console.log(`7. Upserting ${payload.activityFeed?.length || 0} real activity feed items...`);
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

    // 8. Upsert real local ERP calendar notes to cloud calendar
    console.log(`8. Upserting ${localCalendarNotes.length} real local ERP calendar notes...`);
    for (const cn of localCalendarNotes) {
      // Find owning partner
      const ownerPartner = allPartners.find((p) => p.userId === cn.ownerUserId);
      const ownerPartnerId = ownerPartner
        ? `partner-${ownerPartner.name.toLowerCase()}`
        : "partner-shawon";

      await client.query(
        `INSERT INTO portal_calendar_entries (
          id, title, description, entry_type, status, priority,
          start_date, end_date, is_all_day, location, scope, visibility,
          owner_partner_id, version, origin, is_archived, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, 'LOCAL_ERP', false, $14, $14
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
          ownerPartnerId,
          now,
        ]
      );
    }

    // 9. Update sync metadata singleton
    console.log("9. Updating portal_sync_meta with local ERP sync cursor...");
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
    console.log("\n=================================================================");
    console.log("[SUCCESS] Exact local Business OS ERP state pushed to Supabase Cloud!");
    console.log("=================================================================");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Sync rollback due to error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

syncExactLocalToCloud().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
