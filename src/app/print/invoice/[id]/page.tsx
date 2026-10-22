import { db } from "@/db";
import { salesOrders, salesLines, productVariants, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintableInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order] = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }

  const lines = await db
    .select({
      id: salesLines.id,
      quantity: salesLines.quantity,
      unitPrice: salesLines.unitPrice,
      totalPrice: salesLines.totalPrice,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
    })
    .from(salesLines)
    .innerJoin(productVariants, eq(salesLines.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(salesLines.salesOrderId, order.id));

  return (
    <div className="bg-white text-black min-h-screen p-8 max-w-4xl mx-auto font-sans">
      {/* Top action bar (hidden on print) */}
      <div className="no-print flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
        <span className="text-xs text-gray-500">Official Customer Invoice Preview</span>
        <PrintButton />
      </div>

      {/* Official Letterhead */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-widest uppercase">AFK THEORY</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mt-0.5">
            Modern Apparel & Streetwear
          </p>
          <p className="text-xs text-gray-500">Dhaka, Bangladesh · support@afktheory.local</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider">
            SALES INVOICE
          </span>
          <p className="text-xs font-mono font-bold mt-2">Invoice #: {order.orderNumber}</p>
          <p className="text-xs text-gray-600 font-mono">
            Date: {new Date(order.orderDate).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Customer & Shipping Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <span className="font-bold text-gray-700 uppercase tracking-wider">Billed & Shipped To:</span>
          <p className="mt-1 font-bold text-sm text-black">{order.customerName}</p>
          <p className="font-mono text-gray-700">{order.customerPhone}</p>
          <p className="text-gray-600 mt-1">{order.shippingAddress}</p>
          <p className="text-gray-500 font-medium">Zone: {order.cityZone}</p>
        </div>
        <div className="text-right font-mono space-y-1">
          <p><span className="text-gray-500">Payment Method:</span> <strong className="text-black uppercase">{order.paymentMethod}</strong></p>
          <p><span className="text-gray-500">Payment Status:</span> <strong className="text-black uppercase">{order.paymentStatus}</strong></p>
          {order.waybillNumber && (
            <p><span className="text-gray-500">Waybill #:</span> <strong className="text-black">{order.waybillNumber}</strong></p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-xs border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2.5 font-bold">Item & Description</th>
            <th className="py-2.5 font-bold">SKU</th>
            <th className="py-2.5 font-bold">Size / Color</th>
            <th className="py-2.5 font-bold text-center">Qty</th>
            <th className="py-2.5 font-bold text-right">Unit Price (৳)</th>
            <th className="py-2.5 font-bold text-right">Total (৳)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 font-mono">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2.5 font-sans font-medium text-black">{l.productName}</td>
              <td className="py-2.5 text-gray-600">{l.sku}</td>
              <td className="py-2.5 font-sans">{l.size} / {l.color}</td>
              <td className="py-2.5 text-center font-bold text-black">{l.quantity}</td>
              <td className="py-2.5 text-right">৳{Number(l.unitPrice).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
              <td className="py-2.5 text-right font-bold text-black">৳{Number(l.totalPrice).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Calculation */}
      <div className="flex justify-end mb-8 font-mono text-xs">
        <div className="w-64 space-y-2 border-t-2 border-black pt-3">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span>৳{Number(order.subtotal).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount:</span>
              <span>-৳{Number(order.discount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Delivery Fee:</span>
            <span>৳{Number(order.deliveryCharge).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between font-bold text-sm text-black border-t border-gray-300 pt-2">
            <span>GRAND TOTAL (BDT):</span>
            <span>৳{Number(order.totalAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Thank you & Policy */}
      <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500 font-sans">
        <p className="font-semibold text-gray-700">Thank you for supporting AFK THEORY.</p>
        <p className="mt-0.5 text-[11px]">Returns & exchanges accepted within 7 days in original condition with tags attached.</p>
      </div>
    </div>
  );
}
