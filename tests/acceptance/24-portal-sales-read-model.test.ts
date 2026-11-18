import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { db } from "@/db";
import { paymentAccounts, contacts, accounts, partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createProductWithVariants, receivePurchaseLot } from "@/server/services/inventory";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  cancelSalesOrder,
  settleCourierRemittance,
} from "@/server/services/sales";
import { recordBusinessExpense, recordPartnerContribution, getFinancialStatements } from "@/server/services/finance";
import {
  READ_MODEL_DDL,
  buildSalesReadModel,
  applySalesReadModel,
  classifyJournal,
  type JournalFacts,
} from "@/server/services/portal-read-model";
import { READ_MODEL_DDL as PORTAL_DDL } from "../../apps/partner-portal/lib/migrate";
import { getAutoSyncState, schedulePortalSync, isAutoSyncEnabled } from "@/server/services/portal-autosync";

const CLOUD_URL = process.env.TEST_CLOUD_DATABASE_URL;

const noRedact = (t: string) => t;
const j = (over: Partial<JournalFacts>): JournalFacts => ({
  id: "j1",
  entryNumber: "AFK-JRN-1",
  date: new Date("2026-11-01T10:00:00Z"),
  entryType: "EXPENSE",
  description: "desc",
  reference: null,
  sourceModule: "FINANCE",
  status: "POSTED",
  lines: [],
  ...over,
});
const line = (accountCode: string, accountName: string, accountGroup: string, debit: number, credit: number, partnerName: string | null = null) => ({
  accountCode,
  accountName,
  accountGroup,
  debit,
  credit,
  partnerName,
});

describe("Sync v2: portal sales / money read model", () => {
  it("cloud DDL in the portal matches the local copy byte for byte", () => {
    expect(PORTAL_DDL).toBe(READ_MODEL_DDL);
    for (const t of ["portal_sales_orders", "portal_transactions", "portal_daily_metrics"]) {
      expect(READ_MODEL_DDL).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
    // read model must not even have columns for customer PII
    expect(READ_MODEL_DDL).not.toMatch(/customer_name|customer_phone|shipping_address/);
  });

  describe("classifyJournal", () => {
    it("expense paid from a wallet is an OUT with the expense account as category", () => {
      const t = classifyJournal(
        j({ lines: [line("6030", "Marketing & Social Media Ads", "EXPENSE", 500, 0), line("1020", "BRAC Bank", "CASH", 0, 500)] }),
        noRedact
      )!;
      expect(t.kind).toBe("EXPENSE");
      expect(t.direction).toBe("OUT");
      expect(t.amount).toBe(500);
      expect(t.category).toBe("Marketing & Social Media Ads");
      expect(t.accountLabel).toBe("BRAC Bank");
    });

    it("expense on credit moves no cash (NEUTRAL)", () => {
      const t = classifyJournal(
        j({ lines: [line("6040", "Utilities", "EXPENSE", 300, 0), line("2010", "Trade Payables", "LIABILITY", 0, 300)] }),
        noRedact
      )!;
      expect(t.direction).toBe("NEUTRAL");
      expect(t.amount).toBe(300);
    });

    it("capital deposit is an IN deposit credited to the partner", () => {
      const t = classifyJournal(
        j({
          entryType: "CAPITAL_DEPOSIT",
          lines: [line("1020", "BRAC Bank", "CASH", 10000, 0), line("3010", "Partner Capital - Shawon", "CAPITAL", 0, 10000, "Shawon")],
        }),
        noRedact
      )!;
      expect(t.kind).toBe("DEPOSIT");
      expect(t.direction).toBe("IN");
      expect(t.partnerName).toBe("Shawon");
      expect(t.title).toContain("Shawon");
    });

    it("COD sale recognition is NEUTRAL; its COGS journal is skipped", () => {
      const sale = classifyJournal(
        j({
          entryType: "SALES",
          sourceModule: "SALES",
          reference: "AFK-ORD-2026-100001-REV",
          lines: [line("1120", "Courier Receivables", "RECEIVABLE", 1100, 0), line("4010", "Sales Revenue", "REVENUE", 0, 1000), line("4030", "Delivery Fee Income", "REVENUE", 0, 100)],
        }),
        noRedact
      )!;
      expect(sale.kind).toBe("SALE");
      expect(sale.direction).toBe("NEUTRAL");
      expect(sale.amount).toBe(1100);
      expect(sale.title).toBe("Sale · AFK-ORD-2026-100001");

      const cogs = classifyJournal(
        j({ entryType: "SALES", sourceModule: "SALES", reference: "AFK-ORD-2026-100001-COGS", lines: [line("5010", "COGS", "COGS", 300, 0), line("1230", "Finished Goods", "INVENTORY", 0, 300)] }),
        noRedact
      );
      expect(cogs).toBeNull();
    });

    it("courier payout is IN (net of fee) and wallet transfers are NEUTRAL", () => {
      const payout = classifyJournal(
        j({
          entryType: "SETTLEMENT",
          sourceModule: "COURIER",
          lines: [line("1020", "BRAC Bank", "CASH", 930, 0), line("6010", "Courier Fees", "EXPENSE", 70, 0), line("1120", "Courier Receivables", "RECEIVABLE", 0, 1000)],
        }),
        noRedact
      )!;
      expect(payout.kind).toBe("SETTLEMENT");
      expect(payout.direction).toBe("IN");
      expect(payout.amount).toBe(930);
      expect(payout.title).toContain("fee ৳70");

      const transfer = classifyJournal(
        j({ entryType: "TRANSFER", lines: [line("1020", "BRAC Bank", "CASH", 2000, 0), line("1010", "Cash on Hand", "CASH", 0, 2000)] }),
        noRedact
      )!;
      expect(transfer.kind).toBe("TRANSFER");
      expect(transfer.direction).toBe("NEUTRAL");
      expect(transfer.amount).toBe(2000);
    });

    it("customer names are redacted and unmoved WIP production journals are skipped", () => {
      const t = classifyJournal(
        j({
          entryType: "SALES",
          sourceModule: "SALES",
          reference: "AFK-ORD-1-REV",
          description: "Sales revenue recognized for AFK-ORD-1 (Secret Name)",
          lines: [line("1120", "Courier Receivables", "RECEIVABLE", 100, 0), line("4010", "Sales Revenue", "REVENUE", 0, 100)],
        }),
        (s) => s.replace(" (Secret Name)", "")
      )!;
      expect(t.description).not.toContain("Secret Name");

      expect(
        classifyJournal(j({ entryType: "PRODUCTION", lines: [line("1220", "WIP", "WIP", 50, 0), line("1210", "Materials", "INVENTORY", 0, 50)] }), noRedact)
      ).toBeNull();
    });
  });

  describe("built from the local ledger", () => {
    const stamp = Math.random().toString(36).slice(2, 8);
    const SECRET_NAME = `Quxwell Tarnowski ${stamp}`;
    const SECRET_PHONE = "01822334455";
    const SECRET_ADDR = `House 77 Zirconia Lane ${stamp}`;
    let orderIds: { delivered: string; cancelled: string };

    beforeAll(async () => {
      const { variants } = await createProductWithVariants({
        name: `Read Model Tee ${stamp}`,
        styleCode: `AFK-RM-${stamp}`,
        category: "T-Shirt",
        retailPrice: 1000,
        variants: [{ sku: `AFK-RM-M-${stamp}`, size: "M", color: "Black", costPrice: 250, sellingPrice: 1000 }],
      });
      const [cash] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);
      const [bank] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
      await receivePurchaseLot({ variantId: variants[0].id, lotNumber: `LOT-RM-${stamp}`, quantity: 10, unitCost: 250, paymentAccountId: cash.id, isRawMaterial: false });
      const [courier] = await db.insert(contacts).values({ name: `Courier ${stamp}`, type: "COURIER" }).returning();
      const cust = { customerName: SECRET_NAME, customerPhone: SECRET_PHONE, shippingAddress: SECRET_ADDR };

      const a = await createSalesOrder({ ...cust, channel: "FACEBOOK", lines: [{ variantId: variants[0].id, quantity: 2, unitPrice: 1000 }], deliveryCharge: 100 });
      await shipSalesOrder({ orderId: a.order.id, courierId: courier.id, waybillNumber: `WB-${stamp}` });
      await deliverSalesOrderAndRecogniseRevenue({ orderId: a.order.id });
      await settleCourierRemittance({ courierId: courier.id, paymentAccountId: bank.id, settlements: [{ salesOrderId: a.order.id, codAmount: 2100, courierFee: 100 }] });

      const b = await createSalesOrder({ ...cust, channel: "INSTAGRAM", lines: [{ variantId: variants[0].id, quantity: 1, unitPrice: 1000 }] });
      await cancelSalesOrder({ orderId: b.order.id, reason: "Customer cancelled" });
      orderIds = { delivered: a.order.id, cancelled: b.order.id };

      const [expAcc] = await db.select().from(accounts).where(eq(accounts.code, "6030")).limit(1);
      await recordBusinessExpense({ expenseAccountId: expAcc.id, paymentAccountId: bank.id, amount: 750, description: `Meta ads ${stamp}` });
      const [partner] = await db.select().from(partners).limit(1);
      await recordPartnerContribution({ partnerId: partner.id, amount: 5000, paymentAccountId: bank.id, reference: `Top-up ${stamp}` });
    });

    it("orders carry items, profit and a status timeline — and zero customer PII", async () => {
      const model = await buildSalesReadModel();
      const delivered = model.orders.find((o) => o.id === orderIds.delivered)!;
      const cancelled = model.orders.find((o) => o.id === orderIds.cancelled)!;

      expect(delivered.units).toBe(2);
      // SKUs are normalised to upper case by the catalog service
      expect(delivered.items[0].sku).toBe(`AFK-RM-M-${stamp}`.toUpperCase());
      expect(delivered.cogs).toBe(500);
      expect(delivered.profit).toBe(2100 - 100 - 500);
      expect(delivered.channel).toBe("FACEBOOK");
      expect(delivered.courierName).toBe(`Courier ${stamp}`);
      expect(delivered.timeline.map((t) => t.status)).toEqual(["CONFIRMED", "SHIPPED", "DELIVERED", "SETTLED"]);
      expect(delivered.customerLabel).toMatch(/^Q\. T\. .*· •••455$/);

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.timeline.map((t) => t.status)).toContain("CANCELLED");

      const json = JSON.stringify(model);
      expect(json).not.toContain("Quxwell");
      expect(json).not.toContain("Tarnowski");
      expect(json).not.toContain(SECRET_PHONE);
      expect(json).not.toContain("Zirconia");
    });

    it("money ledger has the expense, deposit, sale, return-free payout and no COGS rows", async () => {
      const model = await buildSalesReadModel();
      const mine = model.transactions.filter((t) => t.description.includes(stamp) || t.title.includes(`Meta`));
      expect(model.transactions.some((t) => t.kind === "EXPENSE" && t.amount === 750 && t.direction === "OUT" && t.category?.includes("Marketing"))).toBe(true);
      expect(model.transactions.some((t) => t.kind === "DEPOSIT" && t.amount === 5000 && t.direction === "IN")).toBe(true);
      expect(model.transactions.some((t) => t.kind === "SALE" && t.amount === 2100 && t.direction === "NEUTRAL")).toBe(true);
      expect(model.transactions.some((t) => t.kind === "SETTLEMENT" && t.amount === 2000 && t.direction === "IN")).toBe(true);
      expect(model.transactions.every((t) => !/COGS/i.test(t.title))).toBe(true);
      expect(mine.length).toBeGreaterThan(0);
    });

    it("daily aggregates reconcile with the general ledger", async () => {
      const model = await buildSalesReadModel();
      const st = await getFinancialStatements();

      const sum = (k: keyof (typeof model.daily)[number]) => model.daily.reduce((s, d) => s + (d[k] as number), 0);
      const round = (n: number) => Math.round(n * 100) / 100;

      // units booked must be real (regression: a correlated subquery once returned 0)
      expect(sum("unitsBooked")).toBeGreaterThanOrEqual(2);
      expect(sum("ordersCount")).toBeGreaterThanOrEqual(2);

      expect(round(sum("grossSales") + sum("deliveryIncome"))).toBe(round(st.incomeStatement.totalGrossRevenue));
      expect(round(sum("returns"))).toBe(round(st.incomeStatement.totalReturns));
      expect(round(sum("cogs"))).toBe(round(st.incomeStatement.totalCogs));
      expect(round(sum("expenses"))).toBe(round(st.incomeStatement.totalOperatingExpenses));

      const wallets = st.balanceSheet.assetAccounts.filter((a) => a.group === "CASH").reduce((s, a) => s + a.balance, 0);
      expect(round(sum("cashIn") - sum("cashOut"))).toBe(round(wallets));
    });

    describe.skipIf(!CLOUD_URL)("incremental write to the cloud database", () => {
      let cloud: pg.Pool;
      beforeAll(async () => {
        cloud = new pg.Pool({ connectionString: CLOUD_URL });
        await cloud.query("DROP TABLE IF EXISTS portal_sales_orders, portal_transactions, portal_daily_metrics");
      });
      afterAll(async () => {
        await cloud?.end();
      });

      it("first push writes everything, an unchanged second push writes nothing", async () => {
        const model = await buildSalesReadModel();
        const first = await applySalesReadModel(cloud, model);
        expect(first.orders.upserted).toBe(model.orders.length);
        expect(first.transactions.upserted).toBe(model.transactions.length);
        expect(first.daily.upserted).toBe(model.daily.length);

        const count = await cloud.query("SELECT COUNT(*)::int AS n FROM portal_sales_orders");
        expect(count.rows[0].n).toBe(model.orders.length);

        const second = await applySalesReadModel(cloud, model);
        expect(second.orders).toMatchObject({ upserted: 0, deleted: 0, unchanged: model.orders.length });
        expect(second.transactions).toMatchObject({ upserted: 0, deleted: 0 });
        expect(second.daily).toMatchObject({ upserted: 0, deleted: 0 });
      });

      it("a changed order rewrites only that order; vanished rows are pruned", async () => {
        const model = await buildSalesReadModel();
        await applySalesReadModel(cloud, model);

        const tweaked = {
          ...model,
          orders: model.orders.map((o) => (o.id === orderIds.delivered ? { ...o, status: "RETURNED" } : o)),
        };
        const res = await applySalesReadModel(cloud, tweaked);
        expect(res.orders.upserted).toBe(1);
        const row = await cloud.query("SELECT status, customer_label FROM portal_sales_orders WHERE id = $1", [orderIds.delivered]);
        expect(row.rows[0].status).toBe("RETURNED");
        expect(row.rows[0].customer_label).toMatch(/^Q\. T\. .*· •••455$/);

        const pruned = await applySalesReadModel(cloud, { ...tweaked, orders: tweaked.orders.filter((o) => o.id !== orderIds.cancelled) });
        expect(pruned.orders.deleted).toBe(1);
        const gone = await cloud.query("SELECT 1 FROM portal_sales_orders WHERE id = $1", [orderIds.cancelled]);
        expect(gone.rowCount).toBe(0);
      });

      it("the cloud copy has no column that could hold customer name, phone or address", async () => {
        const cols = await cloud.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name IN ('portal_sales_orders','portal_transactions','portal_daily_metrics')"
        );
        const names = cols.rows.map((r) => r.column_name).join(",");
        expect(names).not.toMatch(/phone|address|customer_name/);
      });
    });
  });

  describe("auto-sync scheduler", () => {
    it("is inert under test and never throws when called", async () => {
      expect(isAutoSyncEnabled()).toBe(false);
      expect(() => schedulePortalSync("test")).not.toThrow();
      const state = await getAutoSyncState();
      expect(state.enabled).toBe(false);
      expect(state.running).toBe(false);
    });
  });
});
