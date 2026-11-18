import { unstable_cache } from "next/cache";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { portalActivityFeed, portalPartnerStatements, portalVentures } from "./schema";
import { PORTAL_DATA_TAG } from "./portal-data";

/** Cached loaders for the Ventures, My Investments, Reports and Updates pages. Same rules as portal-data.ts. */
const TTL = 3600;
const n = (v: unknown) => Number(v ?? 0);
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export interface VentureView {
  id: string;
  ventureNumber: string;
  title: string;
  typeName: string;
  stage: string;
  description: string | null;
  targetBudget: number;
  actualBudget: number;
  actualCashRaised: number;
  startDate: string | null;
  targetDate: string | null;
  productionProgress: { plannedQty?: number; completedQty?: number; qcPassRate?: number } | null;
  salesProgress: { unitsSold?: number; grossSales?: number; netSales?: number } | null;
  participants: Record<string, any>[];
  performanceSummary: string | null;
}

export const getAllVentures = unstable_cache(
  async (): Promise<VentureView[]> => {
    const rows = await db.select().from(portalVentures).orderBy(desc(portalVentures.updatedAt));
    return rows.map((v) => ({
      id: v.id,
      ventureNumber: v.ventureNumber,
      title: v.title,
      typeName: v.typeName,
      stage: v.stage,
      description: v.description,
      targetBudget: n(v.targetBudget),
      actualBudget: n(v.actualBudget),
      actualCashRaised: n(v.actualCashRaised),
      startDate: iso(v.startDate),
      targetDate: iso(v.targetDate),
      productionProgress: (v.productionProgress as VentureView["productionProgress"]) ?? null,
      salesProgress: (v.salesProgress as VentureView["salesProgress"]) ?? null,
      participants: Array.isArray(v.participants) ? (v.participants as Record<string, any>[]) : [],
      performanceSummary: v.performanceSummary,
    }));
  },
  ["portal-all-ventures"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

/** Every partner's statement incl. settlement history (all five partners see the same ledger of distributions). */
export const getAllPartnerStatements = unstable_cache(
  async () => {
    const rows = await db.select().from(portalPartnerStatements).orderBy(portalPartnerStatements.name);
    return rows.map((s) => ({
      id: s.id,
      partnerId: s.partnerId,
      name: s.name,
      email: s.email,
      ownershipPct: String(s.ownershipPct),
      profitSharePct: String(s.profitSharePct),
      capitalContributed: String(s.capitalContributed),
      drawings: String(s.drawings),
      loanBalanceOwed: String(s.loanBalanceOwed),
      shareOfProfit: String(s.shareOfProfit),
      totalEquity: String(s.totalEquity),
      ventureContributions: String(s.ventureContributions),
      ventureEntitlements: String(s.ventureEntitlements),
      settlementHistory: (s.settlementHistory as any[]) ?? [],
    }));
  },
  ["portal-all-partner-statements"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

export interface ActivityView {
  id: string;
  category: string;
  title: string;
  description: string;
  timestamp: string;
  actorName: string | null;
}

export const getActivityPage = unstable_cache(
  async (opts: { category: string | null; page: number; pageSize: number }): Promise<{ rows: ActivityView[]; total: number }> => {
    const conditions: SQL[] = [];
    if (opts.category) conditions.push(eq(portalActivityFeed.category, opts.category));
    const where = conditions.length ? and(...conditions) : undefined;
    const [[{ total }], rows] = await Promise.all([
      db.select({ total: sql<number>`COUNT(*)::int` }).from(portalActivityFeed).where(where),
      db
        .select()
        .from(portalActivityFeed)
        .where(where)
        .orderBy(desc(portalActivityFeed.timestamp))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
    ]);
    return {
      total: Number(total),
      rows: rows.map((a) => ({
        id: a.id,
        category: a.category,
        title: a.title,
        description: a.description,
        timestamp: iso(a.timestamp)!,
        actorName: a.actorName,
      })),
    };
  },
  ["portal-activity-page"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);
