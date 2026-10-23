import {
  pgTable,
  uuid,
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
// 1. IDENTITY, USERS, ROLES & GOVERNANCE
// ==============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE, PENDING_PASSWORD_CHANGE, SUSPENDED
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("users_email_idx").on(table.email)]
);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // ADMIN, FINANCE_MGR, FINANCE_APPROVER, INVENTORY_MGR, MFG_MGR, SALES_OP, PARTNER_VIEWER, ACCOUNTANT
  name: text("name").notNull(),
  description: text("description"),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleCode: text("role_code")
      .notNull()
      .references(() => roles.code, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_role_unique_idx").on(table.userId, table.roleCode),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // Session token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // CREATE, UPDATE, DELETE, POST, REVERSE, APPROVE, REJECT, LOGIN, EXPORT, BACKUP
    entityType: text("entity_type").notNull(), // JOURNAL, ORDER, STOCK, PARTNER, USER, etc.
    entityId: text("entity_id"),
    details: text("details"),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(), // Shawon, Rafi, Tousif, Midhat, Mueid
  ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("20.00"),
  profitSharePct: numeric("profit_share_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("20.00"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("ACTIVE"),
  notes: text("notes"),
});

export const partnerSharesHistory = pgTable("partner_shares_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(), // OWNERSHIP, PROFIT_SHARE
  previousPct: numeric("previous_pct", { precision: 5, scale: 2 }).notNull(),
  newPct: numeric("new_pct", { precision: 5, scale: 2 }).notNull(),
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
  decisionNotes: text("decision_notes"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  module: text("module").notNull(), // FINANCE, PARTNER, STOCK, SALES, PRODUCTION
  referenceId: text("reference_id").notNull(),
  requestType: text("request_type").notNull(), // REIMBURSEMENT, LOAN_PAYOUT, PROFIT_DISTRIBUTION, STOCK_WRITEOFF, REVERSAL
  requesterUserId: uuid("requester_user_id")
    .notNull()
    .references(() => users.id),
  amountBdt: numeric("amount_bdt", { precision: 18, scale: 2 }),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
  approverUserId: uuid("approver_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const partnerDecisions = pgTable("partner_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // EQUITY, STRATEGY, PROFIT_DISTRIBUTION, CAPEX, GENERAL
  status: text("status").notNull().default("APPROVED"), // DRAFT, VOTING, APPROVED, IMPLEMENTED
  voteSummary: text("vote_summary"),
  decisionDate: timestamp("decision_date", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 2. GENERAL LEDGER & FINANCE
// ==============================================================================

export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // e.g. "FY2026-M10"
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  closedByUserId: uuid("closed_by_user_id").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(), // 1010, 1020, 2010, etc.
    name: text("name").notNull(),
    group: text("group").notNull(), // CASH, RECEIVABLE, INVENTORY, WIP, ASSET, LIABILITY, CAPITAL, DRAWINGS, REVENUE, CONTRA_REVENUE, COGS, EXPENSE
    normalBalance: text("normal_balance").notNull(), // DEBIT, CREDIT
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
  },
  (table) => [index("accounts_group_idx").on(table.group)]
);

export const paymentAccounts = pgTable("payment_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // Cash on Hand, BRAC Bank Checking, bKash Merchant, Nagad Merchant
  type: text("type").notNull(), // CASH, BANK, BKASH, NAGAD, OTHER
  glAccountId: uuid("gl_account_id")
    .notNull()
    .references(() => accounts.id),
  accountNumber: text("account_number"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
});

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryNumber: text("entry_number").notNull().unique(), // e.g. AFK-JRN-2026-0001
    date: timestamp("date", { withTimezone: true }).notNull(),
    entryType: text("entry_type").notNull(), // CAPITAL_DEPOSIT, PARTNER_LOAN, EXPENSE, PURCHASE, PRODUCTION, SALES, SETTLEMENT, ADJUSTMENT, REVERSAL
    description: text("description").notNull(),
    reference: text("reference"), // Source PO, Order, Receipt voucher
    sourceModule: text("source_module"), // BANKING, SALES, MANUFACTURING, PURCHASING, PARTNERS
    sourceId: text("source_id"),
    status: text("status").notNull().default("POSTED"), // DRAFT, POSTED, REVERSED
    postedAt: timestamp("posted_at", { withTimezone: true }).defaultNow().notNull(),
    postedByUserId: uuid("posted_by_user_id").references(() => users.id),
    reversalOfId: uuid("reversal_of_id"), // Self-referential for traceability
    fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriods.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("journal_entries_date_idx").on(table.date),
    index("journal_entries_status_idx").on(table.status),
  ]
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0.00"),
    credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0.00"),
    partnerId: uuid("partner_id").references(() => partners.id), // For partner equity/loan/drawings
    ventureId: uuid("venture_id").references(() => ventures.id), // Dimensional project GL attribution
    memo: text("memo"),
  },
  (table) => [
    index("journal_lines_entry_idx").on(table.journalEntryId),
    index("journal_lines_account_idx").on(table.accountId),
    index("journal_lines_partner_idx").on(table.partnerId),
    index("journal_lines_venture_idx").on(table.ventureId),
  ]
);

export const reconciliations = pgTable("reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentAccountId: uuid("payment_account_id")
    .notNull()
    .references(() => paymentAccounts.id),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  statementBalance: numeric("statement_balance", { precision: 18, scale: 2 }).notNull(),
  bookBalance: numeric("book_balance", { precision: 18, scale: 2 }).notNull(),
  difference: numeric("difference", { precision: 18, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("RECONCILED"), // DRAFT, RECONCILED
  reconciledByUserId: uuid("reconciled_by_user_id").references(() => users.id),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }).defaultNow().notNull(),
  notes: text("notes"),
});

// ==============================================================================
// 3. CATALOG & INVENTORY
// ==============================================================================

export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // e.g. "Drop 01 - The Origin", "Winter Drop 2026"
  code: text("code").notNull().unique(), // DROP01, W26
  description: text("description"),
  status: text("status").notNull().default("ACTIVE"), // PLANNING, ACTIVE, ARCHIVED
  ventureId: uuid("venture_id").references(() => ventures.id), // Venture association
  startDate: timestamp("start_date", { withTimezone: true }),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  collectionId: uuid("collection_id").references(() => collections.id),
  name: text("name").notNull(), // Drop-Shoulder Heavyweight T-Shirt
  styleCode: text("style_code").notNull().unique(), // AFK-DS-T001
  productType: text("product_type").notNull().default("FINISHED_GARMENT"), // FINISHED_GARMENT, BLANK, RAW_MATERIAL, CONSUMABLE
  category: text("category").notNull().default("T-Shirt"),
  description: text("description"),
  retailPrice: numeric("retail_price", { precision: 18, scale: 2 }).notNull().default("0.00"),
  targetCogs: numeric("target_cogs", { precision: 18, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("ACTIVE"),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(), // AFK-DS-T001-BLK-M
    size: text("size").notNull(), // S, M, L, XL, XXL, FREE
    color: text("color").notNull(), // Black, Olive, Charcoal, Off-White
    fit: text("fit"), // Drop-Shoulder, Regular, Oversized
    barcode: text("barcode"),
    costPrice: numeric("cost_price", { precision: 18, scale: 2 }).notNull().default("0.00"),
    sellingPrice: numeric("selling_price", { precision: 18, scale: 2 }).notNull().default("0.00"),
    reorderLevel: integer("reorder_level").notNull().default(10),
  },
  (table) => [index("variants_product_idx").on(table.productId)]
);

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // MAIN_WH, FACTORY_WIP, DAMAGED, TRANSIT
  name: text("name").notNull(), // Main Office / Warehouse, Factory WIP, Defect Bin, Courier In-Transit
  type: text("type").notNull().default("WAREHOUSE"), // WAREHOUSE, FACTORY, IN_TRANSIT, DEFECT
  address: text("address"),
  custodianName: text("custodian_name"),
  isActive: boolean("is_active").notNull().default(true),
});

export const inventoryLots = pgTable(
  "inventory_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotNumber: text("lot_number").notNull().unique(), // LOT-2026-001
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    supplierId: uuid("supplier_id"), // Reference to contacts
    productionOrderId: uuid("production_order_id"), // Reference to production orders
    ventureId: uuid("venture_id").references(() => ventures.id), // Venture funding attribution
    initialQuantity: integer("initial_quantity").notNull(),
    currentQuantity: integer("current_quantity").notNull(),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    unitCost: numeric("unit_cost", { precision: 18, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 18, scale: 2 }).notNull(),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE, DEPLETED, QUARANTINED
    receivedDate: timestamp("received_date", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lots_variant_idx").on(table.variantId),
    index("lots_venture_idx").on(table.ventureId),
  ]
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    lotId: uuid("lot_id").references(() => inventoryLots.id),
    fromLocationId: uuid("from_location_id").references(() => locations.id),
    toLocationId: uuid("to_location_id").references(() => locations.id),
    movementType: text("movement_type").notNull(), // PURCHASE_RECEIPT, PRODUCTION_ISSUE, PRODUCTION_RECEIPT, TRANSFER, RESERVATION, FULFILLMENT, RETURN_RESTOCK, RETURN_DEFECT, ADJUSTMENT, WRITE_OFF
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 2 }).notNull(),
    referenceType: text("reference_type"), // PO, ORDER, MFG, RETURN, AUDIT
    referenceId: text("reference_id"),
    performedByUserId: uuid("performed_by_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("movements_variant_idx").on(table.variantId),
    index("movements_lot_idx").on(table.lotId),
  ]
);

export const boms = pgTable("boms", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  name: text("name").notNull(),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, DRAFT, ARCHIVED
});

export const bomLines = pgTable("bom_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  bomId: uuid("bom_id")
    .notNull()
    .references(() => boms.id, { onDelete: "cascade" }),
  componentVariantId: uuid("component_variant_id").references(() => productVariants.id),
  componentDescription: text("component_description").notNull(),
  quantityPerUnit: numeric("quantity_per_unit", { precision: 10, scale: 4 }).notNull(),
  unitOfMeasure: text("unit_of_measure").notNull(), // KG, METRE, YARD, PCS
  estimatedUnitCost: numeric("estimated_unit_cost", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
});

// ==============================================================================
// 4. PROCUREMENT & SUPPLIERS
// ==============================================================================

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // SUPPLIER, FACTORY, COURIER, CUSTOMER
  name: text("name").notNull(),
  companyName: text("company_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  creditLimit: numeric("credit_limit", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  poNumber: text("po_number").notNull().unique(), // AFK-PO-2026-001
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => contacts.id),
  orderDate: timestamp("order_date", { withTimezone: true }).defaultNow().notNull(),
  expectedDate: timestamp("expected_date", { withTimezone: true }),
  status: text("status").notNull().default("DRAFT"), // DRAFT, APPROVED, RECEIVED, CANCELLED
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
});

export const purchaseLines = pgTable("purchase_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
});

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  grnNumber: text("grn_number").notNull().unique(), // AFK-GRN-2026-001
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
  receivedDate: timestamp("received_date", { withTimezone: true }).defaultNow().notNull(),
  receivedByUserId: uuid("received_by_user_id").references(() => users.id),
  notes: text("notes"),
  status: text("status").notNull().default("COMPLETED"),
});

export const goodsReceiptLines = pgTable("goods_receipt_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  goodsReceiptId: uuid("goods_receipt_id")
    .notNull()
    .references(() => goodsReceipts.id, { onDelete: "cascade" }),
  purchaseLineId: uuid("purchase_line_id").references(() => purchaseLines.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  lotId: uuid("lot_id").references(() => inventoryLots.id),
  quantityReceived: integer("quantity_received").notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 2 }).notNull(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
});

// ==============================================================================
// 5. APPAREL MANUFACTURING (ROUTES 1, 2, 3)
// ==============================================================================

export const productionOrders = pgTable("production_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // AFK-MFG-2026-001
  routeType: text("route_type").notNull(), // FINISHED_PURCHASE, BLANK_CUSTOMIZATION, FABRIC_OUTSOURCED
  targetProductId: uuid("target_product_id").references(() => products.id),
  targetVariantId: uuid("target_variant_id").references(() => productVariants.id),
  factoryContactId: uuid("factory_contact_id").references(() => contacts.id),
  plannedQuantity: integer("planned_quantity").notNull(),
  completedGoodQuantity: integer("completed_good_quantity").notNull().default(0),
  completedDefectQuantity: integer("completed_defect_quantity").notNull().default(0),
  status: text("status").notNull().default("PLANNED"), // PLANNED, FABRIC_ISSUED, IN_PRODUCTION, QC_PENDING, COMPLETED, CANCELLED
  startDate: timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
  targetDate: timestamp("target_date", { withTimezone: true }),
  totalMaterialCost: numeric("total_material_cost", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  totalDirectCost: numeric("total_direct_cost", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  unitCostCalculated: numeric("unit_cost_calculated", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  ventureId: uuid("venture_id").references(() => ventures.id), // Venture project link
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
});

export const productionMaterialIssues = pgTable("production_material_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  productionOrderId: uuid("production_order_id")
    .notNull()
    .references(() => productionOrders.id, { onDelete: "cascade" }),
  lotId: uuid("lot_id")
    .notNull()
    .references(() => inventoryLots.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  quantityIssued: integer("quantity_issued").notNull(),
  quantityReturned: integer("quantity_returned").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 18, scale: 2 }).notNull(),
  issueDate: timestamp("issue_date", { withTimezone: true }).defaultNow().notNull(),
  issuedByUserId: uuid("issued_by_user_id").references(() => users.id),
  notes: text("notes"),
});

export const productionCosts = pgTable("production_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  productionOrderId: uuid("production_order_id")
    .notNull()
    .references(() => productionOrders.id, { onDelete: "cascade" }),
  costType: text("cost_type").notNull(), // CMT_LABOR, PRINTING, EMBROIDERY, WASHING, ACCESSORIES, TRANSPORT, OTHER
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  supplierId: uuid("supplier_id").references(() => contacts.id),
  paymentAccountId: uuid("payment_account_id").references(() => paymentAccounts.id),
  paymentStatus: text("payment_status").notNull().default("UNPAID"), // PAID, UNPAID, PARTNER_PAID
  notes: text("notes"),
});

export const qcInspections = pgTable("qc_inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  productionOrderId: uuid("production_order_id")
    .notNull()
    .references(() => productionOrders.id, { onDelete: "cascade" }),
  inspectedByUserId: uuid("inspected_by_user_id").references(() => users.id),
  inspectionDate: timestamp("inspection_date", { withTimezone: true }).defaultNow().notNull(),
  totalInspected: integer("total_inspected").notNull(),
  goodUnits: integer("good_units").notNull(),
  minorDefects: integer("minor_defects").notNull().default(0),
  rejectedUnits: integer("rejected_units").notNull().default(0),
  defectReason: text("defect_reason"),
  passStatus: text("pass_status").notNull().default("PASSED"), // PASSED, PASSED_WITH_DEFECTS, REJECTED
  notes: text("notes"),
});

// ==============================================================================
// 6. SALES ORDERS & COURIER LOGISTICS
// ==============================================================================

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull().unique(), // AFK-ORD-2026-0001
    customerId: uuid("customer_id").references(() => contacts.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    cityZone: text("city_zone").notNull().default("Inside Dhaka"), // Inside Dhaka, Outside Dhaka, Sub-Dhaka
    channel: text("channel").notNull().default("MANUAL"), // WEBSITE, FACEBOOK, INSTAGRAM, WHATSAPP, IN_PERSON, MANUAL
    orderDate: timestamp("order_date", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").notNull().default("CONFIRMED"), // DRAFT, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED, RETURNED
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0.00"),
    discount: numeric("discount", { precision: 18, scale: 2 }).notNull().default("0.00"),
    deliveryCharge: numeric("delivery_charge", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    paymentStatus: text("payment_status").notNull().default("COD_PENDING"), // UNPAID, PARTIALLY_PAID, PAID, COD_PENDING
    paymentMethod: text("payment_method").notNull().default("COD"), // COD, BKASH, NAGAD, BANK_TRANSFER, CASH
    courierId: uuid("courier_id").references(() => contacts.id),
    waybillNumber: text("waybill_number"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_orders_number_idx").on(table.orderNumber),
    index("sales_orders_status_idx").on(table.status),
  ]
);

export const salesLines = pgTable(
  "sales_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    lotId: uuid("lot_id").references(() => inventoryLots.id),
    ventureId: uuid("venture_id").references(() => ventures.id), // Direct venture revenue & COGS attribution
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 18, scale: 2 }).notNull().default("0.00"),
    totalPrice: numeric("total_price", { precision: 18, scale: 2 }).notNull(),
    cogsUnitCost: numeric("cogs_unit_cost", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
  },
  (table) => [
    index("sales_lines_order_idx").on(table.salesOrderId),
    index("sales_lines_lot_idx").on(table.lotId),
    index("sales_lines_venture_idx").on(table.ventureId),
  ]
);

export const courierSettlements = pgTable("courier_settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  settlementNumber: text("settlement_number").notNull().unique(), // AFK-SET-2026-001
  courierId: uuid("courier_id")
    .notNull()
    .references(() => contacts.id),
  settlementDate: timestamp("settlement_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  totalCodCollected: numeric("total_cod_collected", { precision: 18, scale: 2 }).notNull(),
  courierFeesDeducted: numeric("courier_fees_deducted", { precision: 18, scale: 2 }).notNull(),
  netAmountReceived: numeric("net_amount_received", { precision: 18, scale: 2 }).notNull(),
  paymentAccountId: uuid("payment_account_id")
    .notNull()
    .references(() => paymentAccounts.id),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
  status: text("status").notNull().default("CONFIRMED"), // DRAFT, CONFIRMED
  notes: text("notes"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
});

export const courierSettlementLines = pgTable("courier_settlement_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  courierSettlementId: uuid("courier_settlement_id")
    .notNull()
    .references(() => courierSettlements.id, { onDelete: "cascade" }),
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id),
  codAmount: numeric("cod_amount", { precision: 18, scale: 2 }).notNull(),
  courierFee: numeric("courier_fee", { precision: 18, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
});

export const returnsAndExchanges = pgTable("returns_and_exchanges", {
  id: uuid("id").defaultRandom().primaryKey(),
  returnNumber: text("return_number").notNull().unique(), // AFK-RMA-2026-001
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id),
  returnDate: timestamp("return_date", { withTimezone: true }).defaultNow().notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("RECEIVED"), // REQUESTED, RECEIVED, INSPECTED, REFUNDED, REJECTED
  inspectionResult: text("inspection_result").notNull().default("RESTOCKABLE"), // RESTOCKABLE, DEFECTIVE
  refundAmount: numeric("refund_amount", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  paymentAccountId: uuid("payment_account_id").references(() => paymentAccounts.id),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
  processedByUserId: uuid("processed_by_user_id").references(() => users.id),
  notes: text("notes"),
});

// ==============================================================================
// 7. IDEAS, TASKS, DOCUMENTS & SYSTEM SETTINGS
// ==============================================================================

export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("PRODUCT"), // DESIGN, MARKETING, PRODUCT, LOGISTICS
  stage: text("stage").notNull().default("CONCEPT"), // CONCEPT, REVIEW, APPROVED, REJECTED, LAUNCHED
  estimatedBudget: numeric("estimated_budget", { precision: 18, scale: 2 }),
  ventureId: uuid("venture_id").references(() => ventures.id), // Linked venture project
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  dueDate: timestamp("due_date", { withTimezone: true }),
  priority: text("priority").notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, URGENT
  status: text("status").notNull().default("TODO"), // TODO, IN_PROGRESS, REVIEW, DONE
  relatedModule: text("related_module"), // PRODUCTION, DROP, MARKETING, FINANCE
  relatedId: text("related_id"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    originalMimeType: text("original_mime_type"),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    originalSizeBytes: integer("original_size_bytes"),
    storagePath: text("storage_path").notNull(), // relative to STORAGE_DIR (e.g. uploads/evidence/abc.webp)
    thumbnailPath: text("thumbnail_path"), // relative to STORAGE_DIR (e.g. uploads/thumbnails/thumb_abc.webp)
    fileHash: text("file_hash").notNull(), // SHA256 checksum
    width: integer("width"),
    height: integer("height"),
    module: text("module").notNull(), // FINANCE, VENTURES, INVENTORY, MANUFACTURING, SALES, GENERAL
    referenceId: text("reference_id"),
    entityType: text("entity_type"), // EXPENSE, VENTURE, PRODUCTION_ORDER, SALES_ORDER, etc.
    entityId: text("entity_id"),
    displayTitle: text("display_title"),
    category: text("category").notNull().default("GENERAL_EVIDENCE"), // PAYMENT_PROOF, RECEIPT, INVOICE, DELIVERY_PROOF, QC_DEFECT, AGREEMENT, SAMPLE_PHOTO, GENERAL_EVIDENCE
    description: text("description"),
    verificationStatus: text("verification_status").notNull().default("PENDING"), // PENDING, VERIFIED, REJECTED, SUPERSEDED
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationNotes: text("verification_notes"),
    isArchived: boolean("is_archived").notNull().default(false),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("docs_module_idx").on(table.module),
    index("docs_entity_idx").on(table.entityType, table.entityId),
    index("docs_verification_idx").on(table.verificationStatus),
    index("docs_category_idx").on(table.category),
    index("docs_created_at_idx").on(table.createdAt),
  ]
);

export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // EXPENSE, VENTURE, PRODUCTION_ORDER, SALES_ORDER, etc.
    entityId: text("entity_id").notNull(),
    linkType: text("link_type").notNull().default("PRIMARY"), // PRIMARY, SUPPORTING, REFERENCE
    notes: text("notes"),
    linkedByUserId: uuid("linked_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("doc_links_entity_idx").on(table.entityType, table.entityId),
    index("doc_links_doc_idx").on(table.documentId),
  ]
);

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
});

// ==============================================================================
// 8. VENTURES, PROJECTS & FLEXIBLE INVESTMENT ENGINE
// ==============================================================================

export const ventureTypes = pgTable("venture_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // PRODUCT_DROP, COLLECTION, INDEPENDENT_PROJECT, COLLAB, MARKETING, EXPERIMENTAL
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ventures = pgTable(
  "ventures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureNumber: text("venture_number").notNull().unique(), // VENT-2026-0001
    title: text("title").notNull(),
    typeCode: text("type_code")
      .notNull()
      .references(() => ventureTypes.code),
    stage: text("stage").notNull().default("IDEA"), // IDEA, PROPOSED, UNDER_REVIEW, APPROVED, FUNDING, ACTIVE, PRODUCTION, SELLING, RECONCILIATION, SETTLEMENT, CLOSED, ARCHIVED
    description: text("description"),
    targetBudget: numeric("target_budget", { precision: 18, scale: 2 }).notNull().default("0.00"),
    actualBudget: numeric("actual_budget", { precision: 18, scale: 2 }).notNull().default("0.00"),
    currency: text("currency").notNull().default("BDT"),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    closedDate: timestamp("closed_date", { withTimezone: true }),
    managerUserId: uuid("manager_user_id").references(() => users.id),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ventures_number_idx").on(table.ventureNumber),
    index("ventures_stage_idx").on(table.stage),
    index("ventures_type_idx").on(table.typeCode),
  ]
);

export const ventureAgreements = pgTable(
  "venture_agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("DRAFT"), // DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, SUPERSEDED, TERMINATED
    participationMode: text("participation_mode").notNull().default("EQUAL"), // EQUAL, PROPORTIONAL, CUSTOM_PROFIT, FIXED_RETURN, CAPITAL_RECOVERY_FIRST, PROFIT_REINVESTMENT, MANAGEMENT_SERVICE, CUSTOM_WATERFALL
    effectiveDate: timestamp("effective_date", { withTimezone: true }).defaultNow().notNull(),
    waterfallRules: jsonb("waterfall_rules"), // structured rules for multi-tier allocation
    lossRecoveryPolicy: text("loss_recovery_policy").notNull().default("PROPORTIONAL"), // PROPORTIONAL, CARRYFORWARD, CAPITAL_AT_RISK_LIMIT, PARTNER_COVERAGE
    notes: text("notes"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("venture_agreements_venture_idx").on(table.ventureId),
    index("venture_agreements_status_idx").on(table.status),
  ]
);

export const ventureParticipants = pgTable(
  "venture_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => ventureAgreements.id, { onDelete: "cascade" }),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id), // Nullable if external investor
    contactId: uuid("contact_id").references(() => contacts.id), // For external investors
    name: text("name").notNull(),
    isExternal: boolean("is_external").notNull().default(false),
    role: text("role").notNull().default("INVESTOR"), // LEAD_INVESTOR, INVESTOR, MANAGING_PARTNER, DESIGNER, OPERATOR, SUPPLIER_PARTNER, SILENT_PARTNER
    investmentCommitment: numeric("investment_commitment", { precision: 18, scale: 2 }).notNull().default("0.00"),
    actualCashContributed: numeric("actual_cash_contributed", { precision: 18, scale: 2 }).notNull().default("0.00"),
    approvedNonCashValue: numeric("approved_non_cash_value", { precision: 18, scale: 2 }).notNull().default("0.00"),
    investmentPercentage: numeric("investment_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    profitSharingPercentage: numeric("profit_sharing_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    lossSharingPercentage: numeric("loss_sharing_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    capitalRecoveryPriority: integer("capital_recovery_priority").notNull().default(1),
    votingWeight: numeric("voting_weight", { precision: 5, scale: 2 }).notNull().default("0.00"),
    responsibilities: text("responsibilities"),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE, WITHDRAWN, SETTLED
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("venture_participants_agreement_idx").on(table.agreementId),
    index("venture_participants_venture_idx").on(table.ventureId),
    index("venture_participants_partner_idx").on(table.partnerId),
  ]
);

export const ventureContributions = pgTable(
  "venture_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => ventureParticipants.id, { onDelete: "cascade" }),
    contributionType: text("contribution_type").notNull().default("CASH"), // CASH, PARTNER_LOAN, COMPANY_ALLOCATION, NON_CASH_ASSET, SERVICE_EQUITY
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    description: text("description").notNull(),
    valuationBasis: text("valuation_basis"),
    paymentAccountId: uuid("payment_account_id").references(() => paymentAccounts.id),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    status: text("status").notNull().default("CONFIRMED"), // PLEDGED, CONFIRMED, REJECTED, REVERSED
    contributedAt: timestamp("contributed_at", { withTimezone: true }).defaultNow().notNull(),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
    notes: text("notes"),
  },
  (table) => [
    index("venture_contributions_venture_idx").on(table.ventureId),
    index("venture_contributions_participant_idx").on(table.participantId),
  ]
);

export const ventureCostAllocations = pgTable(
  "venture_cost_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    allocationBasis: text("allocation_basis").notNull().default("DIRECT"), // DIRECT, PERCENTAGE, REVENUE_RATIO, UNITS_SOLD, EQUAL_SPLIT
    memo: text("memo").notNull(),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }).defaultNow().notNull(),
    allocatedByUserId: uuid("allocated_by_user_id").references(() => users.id),
  },
  (table) => [
    index("venture_cost_allocations_venture_idx").on(table.ventureId),
  ]
);

export const ventureProductLinks = pgTable(
  "venture_product_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    collectionId: uuid("collection_id").references(() => collections.id),
    notes: text("notes"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("venture_product_links_venture_idx").on(table.ventureId),
    index("venture_product_links_product_idx").on(table.productId),
  ]
);

export const ventureAllocationSnapshots = pgTable(
  "venture_allocation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => ventureAgreements.id),
    snapshotNumber: text("snapshot_number").notNull().unique(), // SNAP-VENT-2026-0001-01
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    grossRevenue: numeric("gross_revenue", { precision: 18, scale: 2 }).notNull().default("0.00"),
    returnsAndAllowances: numeric("returns_and_allowances", { precision: 18, scale: 2 }).notNull().default("0.00"),
    netRevenue: numeric("net_revenue", { precision: 18, scale: 2 }).notNull().default("0.00"),
    cogs: numeric("cogs", { precision: 18, scale: 2 }).notNull().default("0.00"),
    directExpenses: numeric("direct_expenses", { precision: 18, scale: 2 }).notNull().default("0.00"),
    sharedAllocatedExpenses: numeric("shared_allocated_expenses", { precision: 18, scale: 2 }).notNull().default("0.00"),
    operatingReserveRetained: numeric("operating_reserve_retained", { precision: 18, scale: 2 }).notNull().default("0.00"),
    netDistributable: numeric("net_distributable", { precision: 18, scale: 2 }).notNull().default("0.00"),
    calculationBasisJson: jsonb("calculation_basis_json").notNull(),
    isSettled: boolean("is_settled").notNull().default(false),
    calculatedByUserId: uuid("calculated_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("venture_snapshots_venture_idx").on(table.ventureId),
    index("venture_snapshots_number_idx").on(table.snapshotNumber),
  ]
);

export const ventureSettlements = pgTable(
  "venture_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementNumber: text("settlement_number").notNull().unique(), // SETTL-VENT-2026-0001-01
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => ventureAllocationSnapshots.id),
    settlementType: text("settlement_type").notNull().default("FULL"), // FULL, PARTIAL, PROFIT_ONLY, CAPITAL_RECOVERY, REINVESTMENT, LOSS_CARRYFORWARD
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
    paymentAccountId: uuid("payment_account_id").references(() => paymentAccounts.id),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    status: text("status").notNull().default("DRAFT"), // DRAFT, APPROVED, PAID, REINVESTED, CANCELLED, REVERSED
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("venture_settlements_venture_idx").on(table.ventureId),
    index("venture_settlements_number_idx").on(table.settlementNumber),
  ]
);

export const ventureSettlementLines = pgTable(
  "venture_settlement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => ventureSettlements.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => ventureParticipants.id),
    grossEntitlement: numeric("gross_entitlement", { precision: 18, scale: 2 }).notNull(),
    capitalRecovered: numeric("capital_recovered", { precision: 18, scale: 2 }).notNull().default("0.00"),
    profitDistributed: numeric("profit_distributed", { precision: 18, scale: 2 }).notNull().default("0.00"),
    lossesCarriedForward: numeric("losses_carried_forward", { precision: 18, scale: 2 }).notNull().default("0.00"),
    reinvestedAmount: numeric("reinvested_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
    netCashPaid: numeric("net_cash_paid", { precision: 18, scale: 2 }).notNull().default("0.00"),
    paymentReference: text("payment_reference"),
    status: text("status").notNull().default("PENDING"), // PENDING, PAID, REINVESTED, CANCELLED
  },
  (table) => [
    index("venture_settlement_lines_settlement_idx").on(table.settlementId),
    index("venture_settlement_lines_participant_idx").on(table.participantId),
  ]
);

// ==============================================================================
// 9. BUSINESS CUSTOMISATION STUDIO (CUSTOM FIELDS & WORKFLOWS)
// ==============================================================================

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // VENTURE, PRODUCT, SUPPLIER, ORDER, PARTNER, BATCH
    fieldKey: text("field_key").notNull(), // e.g. fabric_composition
    fieldLabel: text("field_label").notNull(),
    dataType: text("data_type").notNull(), // TEXT, NUMBER, DECIMAL, MONEY, PERCENTAGE, DATE, SELECT, CHECKBOX, URL
    options: jsonb("options"), // for select options
    isRequired: boolean("is_required").notNull().default(false),
    defaultValue: text("default_value"),
    helpText: text("help_text"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("custom_fields_entity_idx").on(table.entityType),
    index("custom_fields_key_idx").on(table.entityType, table.fieldKey),
  ]
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(), // UUID of the venture, product, etc.
    valueText: text("value_text"),
    valueNumeric: numeric("value_numeric", { precision: 18, scale: 4 }),
    valueDate: timestamp("value_date", { withTimezone: true }),
    valueJson: jsonb("value_json"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("custom_values_entity_idx").on(table.entityId),
    index("custom_values_def_idx").on(table.definitionId),
  ]
);

export const workflowDefinitions = pgTable("workflow_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowType: text("workflow_type").notNull().unique(), // VENTURE_APPROVAL, SETTLEMENT_PAYOUT, AGREEMENT_AMENDMENT, CAPITAL_WITHDRAWAL
  name: text("name").notNull(),
  description: text("description"),
  stagesJson: jsonb("stages_json").notNull(), // stages, approver roles, amount thresholds, self-approval restriction
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
