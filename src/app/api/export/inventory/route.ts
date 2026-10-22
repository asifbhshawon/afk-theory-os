import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryLots, productVariants, products, locations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(formatCsvCell).join(",");
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `afk-inventory-valuation-${dateStr}.csv`;

    const allLots = await db
      .select({
        lotNumber: inventoryLots.lotNumber,
        sku: productVariants.sku,
        productName: products.name,
        category: products.category,
        size: productVariants.size,
        color: productVariants.color,
        sellingPrice: productVariants.sellingPrice,
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
      .innerJoin(products, eq(productVariants.productId, products.id))
      .orderBy(desc(inventoryLots.receivedDate));

    const rows: string[] = [];
    rows.push(toCsvRow(["AFK THEORY - INVENTORY LOT VALUATION REPORT", `As of ${dateStr}`, "Currency: BDT"]));
    rows.push("");
    rows.push(
      toCsvRow([
        "Lot Number",
        "Product Name",
        "Category",
        "SKU",
        "Size",
        "Color",
        "Available Qty",
        "Reserved Qty",
        "Initial Qty",
        "Unit Cost (BDT)",
        "Retail Price (BDT)",
        "Lot Asset Value (BDT)",
        "Status",
        "Received Date",
      ])
    );

    let totalValuation = 0;
    let totalItems = 0;

    for (const lot of allLots) {
      const avail = Number(lot.currentQuantity);
      const unitCost = Number(lot.unitCost);
      const lotVal = avail * unitCost;
      totalValuation += lotVal;
      totalItems += avail;

      rows.push(
        toCsvRow([
          lot.lotNumber,
          lot.productName,
          lot.category,
          lot.sku,
          lot.size,
          lot.color,
          lot.currentQuantity,
          lot.reservedQuantity,
          lot.initialQuantity,
          unitCost.toFixed(2),
          Number(lot.sellingPrice || 0).toFixed(2),
          lotVal.toFixed(2),
          lot.status,
          lot.receivedDate ? new Date(lot.receivedDate).toISOString().split("T")[0] : "",
        ])
      );
    }

    rows.push("");
    rows.push(
      toCsvRow([
        "TOTAL INVENTORY VALUATION",
        "",
        "",
        "",
        "",
        "",
        totalItems,
        "",
        "",
        "",
        "",
        totalValuation.toFixed(2),
        "",
        "",
      ])
    );

    const bom = "\uFEFF";
    const fullPayload = bom + rows.join("\r\n");

    return new NextResponse(fullPayload, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized or export failed" }, { status: 500 });
  }
}
