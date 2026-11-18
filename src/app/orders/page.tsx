import { db } from "@/db";
import { salesOrders, productVariants, products, contacts, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getInventoryStockMap } from "@/server/services/inventory";
import { OrdersWorkspaceClient } from "@/components/orders/OrdersWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await db
    .select()
    .from(salesOrders)
    .orderBy(desc(salesOrders.orderDate))
    .limit(50);

  const allVariants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      sellingPrice: productVariants.sellingPrice,
      costPrice: productVariants.costPrice,
      productId: productVariants.productId,
      inStockWithoutCount: productVariants.inStockWithoutCount,
      productName: products.name,
      styleCode: products.styleCode,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .orderBy(products.styleCode, productVariants.color, productVariants.size);

  const couriers = await db.select().from(contacts).where(eq(contacts.type, "COURIER"));
  const payAccounts = await db.select().from(paymentAccounts);
  const stockMap = await getInventoryStockMap();

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-afk-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Sales Orders & Courier Logistics</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Order fulfillment, multi-line item reserves, courier COD waybills, pre-orders, and revenue recognition.
          </p>
        </div>
        <a
          href="/api/export/orders"
          className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
        >
          <span>📥 Export Orders (CSV)</span>
        </a>
      </div>

      <OrdersWorkspaceClient
        orders={orders}
        variants={allVariants}
        stockMap={stockMap}
        couriers={couriers}
        payAccounts={payAccounts}
        canManage={true}
      />
    </div>
  );
}
