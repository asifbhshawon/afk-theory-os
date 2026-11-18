import { db } from "@/db";
import { products, productVariants, inventoryLots, stockMovements, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getInventoryStockMap } from "@/server/services/inventory";
import { CatalogManagerClient } from "@/components/inventory/CatalogManagerClient";

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
      costPrice: productVariants.costPrice,
      productId: productVariants.productId,
      inStockWithoutCount: productVariants.inStockWithoutCount,
      productName: products.name,
      styleCode: products.styleCode,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .orderBy(products.styleCode, productVariants.color, productVariants.size);

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
  const stockMap = await getInventoryStockMap();

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-afk-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Catalog & Inventory Management</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Apparel style catalog, multiple colorways, SKU variant matrix, traceable actual costing, and stock ledger.
          </p>
        </div>
        <a
          href="/api/export/inventory"
          className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
        >
          <span>📥 Export Inventory (CSV)</span>
        </a>
      </div>

      <CatalogManagerClient
        products={allProducts}
        variants={allVariants}
        stockMap={stockMap}
        lots={allLots}
        movements={movements}
        payAccounts={payAccounts}
        canManage={true}
      />
    </div>
  );
}
