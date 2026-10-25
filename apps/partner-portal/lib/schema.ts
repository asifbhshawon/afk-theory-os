import {
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. SYNCHRONISATION METADATA & SYSTEM STATUS
// ==============================================================================

export const portalSyncMeta = pgTable("portal_sync_meta", {
  id: text("id").primaryKey().default("singleton"),
  lastPushedAt: timestamp("last_pushed_at", { withTimezone: true }),
  lastPushStatus: text("last_push_status").notNull().default("INITIAL"), // SUCCESS, ERROR, IN_PROGRESS
  sourceSystem: text("source_system").notNull().default("AFK_LOCAL_ERP"),
  syncCursor: text("sync_cursor"),
  summaryChecksum: text("summary_checksum"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 2. SANITIZED BUSINESS OVERVIEW & FINANCIAL SNAPSHOTS
// ==============================================================================

export const portalBusinessSummaries = pgTable(
  "portal_business_summaries",
  {
    id: text("id").primaryKey(), // e.g. "latest" or "FY2026-M10"
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    netRevenue: numeric("net_revenue", { precision: 18, scale: 2 }).notNull().default("0.00"),
    grossRevenue: numeric("gross_revenue", { precision: 18, scale: 2 }).notNull().default("0.00"),
    salesReturns: numeric("sales_returns", { precision: 18, scale: 2 }).notNull().default("0.00"),
    totalCogs: numeric("total_cogs", { precision: 18, scale: 2 }).notNull().default("0.00"),
    grossProfit: numeric("gross_profit", { precision: 18, scale: 2 }).notNull().default("0.00"),
    operatingExpenses: numeric("operating_expenses", { precision: 18, scale: 2 }).notNull().default("0.00"),
    netProfit: numeric("net_profit", { precision: 18, scale: 2 }).notNull().default("0.00"),
    availableCash: numeric("available_cash", { precision: 18, scale: 2 }).notNull().default("0.00"),
    totalInventoryValue: numeric("total_inventory_value", { precision: 18, scale: 2 }).notNull().default("0.00"),
    materialsInventory: numeric("materials_inventory", { precision: 18, scale: 2 }).notNull().default("0.00"),
    wipInventory: numeric("wip_inventory", { precision: 18, scale: 2 }).notNull().default("0.00"),
    finishedGoodsInventory: numeric("finished_goods_inventory", { precision: 18, scale: 2 }).notNull().default("0.00"),
    courierCodReceivable: numeric("courier_cod_receivable", { precision: 18, scale: 2 }).notNull().default("0.00"),
    courierPendingSettlements: numeric("courier_pending_settlements", { precision: 18, scale: 2 }).notNull().default("0.00"),
    activeVenturesCount: integer("active_ventures_count").notNull().default(0),
    activeProductionOrdersCount: integer("active_production_orders_count").notNull().default(0),
    metadata: jsonb("metadata"), // Monthly performance array, channel revenue, etc.
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_biz_summary_updated_idx").on(table.updatedAt)]
);

export const portalPaymentAccounts = pgTable("portal_payment_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // Cash on Hand, BRAC Bank Checking, bKash Merchant, Nagad Merchant
  type: text("type").notNull(), // CASH, BANK, BKASH, NAGAD
  accountNumber: text("account_number"),
  balance: numeric("balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 3. PERSONALLY SCOPED PARTNER FINANCIAL STATEMENTS
// ==============================================================================

export const portalPartnerStatements = pgTable(
  "portal_partner_statements",
  {
    id: text("id").primaryKey(), // matches partner ID e.g. "partner-shawon"
    partnerId: text("partner_id").notNull().unique(),
    name: text("name").notNull(), // Shawon, Rafi, Tousif, Midhat, Mueid
    email: text("email").notNull(),
    ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull().default("20.00"),
    profitSharePct: numeric("profit_share_pct", { precision: 5, scale: 2 }).notNull().default("20.00"),
    capitalContributed: numeric("capital_contributed", { precision: 18, scale: 2 }).notNull().default("0.00"),
    drawings: numeric("drawings", { precision: 18, scale: 2 }).notNull().default("0.00"),
    loanBalanceOwed: numeric("loan_balance_owed", { precision: 18, scale: 2 }).notNull().default("0.00"),
    shareOfProfit: numeric("share_of_profit", { precision: 18, scale: 2 }).notNull().default("0.00"),
    totalEquity: numeric("total_equity", { precision: 18, scale: 2 }).notNull().default("0.00"),
    ventureContributions: numeric("venture_contributions", { precision: 18, scale: 2 }).notNull().default("0.00"),
    ventureEntitlements: numeric("venture_entitlements", { precision: 18, scale: 2 }).notNull().default("0.00"),
    settlementHistory: jsonb("settlement_history"), // list of recent distributions, payouts, repayments
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_statements_partner_idx").on(table.partnerId)]
);

// ==============================================================================
// 4. VENTURES & PROJECTS SUMMARY
// ==============================================================================

export const portalVentures = pgTable(
  "portal_ventures",
  {
    id: text("id").primaryKey(), // matches local ERP ventureId
    ventureNumber: text("venture_number").notNull().unique(), // VENT-2026-0001
    title: text("title").notNull(),
    typeCode: text("type_code").notNull(),
    typeName: text("type_name").notNull(),
    stage: text("stage").notNull(), // IDEA, PLANNING, ACTIVE, COMPLETED, SETTLED, ARCHIVED
    description: text("description"),
    targetBudget: numeric("target_budget", { precision: 18, scale: 2 }).notNull().default("0.00"),
    actualBudget: numeric("actual_budget", { precision: 18, scale: 2 }).notNull().default("0.00"),
    actualCashRaised: numeric("actual_cash_raised", { precision: 18, scale: 2 }).notNull().default("0.00"),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    productionProgress: jsonb("production_progress"), // { plannedQty: 500, completedQty: 350, qcPassRate: 98.5 }
    salesProgress: jsonb("sales_progress"), // { unitsSold: 280, grossSales: 420000, netSales: 395000 }
    participants: jsonb("participants"), // [{ partnerId, name, investmentPct, profitSharePct, actualContributed }]
    performanceSummary: text("performance_summary"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("portal_ventures_stage_idx").on(table.stage),
    index("portal_ventures_number_idx").on(table.ventureNumber),
  ]
);

// ==============================================================================
// 5. MANUFACTURING & INVENTORY SUMMARIES
// ==============================================================================

export const portalManufacturingBatches = pgTable(
  "portal_manufacturing_batches",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    productName: text("product_name").notNull(),
    routeType: text("route_type").notNull(),
    status: text("status").notNull(), // PLANNED, FABRIC_ISSUED, IN_PRODUCTION, QC_PENDING, COMPLETED
    plannedQuantity: integer("planned_quantity").notNull(),
    completedGoodQuantity: integer("completed_good_quantity").notNull().default(0),
    completedDefectQuantity: integer("completed_defect_quantity").notNull().default(0),
    targetDate: timestamp("target_date", { withTimezone: true }),
    ventureId: text("venture_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_mfg_batches_status_idx").on(table.status)]
);

export const portalInventoryAlerts = pgTable("portal_inventory_alerts", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  productName: text("product_name").notNull(),
  size: text("size"),
  color: text("color"),
  currentQuantity: integer("current_quantity").notNull(),
  reorderLevel: integer("reorder_level").notNull(),
  status: text("status").notNull().default("LOW_STOCK"), // LOW_STOCK, OUT_OF_STOCK
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 6. SANITIZED BUSINESS ACTIVITY FEED
// ==============================================================================

export const portalActivityFeed = pgTable(
  "portal_activity_feed",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(), // FINANCE, PRODUCTION, VENTURE, LOGISTICS, GOVERNANCE
    title: text("title").notNull(),
    description: text("description").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    actorName: text("actor_name"),
    ventureId: text("venture_id"),
    partnerId: text("partner_id"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("portal_activity_time_idx").on(table.timestamp),
    index("portal_activity_cat_idx").on(table.category),
  ]
);

// ==============================================================================
// 7. PARTNER PORTAL AUTHENTICATION & SESSIONS
// ==============================================================================

export const portalPartners = pgTable(
  "portal_partners",
  {
    id: text("id").primaryKey(), // "partner-shawon", "partner-rafi", etc.
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("PARTNER"), // ADMIN, PARTNER
    isActive: boolean("is_active").notNull().default(true),
    permittedVentureIds: jsonb("permitted_venture_ids").default("[]"), // Array of venture IDs allowed
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_partners_email_idx").on(table.email)]
);

export const portalSessions = pgTable(
  "portal_sessions",
  {
    id: text("id").primaryKey(), // cryptographically random 32-byte hex token
    partnerId: text("partner_id")
      .notNull()
      .references(() => portalPartners.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_sessions_partner_idx").on(table.partnerId)]
);

// ==============================================================================
// 8. CLOUD-OWNED SHARED CALENDAR & NOTES
// ==============================================================================

export const portalCalendarCategories = pgTable(
  "portal_calendar_categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    color: text("color").notNull().default("#5A7352"),
    icon: text("icon").default("Calendar"),
    description: text("description"),
    isShared: boolean("is_shared").notNull().default(true),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_cal_cat_slug_idx").on(table.slug)]
);

export const portalCalendarEntries = pgTable(
  "portal_calendar_entries",
  {
    id: text("id").primaryKey(), // UUID
    title: text("title").notNull(),
    description: text("description"),
    entryType: text("entry_type").notNull().default("NOTE"), // NOTE, TASK, MEETING, DEADLINE, REMINDER
    status: text("status").notNull().default("PENDING"), // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    priority: text("priority").notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, URGENT
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    isAllDay: boolean("is_all_day").notNull().default(false),
    location: text("location"),
    scope: text("scope").notNull().default("COMPANY"), // PERSONAL, COMPANY, VENTURE
    visibility: text("visibility").notNull().default("PUBLIC"), // PUBLIC, PRIVATE, PARTICIPANTS
    categoryId: text("category_id").references(() => portalCalendarCategories.id, { onDelete: "set null" }),
    ventureId: text("venture_id"),
    assignedPartnerId: text("assigned_partner_id").references(() => portalPartners.id, { onDelete: "set null" }),
    ownerPartnerId: text("owner_partner_id")
      .notNull()
      .references(() => portalPartners.id, { onDelete: "cascade" }),
    tags: jsonb("tags").default("[]"),
    version: integer("version").notNull().default(1),
    origin: text("origin").notNull().default("PORTAL"), // PORTAL, LOCAL
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("portal_cal_entries_start_idx").on(table.startDate),
    index("portal_cal_entries_scope_idx").on(table.scope),
    index("portal_cal_entries_owner_idx").on(table.ownerPartnerId),
    index("portal_cal_entries_venture_idx").on(table.ventureId),
    index("portal_cal_entries_updated_idx").on(table.updatedAt),
  ]
);

export const portalCalendarChecklists = pgTable(
  "portal_calendar_checklists",
  {
    id: text("id").primaryKey(),
    calendarEntryId: text("calendar_entry_id")
      .notNull()
      .references(() => portalCalendarEntries.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("portal_cal_checklists_entry_idx").on(table.calendarEntryId)]
);

export const portalCalendarRecurrence = pgTable(
  "portal_calendar_recurrence",
  {
    id: text("id").primaryKey(),
    calendarEntryId: text("calendar_entry_id")
      .notNull()
      .references(() => portalCalendarEntries.id, { onDelete: "cascade" }),
    frequency: text("frequency").notNull().default("WEEKLY"), // DAILY, WEEKLY, MONTHLY, YEARLY
    interval: integer("interval").notNull().default(1),
    daysOfWeek: jsonb("days_of_week"), // [1, 3, 5]
    dayOfMonth: integer("day_of_month"),
    untilDate: timestamp("until_date", { withTimezone: true }),
    maxOccurrences: integer("max_occurrences"),
  },
  (table) => [uniqueIndex("portal_cal_recurrence_entry_idx").on(table.calendarEntryId)]
);

export const portalAttachments = pgTable(
  "portal_attachments",
  {
    id: text("id").primaryKey(),
    calendarEntryId: text("calendar_entry_id").references(() => portalCalendarEntries.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    storageUrl: text("storage_url").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    isWebp: boolean("is_webp").notNull().default(false),
    uploadedByPartnerId: text("uploaded_by_partner_id")
      .notNull()
      .references(() => portalPartners.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portal_attachments_entry_idx").on(table.calendarEntryId)]
);
