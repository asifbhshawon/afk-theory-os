import { pool } from "./db";

let tablesInitialized = false;

export async function ensurePortalTablesExist() {
  if (tablesInitialized) return;

  const ddl = `
    CREATE TABLE IF NOT EXISTS portal_sync_meta (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      last_pushed_at TIMESTAMPTZ,
      last_push_status TEXT NOT NULL DEFAULT 'INITIAL',
      source_system TEXT NOT NULL DEFAULT 'AFK_LOCAL_ERP',
      sync_cursor TEXT,
      summary_checksum TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_business_summaries (
      id TEXT PRIMARY KEY,
      period_start TIMESTAMPTZ,
      period_end TIMESTAMPTZ,
      net_revenue NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      gross_revenue NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      sales_returns NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      total_cogs NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      gross_profit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      operating_expenses NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      net_profit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      available_cash NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      total_inventory_value NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      materials_inventory NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      wip_inventory NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      finished_goods_inventory NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      courier_cod_receivable NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      courier_pending_settlements NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      active_ventures_count INTEGER NOT NULL DEFAULT 0,
      active_production_orders_count INTEGER NOT NULL DEFAULT 0,
      metadata JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_payment_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      account_number TEXT,
      balance NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      is_active BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_partner_statements (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      ownership_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
      profit_share_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
      capital_contributed NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      drawings NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      loan_balance_owed NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      share_of_profit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      total_equity NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      venture_contributions NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      venture_entitlements NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      settlement_history JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_ventures (
      id TEXT PRIMARY KEY,
      venture_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type_code TEXT NOT NULL,
      type_name TEXT NOT NULL,
      stage TEXT NOT NULL,
      description TEXT,
      target_budget NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      actual_budget NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      actual_cash_raised NUMERIC(18,2) NOT NULL DEFAULT 0.00,
      start_date TIMESTAMPTZ,
      target_date TIMESTAMPTZ,
      production_progress JSONB,
      sales_progress JSONB,
      participants JSONB,
      performance_summary TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_manufacturing_batches (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      route_type TEXT NOT NULL,
      status TEXT NOT NULL,
      planned_quantity INTEGER NOT NULL,
      completed_good_quantity INTEGER NOT NULL DEFAULT 0,
      completed_defect_quantity INTEGER NOT NULL DEFAULT 0,
      target_date TIMESTAMPTZ,
      venture_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_inventory_alerts (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      size TEXT,
      color TEXT,
      current_quantity INTEGER NOT NULL,
      reorder_level INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'LOW_STOCK',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_activity_feed (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      actor_name TEXT,
      venture_id TEXT,
      partner_id TEXT,
      is_public BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PARTNER',
      is_active BOOLEAN NOT NULL DEFAULT true,
      permitted_venture_ids JSONB DEFAULT '[]',
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_sessions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL REFERENCES portal_partners(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_calendar_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#5A7352',
      icon TEXT DEFAULT 'Calendar',
      description TEXT,
      is_shared BOOLEAN NOT NULL DEFAULT true,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_calendar_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      entry_type TEXT NOT NULL DEFAULT 'NOTE',
      status TEXT NOT NULL DEFAULT 'PENDING',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      startDate TIMESTAMPTZ,
      endDate TIMESTAMPTZ,
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      is_all_day BOOLEAN NOT NULL DEFAULT false,
      location TEXT,
      scope TEXT NOT NULL DEFAULT 'COMPANY',
      visibility TEXT NOT NULL DEFAULT 'PUBLIC',
      category_id TEXT REFERENCES portal_calendar_categories(id) ON DELETE SET NULL,
      venture_id TEXT,
      assigned_partner_id TEXT REFERENCES portal_partners(id) ON DELETE SET NULL,
      owner_partner_id TEXT NOT NULL REFERENCES portal_partners(id) ON DELETE CASCADE,
      tags JSONB DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      origin TEXT NOT NULL DEFAULT 'PORTAL',
      is_archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_calendar_checklists (
      id TEXT PRIMARY KEY,
      calendar_entry_id TEXT NOT NULL REFERENCES portal_calendar_entries(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS portal_calendar_recurrence (
      id TEXT PRIMARY KEY,
      calendar_entry_id TEXT NOT NULL REFERENCES portal_calendar_entries(id) ON DELETE CASCADE,
      frequency TEXT NOT NULL DEFAULT 'WEEKLY',
      interval INTEGER NOT NULL DEFAULT 1,
      days_of_week JSONB,
      day_of_month INTEGER,
      until_date TIMESTAMPTZ,
      max_occurrences INTEGER
    );

    CREATE TABLE IF NOT EXISTS portal_attachments (
      id TEXT PRIMARY KEY,
      calendar_entry_id TEXT REFERENCES portal_calendar_entries(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_url TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      is_webp BOOLEAN NOT NULL DEFAULT false,
      uploaded_by_partner_id TEXT NOT NULL REFERENCES portal_partners(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  try {
    await pool.query(ddl);
    tablesInitialized = true;
  } catch (err) {
    console.error("[Migration Error] Failed to ensure portal tables:", err);
    throw err;
  }
}
