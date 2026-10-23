import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesOrders } from "@/db/schema";
import { desc } from "drizzle-orm";
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
    const filename = `afk-sales-orders-${dateStr}.csv`;

    const orders = await db
      .select()
      .from(salesOrders)
      .orderBy(desc(salesOrders.orderDate));

    const rows: string[] = [];
    rows.push(toCsvRow(["AFK THEORY - SALES ORDERS LOG", `As of ${dateStr}`, "Currency: BDT"]));
    rows.push("");
    rows.push(
      toCsvRow([
        "Order Number",
        "Date",
        "Customer Name",
        "Customer Phone",
        "Delivery Address",
        "City/Zone",
        "Order Status",
        "Payment Status",
        "Subtotal (BDT)",
        "Delivery Charge (BDT)",
        "Discount (BDT)",
        "Total Amount (BDT)",
        "Tracking / Courier Reference",
        "Notes",
      ])
    );

    let totalRevenue = 0;

    for (const ord of orders) {
      const amt = Number(ord.totalAmount);
      totalRevenue += amt;

      rows.push(
        toCsvRow([
          ord.orderNumber,
          ord.orderDate ? new Date(ord.orderDate).toISOString().split("T")[0] : "",
          ord.customerName,
          ord.customerPhone,
          ord.shippingAddress,
          ord.cityZone || "",
          ord.status,
          ord.paymentStatus,
          Number(ord.subtotal).toFixed(2),
          Number(ord.deliveryCharge || 0).toFixed(2),
          Number(ord.discount || 0).toFixed(2),
          amt.toFixed(2),
          ord.waybillNumber || "",
          ord.notes || "",
        ])
      );
    }

    rows.push("");
    rows.push(
      toCsvRow([
        "TOTAL ORDERS COUNT",
        orders.length,
        "",
        "",
        "",
        "",
        "",
        "TOTAL REVENUE",
        "",
        "",
        "",
        totalRevenue.toFixed(2),
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
