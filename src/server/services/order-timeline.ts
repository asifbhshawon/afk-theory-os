import { db } from "@/db";
import {
  stockMovements,
  locations,
  courierSettlementLines,
  courierSettlements,
  returnsAndExchanges,
  auditLogs,
} from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export interface TimelineEvent {
  status: "CONFIRMED" | "SHIPPED" | "DELIVERED" | "SETTLED" | "RETURNED" | "CANCELLED";
  at: string; // ISO
}

/**
 * Reconstructs each order's status history from what the ERP already records
 * (there is no status-history table): order date, the stock movement into
 * transit (shipped), the fulfilment movement (delivered), the courier settlement
 * (payout received), the return record and the cancellation audit log.
 *
 * Shared by the local order panel and the Partner Portal read model so both
 * tell the same story. `since` bounds the queries to the orders being shown.
 */
export async function loadOrderTimelines(
  orders: { id: string; orderNumber: string; orderDate: Date }[],
  since: Date
): Promise<Map<string, TimelineEvent[]>> {
  const result = new Map<string, TimelineEvent[]>();
  if (orders.length === 0) return result;

  const [transit] = await db.select().from(locations).where(eq(locations.code, "TRANSIT")).limit(1);

  const [movements, settled, returned, cancelled] = await Promise.all([
    db
      .select({
        ref: stockMovements.referenceId,
        type: stockMovements.movementType,
        to: stockMovements.toLocationId,
        at: stockMovements.createdAt,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.referenceType, "ORDER"), gte(stockMovements.createdAt, since))),
    db
      .select({ orderId: courierSettlementLines.salesOrderId, at: courierSettlements.settlementDate })
      .from(courierSettlementLines)
      .innerJoin(courierSettlements, eq(courierSettlementLines.courierSettlementId, courierSettlements.id)),
    db.select({ orderId: returnsAndExchanges.salesOrderId, at: returnsAndExchanges.returnDate }).from(returnsAndExchanges),
    db
      .select({ orderId: auditLogs.entityId, at: auditLogs.createdAt })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, "ORDER"), sql`${auditLogs.details} ILIKE '%cancelled%'`, gte(auditLogs.createdAt, since))
      ),
  ]);

  const earliest = (dates: Date[]) => (dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null);

  for (const o of orders) {
    const mine = movements.filter((m) => m.ref === o.orderNumber);
    const events: { status: TimelineEvent["status"]; at: Date | null }[] = [
      { status: "CONFIRMED", at: o.orderDate },
      { status: "SHIPPED", at: earliest(mine.filter((m) => m.type === "TRANSFER" && transit && m.to === transit.id).map((m) => m.at)) },
      { status: "DELIVERED", at: earliest(mine.filter((m) => m.type === "FULFILLMENT").map((m) => m.at)) },
      { status: "SETTLED", at: earliest(settled.filter((s) => s.orderId === o.id).map((s) => s.at)) },
      { status: "RETURNED", at: earliest(returned.filter((r) => r.orderId === o.id).map((r) => r.at)) },
      { status: "CANCELLED", at: earliest(cancelled.filter((c) => c.orderId === o.id).map((c) => c.at)) },
    ];
    result.set(
      o.id,
      events
        .filter((e): e is { status: TimelineEvent["status"]; at: Date } => !!e.at)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((e) => ({ status: e.status, at: e.at.toISOString() }))
    );
  }
  return result;
}
