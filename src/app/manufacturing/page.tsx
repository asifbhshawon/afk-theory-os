import { db } from "@/db";
import { productionOrders, productVariants, products, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createProductionOrder, addProductionCost, completeProductionOrder } from "@/server/services/manufacturing";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function ManufacturingPage() {
  const orders = await db
    .select({
      id: productionOrders.id,
      orderNumber: productionOrders.orderNumber,
      routeType: productionOrders.routeType,
      plannedQuantity: productionOrders.plannedQuantity,
      completedGoodQuantity: productionOrders.completedGoodQuantity,
      completedDefectQuantity: productionOrders.completedDefectQuantity,
      status: productionOrders.status,
      totalMaterialCost: productionOrders.totalMaterialCost,
      totalDirectCost: productionOrders.totalDirectCost,
      unitCostCalculated: productionOrders.unitCostCalculated,
      startDate: productionOrders.startDate,
      notes: productionOrders.notes,
      sku: productVariants.sku,
    })
    .from(productionOrders)
    .leftJoin(productVariants, eq(productionOrders.targetVariantId, productVariants.id))
    .orderBy(desc(productionOrders.startDate));

  const allVariants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      productName: products.name,
      productId: products.id,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id));

  const payAccounts = await db.select().from(paymentAccounts);

  async function handleCreateOrder(formData: FormData) {
    "use server";
    const orderNumber = formData.get("orderNumber") as string;
    const routeType = formData.get("routeType") as "FINISHED_PURCHASE" | "BLANK_CUSTOMIZATION" | "FABRIC_OUTSOURCED";
    const variantId = formData.get("targetVariantId") as string;
    const plannedQuantity = Number(formData.get("plannedQuantity"));
    const notes = formData.get("notes") as string;

    const [v] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);

    await createProductionOrder({
      orderNumber,
      routeType,
      targetProductId: v.productId,
      targetVariantId: variantId,
      plannedQuantity,
      notes,
    });

    revalidatePath("/manufacturing");
  }

  async function handleAddCost(formData: FormData) {
    "use server";
    const productionOrderId = formData.get("productionOrderId") as string;
    const costType = formData.get("costType") as string;
    const amount = Number(formData.get("amount"));
    const paymentAccountId = formData.get("paymentAccountId") as string;
    const notes = formData.get("notes") as string;

    await addProductionCost({
      productionOrderId,
      costType,
      amount,
      paymentAccountId: paymentAccountId || undefined,
      notes,
    });

    revalidatePath("/manufacturing");
    revalidatePath("/finance");
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-afk-border">
        <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Apparel Manufacturing Engine</h2>
        <p className="text-xs text-afk-muted mt-0.5">
          Route 1 (Finished Garment), Route 2 (Blank Customisation), Route 3 (Fabric to Outsourced Factory).
        </p>
      </div>

      {/* Production Orders Table */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Manufacturing Batch Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Order Number</th>
                <th className="py-2.5 font-medium">Route</th>
                <th className="py-2.5 font-medium">Target SKU</th>
                <th className="py-2.5 font-medium text-right">Planned Qty</th>
                <th className="py-2.5 font-medium text-right">Good Qty</th>
                <th className="py-2.5 font-medium text-right">Defect Qty</th>
                <th className="py-2.5 font-medium text-right">Material Cost</th>
                <th className="py-2.5 font-medium text-right">Direct Cost</th>
                <th className="py-2.5 font-medium text-right">Unit Cost</th>
                <th className="py-2.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2.5 font-mono text-afk-offwhite font-bold">{o.orderNumber}</td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                      {o.routeType}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-afk-muted">{o.sku || "—"}</td>
                  <td className="py-2.5 text-right font-mono text-afk-offwhite">{o.plannedQuantity}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-afk-success">{o.completedGoodQuantity}</td>
                  <td className="py-2.5 text-right font-mono text-afk-danger">{o.completedDefectQuantity}</td>
                  <td className="py-2.5 text-right font-mono text-afk-muted">৳{Number(o.totalMaterialCost).toFixed(2)}</td>
                  <td className="py-2.5 text-right font-mono text-afk-muted">৳{Number(o.totalDirectCost).toFixed(2)}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-afk-gold">৳{Number(o.unitCostCalculated).toFixed(2)}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        o.status === "COMPLETED"
                          ? "bg-afk-olive-dark text-afk-olive-accent"
                          : "bg-afk-warning/20 text-afk-warning"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forms Section: Create Order & Add Direct Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Order Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Initiate Manufacturing Order</h3>
          <form action={handleCreateOrder} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                required
                placeholder="e.g. MFG-2026-0002"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Production Route</label>
              <select
                name="routeType"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="FABRIC_OUTSOURCED">Route 3: Own Fabric to Outsourced Factory</option>
                <option value="BLANK_CUSTOMIZATION">Route 2: Blank Garment + Printing/Embroidery</option>
                <option value="FINISHED_PURCHASE">Route 1: Finished Garment Purchase</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Target Output Variant</label>
              <select
                name="targetVariantId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Target SKU...</option>
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} ({v.productName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Planned Quantity</label>
              <input
                type="number"
                name="plannedQuantity"
                min="1"
                required
                placeholder="e.g. 100"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Notes</label>
              <input
                type="text"
                name="notes"
                placeholder="e.g. First production drop"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-semibold rounded transition"
            >
              Create Manufacturing Order
            </button>
          </form>
        </div>

        {/* Add Production Cost Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Add Direct Batch Cost (WIP Charge)</h3>
          <form action={handleAddCost} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Production Order</label>
              <select
                name="productionOrderId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Order...</option>
                {orders
                  .filter((o) => o.status !== "COMPLETED")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} ({o.sku} - {o.plannedQuantity} pcs)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Cost Category</label>
              <select
                name="costType"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="CMT_LABOR">CMT (Cutting, Making, Trimming) Labor</option>
                <option value="PRINTING">Screen Printing / Plastisol / DTF</option>
                <option value="EMBROIDERY">Embroidery Service</option>
                <option value="WASHING">Garment Wash / Enzyme Treatment</option>
                <option value="ACCESSORIES">Trims, Zippers, Rib Collar</option>
                <option value="TRANSPORT">Factory Transport & Freight</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="1"
                required
                placeholder="e.g. 4500"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Payment Account</label>
              <select
                name="paymentAccountId"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Pay later (Credited to Trade Payables)</option>
                {payAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Notes</label>
              <input
                type="text"
                name="notes"
                placeholder="e.g. Factory bill #881"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-offwhite font-semibold rounded transition"
            >
              Post Production Cost to WIP
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
