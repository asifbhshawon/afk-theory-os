import { db } from "@/db";
import { salesOrders, salesLines, productVariants, contacts, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createSalesOrder, shipSalesOrder, deliverSalesOrderAndRecogniseRevenue } from "@/server/services/sales";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await db
    .select()
    .from(salesOrders)
    .orderBy(desc(salesOrders.orderDate))
    .limit(50);

  const allVariants = await db.select().from(productVariants).orderBy(productVariants.sku);
  const couriers = await db.select().from(contacts).where(eq(contacts.type, "COURIER"));
  const payAccounts = await db.select().from(paymentAccounts);

  async function handleCreateOrder(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    const customerName = formData.get("customerName") as string;
    const customerPhone = formData.get("customerPhone") as string;
    const shippingAddress = formData.get("shippingAddress") as string;
    const cityZone = formData.get("cityZone") as string;
    const variantId = formData.get("variantId") as string;
    const quantity = Number(formData.get("quantity"));
    const unitPrice = Number(formData.get("unitPrice"));
    const deliveryCharge = Number(formData.get("deliveryCharge") || 0);

    if (!customerName || !customerPhone || !shippingAddress || !variantId || !quantity || !unitPrice) {
      throw new Error("All fields required");
    }

    await createSalesOrder({
      customerName,
      customerPhone,
      shippingAddress,
      cityZone,
      lines: [{ variantId, quantity, unitPrice }],
      deliveryCharge,
      paymentMethod: "COD",
      userId: user.id,
    });

    revalidatePath("/orders");
    revalidatePath("/inventory");
  }

  async function handleShipOrder(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "SALES_OP"]);
    const orderId = formData.get("orderId") as string;
    const courierId = formData.get("courierId") as string;
    const waybillNumber = formData.get("waybillNumber") as string;

    await shipSalesOrder({
      orderId,
      courierId: courierId || undefined,
      waybillNumber: waybillNumber || undefined,
      userId: user.id,
    });

    revalidatePath("/orders");
  }

  async function handleDeliverOrder(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "SALES_OP"]);
    const orderId = formData.get("orderId") as string;

    await deliverSalesOrderAndRecogniseRevenue({ orderId, userId: user.id });

    revalidatePath("/orders");
    revalidatePath("/finance");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-afk-border">
        <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Sales Orders & Courier Logistics</h2>
        <p className="text-xs text-afk-muted mt-0.5">
          Order fulfillment, automated stock reservations, courier COD waybills, and revenue recognition.
        </p>
      </div>

      {/* Create Sales Order Quick Form */}
      <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Create Sales Order (Manual / Social)</h3>
        <form action={handleCreateOrder} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Customer Name</label>
            <input
              type="text"
              name="customerName"
              required
              placeholder="e.g. Tanvir Ahmed"
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Customer Phone</label>
            <input
              type="text"
              name="customerPhone"
              required
              placeholder="e.g. 01711223344"
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Shipping Address</label>
            <input
              type="text"
              name="shippingAddress"
              required
              placeholder="Full delivery address"
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Item Variant</label>
            <select
              name="variantId"
              required
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
            >
              <option value="">Select SKU...</option>
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} ({v.size}/{v.color})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Qty</label>
            <input
              type="number"
              name="quantity"
              min="1"
              defaultValue="1"
              required
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Price (৳)</label>
            <input
              type="number"
              name="unitPrice"
              step="0.01"
              defaultValue="1200"
              required
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition shadow"
            >
              Confirm & Reserve
            </button>
          </div>
        </form>
      </div>

      {/* Orders List Table */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Recent Sales Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Order Number</th>
                <th className="py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Phone</th>
                <th className="py-2.5 font-medium">Zone</th>
                <th className="py-2.5 font-medium text-right">Total Amount</th>
                <th className="py-2.5 font-medium text-center">Payment</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2.5 font-mono text-afk-offwhite font-bold">{o.orderNumber}</td>
                  <td className="py-2.5 text-afk-offwhite font-medium">{o.customerName}</td>
                  <td className="py-2.5 font-mono text-afk-muted">{o.customerPhone}</td>
                  <td className="py-2.5 text-afk-muted">{o.cityZone}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">
                    ৳{Number(o.totalAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        o.status === "DELIVERED"
                          ? "bg-afk-olive-dark text-afk-olive-accent"
                          : o.status === "SHIPPED"
                          ? "bg-afk-gold/20 text-afk-gold"
                          : o.status === "RETURNED"
                          ? "bg-afk-danger/20 text-afk-danger"
                          : "bg-afk-border text-afk-offwhite"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right space-x-1.5">
                    {o.status === "CONFIRMED" && (
                      <form action={handleShipOrder} className="inline">
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          className="px-2 py-1 bg-afk-surface border border-afk-border hover:bg-afk-surfaceLight text-[11px] rounded text-afk-gold font-medium transition"
                        >
                          Ship
                        </button>
                      </form>
                    )}
                    {o.status === "SHIPPED" && (
                      <form action={handleDeliverOrder} className="inline">
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          className="px-2 py-1 bg-afk-olive hover:bg-afk-olive-light text-[11px] rounded text-afk-offwhite font-medium transition"
                        >
                          Confirm Delivered
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
