import { db } from "@/db";
import { products, productVariants, inventoryLots, stockMovements, locations, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { receivePurchaseLot, createProductWithVariants } from "@/server/services/inventory";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const allProducts = await db.select().from(products).orderBy(products.name);
  const allVariants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      sellingPrice: productVariants.sellingPrice,
      productName: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id));

  const allLots = await db
    .select({
      id: inventoryLots.id,
      lotNumber: inventoryLots.lotNumber,
      sku: productVariants.sku,
      initialQuantity: inventoryLots.initialQuantity,
      currentQuantity: inventoryLots.currentQuantity,
      reservedQuantity: inventoryLots.reservedQuantity,
      unitCost: inventoryLots.unitCost,
      totalCost: inventoryLots.totalCost,
      status: inventoryLots.status,
      receivedDate: inventoryLots.receivedDate,
    })
    .from(inventoryLots)
    .innerJoin(productVariants, eq(inventoryLots.variantId, productVariants.id))
    .orderBy(desc(inventoryLots.receivedDate));

  const movements = await db
    .select({
      id: stockMovements.id,
      sku: productVariants.sku,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      createdAt: stockMovements.createdAt,
      notes: stockMovements.notes,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(stockMovements.variantId, productVariants.id))
    .orderBy(desc(stockMovements.createdAt))
    .limit(30);

  const payAccounts = await db.select().from(paymentAccounts);

  async function handleReceiveLot(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "INVENTORY_MGR"]);

    const variantId = formData.get("variantId") as string;
    const lotNumber = formData.get("lotNumber") as string;
    const quantity = Number(formData.get("quantity"));
    const unitCost = Number(formData.get("unitCost"));
    const paymentAccountId = formData.get("paymentAccountId") as string;
    const isRawMaterial = formData.get("isRawMaterial") === "true";

    if (!variantId || !lotNumber || !quantity || !unitCost || !paymentAccountId) {
      throw new Error("All fields required");
    }

    await receivePurchaseLot({
      variantId,
      lotNumber,
      quantity,
      unitCost,
      paymentAccountId,
      isRawMaterial,
      userId: user.id,
    });

    revalidatePath("/inventory");
    revalidatePath("/finance");
    revalidatePath("/");
  }

  async function handleCreateProduct(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "INVENTORY_MGR"]);
    const name = formData.get("name") as string;
    const styleCode = formData.get("styleCode") as string;
    const category = formData.get("category") as string;
    const productType = formData.get("productType") as string;
    const size = formData.get("size") as string;
    const color = formData.get("color") as string;
    const sellingPrice = Number(formData.get("sellingPrice") || 0);
    const costPrice = Number(formData.get("costPrice") || 0);

    if (!name || !styleCode || !category || !size || !color) {
      throw new Error("Product name, style code, category, size, and color are required");
    }

    const sku = `${styleCode}-${color.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`;

    await createProductWithVariants({
      name,
      styleCode,
      category,
      productType,
      retailPrice: sellingPrice,
      variants: [
        {
          sku,
          size,
          color,
          sellingPrice,
          costPrice,
        },
      ],
    });

    revalidatePath("/inventory");
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-afk-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Catalog & Inventory Management</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            SKU variants, lot-based actual costing, and immutable stock movement ledger.
          </p>
        </div>
        <a
          href="/api/export/inventory"
          className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
        >
          <span>📥 Export Inventory (CSV)</span>
        </a>
      </div>

      {/* Inventory Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receive Purchase Lot Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Receive Goods / Raw Materials Lot</h3>
          <form action={handleReceiveLot} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">SKU Variant</label>
                <select
                  name="variantId"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select SKU...</option>
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} ({v.productName} - {v.size}/{v.color})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Lot Number</label>
                <input
                  type="text"
                  name="lotNumber"
                  required
                  placeholder="e.g. LOT-2026-005"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  required
                  placeholder="Qty received"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Unit Cost (৳)</label>
                <input
                  type="number"
                  name="unitCost"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="Cost per unit"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Item Type</label>
                <select
                  name="isRawMaterial"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="false">Finished Goods</option>
                  <option value="true">Raw Material / Fabric</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Payment Account</label>
              <select
                name="paymentAccountId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Account...</option>
                {payAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name} ({pa.type})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition shadow cursor-pointer"
            >
              Receive Lot & Post GL Asset
            </button>
          </form>
        </div>

        {/* Create New Product Style Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Add Catalog Style & SKU Variant</h3>
          <form action={handleCreateProduct} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Product / Fabric Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Heavyweight Boxy Tee"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Style Code</label>
                <input
                  type="text"
                  name="styleCode"
                  required
                  placeholder="e.g. AFK-TS-001"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Category</label>
                <input
                  type="text"
                  name="category"
                  required
                  placeholder="e.g. T-Shirts, Hoodies, Fabrics"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Classification</label>
                <select
                  name="productType"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="FINISHED_GOODS">Finished Apparel</option>
                  <option value="RAW_MATERIAL">Raw Material (Fabric/Trim)</option>
                  <option value="PACKAGING">Packaging & Labels</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Size</label>
                <input
                  type="text"
                  name="size"
                  required
                  placeholder="M, L, XL, KG"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Color</label>
                <input
                  type="text"
                  name="color"
                  required
                  placeholder="Washed Black"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Retail Price (৳)</label>
                <input
                  type="number"
                  name="sellingPrice"
                  step="0.01"
                  placeholder="1450"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Cost Price (৳)</label>
                <input
                  type="number"
                  name="costPrice"
                  step="0.01"
                  placeholder="420"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-offwhite text-xs font-semibold rounded transition cursor-pointer"
            >
              Create Product Style & SKU
            </button>
          </form>
        </div>
      </div>

      {/* Active Inventory Lots Table */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Inventory Lots (Traceable Actual Cost)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Lot Number</th>
                <th className="py-2.5 font-medium">SKU</th>
                <th className="py-2.5 font-medium text-right">Initial Qty</th>
                <th className="py-2.5 font-medium text-right">Available Qty</th>
                <th className="py-2.5 font-medium text-right">Reserved Qty</th>
                <th className="py-2.5 font-medium text-right">Unit Cost</th>
                <th className="py-2.5 font-medium text-right">Total Valuation</th>
                <th className="py-2.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {allLots.map((lot) => (
                <tr key={lot.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2.5 font-mono text-afk-offwhite font-semibold">{lot.lotNumber}</td>
                  <td className="py-2.5 font-mono text-afk-muted">{lot.sku}</td>
                  <td className="py-2.5 text-right font-mono text-afk-muted">{lot.initialQuantity}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">{lot.currentQuantity}</td>
                  <td className="py-2.5 text-right font-mono text-afk-gold">{lot.reservedQuantity}</td>
                  <td className="py-2.5 text-right font-mono text-afk-muted">
                    ৳{Number(lot.unitCost).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">
                    ৳{(lot.currentQuantity * Number(lot.unitCost)).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        lot.status === "ACTIVE"
                          ? "bg-afk-olive-dark text-afk-olive-accent"
                          : "bg-afk-border text-afk-muted"
                      }`}
                    >
                      {lot.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Ledger */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Stock Movement Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2 font-medium">SKU</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium text-right">Quantity</th>
                <th className="py-2 font-medium text-right">Unit Cost</th>
                <th className="py-2 font-medium">Reference</th>
                <th className="py-2 font-medium">Notes</th>
                <th className="py-2 font-medium text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2 font-mono text-afk-offwhite font-medium">{m.sku}</td>
                  <td className="py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                      {m.movementType}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono font-bold text-afk-offwhite">{m.quantity}</td>
                  <td className="py-2 text-right font-mono text-afk-muted">৳{Number(m.unitCost).toFixed(2)}</td>
                  <td className="py-2 font-mono text-afk-muted">{m.referenceId || "—"}</td>
                  <td className="py-2 text-afk-muted truncate max-w-xs">{m.notes}</td>
                  <td className="py-2 text-right font-mono text-afk-muted">
                    {new Date(m.createdAt).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
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
