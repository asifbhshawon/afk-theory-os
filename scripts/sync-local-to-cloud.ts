import { buildSanitizedPushPayload } from "../src/server/services/portal-sync";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_BACKUP_URL || "";
console.log("Connecting to Supabase to apply sync snapshot:", connectionString.replace(/:[^:]*@/, ":****@"));

async function syncDirectToSupabase() {
  const { payload } = await buildSanitizedPushPayload();
  console.log("Local ERP compiled summary successfully:");
  console.log("- Net Revenue:", payload.businessSummary.netRevenue);
  console.log("- Available Cash:", payload.businessSummary.availableCash);
  console.log("- Total Inventory Value:", payload.businessSummary.totalInventoryValue);
  console.log("- Payment Accounts count:", payload.paymentAccounts?.length);
  console.log("- Partner Statements count:", payload.partnerStatements?.length);
  console.log("- Ventures count:", payload.ventures?.length);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const now = new Date();

  // 1. Upsert business overview snapshot
  console.log("Upserting portal_business_summaries...");
  await pool.query(
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
  console.log("Upserting portal_payment_accounts...");
  for (const pa of payload.paymentAccounts || []) {
    await pool.query(
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
  console.log("Upserting portal_partner_statements...");
  for (const ps of payload.partnerStatements || []) {
    await pool.query(
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

  // 4. Update sync metadata
  console.log("Updating portal_sync_meta...");
  await pool.query(
    `INSERT INTO portal_sync_meta (id, last_pushed_at, last_push_status, source_system, sync_cursor, summary_checksum, updated_at)
     VALUES ('singleton', $1, 'SUCCESS', 'AFK_LOCAL_ERP', $2, $3, $1)
     ON CONFLICT (id) DO UPDATE SET
       last_pushed_at = EXCLUDED.last_pushed_at,
       last_push_status = 'SUCCESS',
       source_system = 'AFK_LOCAL_ERP',
       sync_cursor = EXCLUDED.sync_cursor,
       summary_checksum = EXCLUDED.summary_checksum,
       error_message = NULL,
       updated_at = EXCLUDED.updated_at;`,
    [now, payload.syncCursor, payload.checksum || null]
  );

  console.log("\n[SUCCESS] Local ERP data successfully synchronized to Supabase Cloud Portal!");
  await pool.end();
  process.exit(0);
}

syncDirectToSupabase().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
