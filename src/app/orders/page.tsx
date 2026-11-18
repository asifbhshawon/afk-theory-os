import { db } from "@/db";
import { contacts, paymentAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { listRecentOrdersWithItems, listSellableVariants } from "@/server/services/sales";
import { getEvidenceForEntities } from "@/server/services/evidence";
import { OrdersWorkspace } from "@/components/orders/OrdersWorkspace";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const canWrite = !!user && (user.isAdmin || user.roles.includes("SALES_OP"));

  const [orders, variants, couriers, payAccounts] = await Promise.all([
    listRecentOrdersWithItems(300),
    listSellableVariants(),
    db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(eq(contacts.type, "COURIER"))
      .orderBy(contacts.name),
    db
      .select({ id: paymentAccounts.id, name: paymentAccounts.name, type: paymentAccounts.type })
      .from(paymentAccounts)
      .where(eq(paymentAccounts.isActive, true)),
  ]);

  // proof (courier slips, delivery photos) attached to each order
  const evidence = await getEvidenceForEntities(
    "SALES_ORDER",
    orders.map((o) => o.id)
  );

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-afk-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-afk-offwhite">Sales &amp; Orders</h2>
          <p className="text-sm text-afk-secondary mt-0.5">
            Sell, ship, collect COD and handle returns — every step updates stock and the books.
          </p>
        </div>
        <a
          href="/api/export/orders"
          className="px-3 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border transition-colors"
        >
          Export orders (CSV)
        </a>
      </div>

      <OrdersWorkspace
        orders={orders}
        evidence={evidence}
        variants={variants}
        couriers={couriers}
        payAccounts={payAccounts}
        canWrite={canWrite}
      />
    </div>
  );
}
