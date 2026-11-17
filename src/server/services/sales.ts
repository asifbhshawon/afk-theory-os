import { db } from "@/db";
import {
  salesOrders,
  salesLines,
  inventoryLots,
  stockMovements,
  contacts,
  locations,
  accounts,
  paymentAccounts,
  courierSettlements,
  courierSettlementLines,
  returnsAndExchanges,
  productVariants,
} from "@/db/schema";
import { eq, and, sql, desc, inArray, like } from "drizzle-orm";
import { products, auditLogs } from "@/db/schema";
import { postJournalEntry } from "./finance";
import { schedulePortalSync } from "./portal-autosync";

// Status flow: CONFIRMED -> SHIPPED -> DELIVERED -> (RETURNED)
//              CONFIRMED | SHIPPED -> CANCELLED (reservation released)
export const SHIPPABLE_STATUSES = ["CONFIRMED", "PACKED"];
export const CANCELLABLE_STATUSES = ["CONFIRMED", "PACKED", "SHIPPED"];

export interface CreateOrderLineInput {
  variantId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateSalesOrderInput {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  cityZone?: string;
  channel?: string;
  lines: CreateOrderLineInput[];
  deliveryCharge?: number;
  discount?: number;
  paymentMethod?: string;
  notes?: string;
  userId?: string;
  idempotencyKey?: string;
}

// Generate unique sequential order number backed by atomic PostgreSQL sequence (concurrency-safe)
export async function generateOrderNumber(txClient?: any): Promise<string> {
  const client = txClient || db;
  const year = new Date().getFullYear();
  try {
    const res = await client.execute(sql`SELECT nextval('sales_order_seq') as seq`);
    const seq = String(res.rows[0].seq).padStart(6, "0");
    return `AFK-ORD-${year}-${seq}`;
  } catch {
    await client.execute(sql`CREATE SEQUENCE IF NOT EXISTS sales_order_seq START WITH 100001`);
    const res = await client.execute(sql`SELECT nextval('sales_order_seq') as seq`);
    const seq = String(res.rows[0].seq).padStart(6, "0");
    return `AFK-ORD-${year}-${seq}`;
  }
}

// Create sales order with atomic stock reservation (concurrency safe)
export async function createSalesOrder(input: CreateSalesOrderInput) {
  if (!input.lines || input.lines.length === 0) {
    throw new Error("Order must contain at least one line item.");
  }

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Quantity must be a whole number greater than zero.");
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }
  }
  if ((input.deliveryCharge ?? 0) < 0 || (input.discount ?? 0) < 0) {
    throw new Error("Delivery charge and discount cannot be negative.");
  }

  // Idempotency check (key is stored as the first line of `notes`,
  // so a user note can live alongside it)
  const idemTag = input.idempotencyKey ? `IDEMPOTENCY:${input.idempotencyKey}` : null;
  if (idemTag) {
    const [existingOrder] = await db
      .select()
      .from(salesOrders)
      .where(like(salesOrders.notes, `${idemTag}%`))
      .limit(1);

    if (existingOrder) {
      return { order: existingOrder, isDuplicate: true };
    }
  }

  const deliveryCharge = input.deliveryCharge || 0;
  const orderDiscount = input.discount || 0;
  let subtotal = 0;

  for (const line of input.lines) {
    const lineTotal = line.quantity * line.unitPrice - (line.discount || 0);
    subtotal += lineTotal;
  }
  const totalAmount = Math.max(0, subtotal + deliveryCharge - orderDiscount);

  const orderNumber = await generateOrderNumber();

  const created = await db.transaction(async (tx) => {
    // 1. Concurrency-Safe Stock Reservation for each line
    const reservedLines: {
      variantId: string;
      lotId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      totalPrice: number;
      cogsUnitCost: number;
    }[] = [];

    for (const line of input.lines) {
      // Row-level lock on available active lots for this SKU
      const lots = await tx
        .select()
        .from(inventoryLots)
        .where(
          and(
            eq(inventoryLots.variantId, line.variantId),
            eq(inventoryLots.status, "ACTIVE")
          )
        )
        .for("update");

      let remainingToReserve = line.quantity;

      for (const lot of lots) {
        const available = lot.currentQuantity - lot.reservedQuantity;
        if (available <= 0) continue;

        const allocate = Math.min(remainingToReserve, available);

        await tx
          .update(inventoryLots)
          .set({
            reservedQuantity: lot.reservedQuantity + allocate,
          })
          .where(eq(inventoryLots.id, lot.id));

        const lineProportion = allocate / line.quantity;
        const lineTotal = allocate * line.unitPrice - (line.discount || 0) * lineProportion;

        reservedLines.push({
          variantId: line.variantId,
          lotId: lot.id,
          quantity: allocate,
          unitPrice: line.unitPrice,
          discount: (line.discount || 0) * lineProportion,
          totalPrice: lineTotal,
          cogsUnitCost: Number(lot.unitCost),
        });

        remainingToReserve -= allocate;
        if (remainingToReserve === 0) break;
      }

      if (remainingToReserve > 0) {
        const [v] = await tx
          .select({ sku: productVariants.sku })
          .from(productVariants)
          .where(eq(productVariants.id, line.variantId))
          .limit(1);
        throw new Error(
          `Not enough stock for ${v?.sku ?? "SKU"}. Requested ${line.quantity}, only ${
            line.quantity - remainingToReserve
          } available.`
        );
      }
    }

    // 2. Insert Sales Order
    const [order] = await tx
      .insert(salesOrders)
      .values({
        orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        shippingAddress: input.shippingAddress,
        cityZone: input.cityZone || "Inside Dhaka",
        channel: input.channel || "MANUAL",
        subtotal: subtotal.toFixed(2),
        discount: orderDiscount.toFixed(2),
        deliveryCharge: deliveryCharge.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: "CONFIRMED",
        paymentStatus: "COD_PENDING",
        paymentMethod: input.paymentMethod || "COD",
        notes: idemTag
          ? input.notes
            ? `${idemTag}\n${input.notes}`
            : idemTag
          : input.notes,
        createdByUserId: input.userId,
      })
      .returning();

    // 3. Insert Sales Lines
    for (const rLine of reservedLines) {
      await tx.insert(salesLines).values({
        salesOrderId: order.id,
        variantId: rLine.variantId,
        lotId: rLine.lotId,
        quantity: rLine.quantity,
        unitPrice: rLine.unitPrice.toFixed(2),
        discount: rLine.discount.toFixed(2),
        totalPrice: rLine.totalPrice.toFixed(2),
        cogsUnitCost: rLine.cogsUnitCost.toFixed(2),
      });
    }

    return { order, lines: reservedLines, isDuplicate: false };
  });
  schedulePortalSync("order-created");
  return created;
}

// Mark order shipped with courier
export async function shipSalesOrder(data: {
  orderId: string;
  courierId?: string;
  waybillNumber?: string;
  userId?: string;
}) {
  const [order] = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, data.orderId))
    .limit(1);
  if (!order) throw new Error("Order not found.");
  if (!SHIPPABLE_STATUSES.includes(order.status)) {
    throw new Error(`Order ${order.orderNumber} is ${order.status} and cannot be shipped.`);
  }
  if (data.courierId) {
    const [courier] = await db.select().from(contacts).where(eq(contacts.id, data.courierId)).limit(1);
    if (!courier) throw new Error("Courier contact not found.");
  }

  const [transitLoc] = await db.select().from(locations).where(eq(locations.code, "TRANSIT")).limit(1);
  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);

  const shipped = await db.transaction(async (tx) => {
    await tx
      .update(salesOrders)
      .set({
        status: "SHIPPED",
        courierId: data.courierId,
        waybillNumber: data.waybillNumber?.trim() || undefined,
      })
      .where(eq(salesOrders.id, order.id));

    // Get order lines
    const lines = await tx.select().from(salesLines).where(eq(salesLines.salesOrderId, order.id));

    for (const line of lines) {
      await tx.insert(stockMovements).values({
        variantId: line.variantId,
        lotId: line.lotId,
        fromLocationId: mainWh.id,
        toLocationId: transitLoc.id,
        movementType: "TRANSFER",
        quantity: line.quantity,
        unitCost: line.cogsUnitCost,
        referenceType: "ORDER",
        referenceId: order.orderNumber,
        performedByUserId: data.userId,
        notes: `Dispatched with courier (Waybill: ${data.waybillNumber || "N/A"})`,
      });
    }

    return { success: true };
  });
  schedulePortalSync("order-shipped");
  return shipped;
}

// Confirm delivery and recognise revenue + COGS
export async function deliverSalesOrderAndRecogniseRevenue(data: {
  orderId: string;
  userId?: string;
}) {
  const [order] = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, data.orderId))
    .limit(1);
  if (!order) throw new Error("Order not found.");

  if (order.status === "DELIVERED") {
    throw new Error("Order is already marked delivered.");
  }
  if (order.status !== "SHIPPED") {
    throw new Error(
      `Order ${order.orderNumber} is ${order.status}; only SHIPPED orders can be marked delivered.`
    );
  }

  const lines = await db.select().from(salesLines).where(eq(salesLines.salesOrderId, order.id));

  const [revAcc] = await db.select().from(accounts).where(eq(accounts.code, "4010")).limit(1); // Sales Revenue
  const [delivAcc] = await db.select().from(accounts).where(eq(accounts.code, "4030")).limit(1); // Delivery Fee Income
  const [courierRecAcc] = await db.select().from(accounts).where(eq(accounts.code, "1120")).limit(1); // Courier Receivables
  const [cogsAcc] = await db.select().from(accounts).where(eq(accounts.code, "5010")).limit(1); // COGS
  const [finInvAcc] = await db.select().from(accounts).where(eq(accounts.code, "1230")).limit(1); // Finished Goods

  const [transitLoc] = await db.select().from(locations).where(eq(locations.code, "TRANSIT")).limit(1);

  let totalCogs = 0;
  for (const line of lines) {
    totalCogs += line.quantity * Number(line.cogsUnitCost);
  }

  const grossSales = Number(order.subtotal) - Number(order.discount);
  const deliveryIncome = Number(order.deliveryCharge);
  const totalReceivable = Number(order.totalAmount);

  return await db.transaction(async (tx) => {
    // 1. Update order status
    await tx
      .update(salesOrders)
      .set({
        status: "DELIVERED",
      })
      .where(eq(salesOrders.id, order.id));

    // 2. Consume stock from lots and record fulfillment stock movement
    for (const line of lines) {
      if (line.lotId) {
        const [lot] = await tx
          .select()
          .from(inventoryLots)
          .where(eq(inventoryLots.id, line.lotId))
          .for("update");

        if (lot) {
          const newCurrent = lot.currentQuantity - line.quantity;
          const newReserved = lot.reservedQuantity - line.quantity;
          await tx
            .update(inventoryLots)
            .set({
              currentQuantity: newCurrent,
              reservedQuantity: Math.max(0, newReserved),
              status: newCurrent <= 0 ? "DEPLETED" : "ACTIVE",
            })
            .where(eq(inventoryLots.id, lot.id));
        }
      }

      await tx.insert(stockMovements).values({
        variantId: line.variantId,
        lotId: line.lotId,
        fromLocationId: transitLoc.id,
        movementType: "FULFILLMENT",
        quantity: line.quantity,
        unitCost: line.cogsUnitCost,
        referenceType: "ORDER",
        referenceId: order.orderNumber,
        performedByUserId: data.userId,
        notes: `Fulfilled order ${order.orderNumber} to customer ${order.customerName}`,
      });
    }

    // 3. Post Revenue Journal:
    // Debit Courier Receivables (1120) for totalAmount
    // Credit Sales Revenue (4010) for goods
    // Credit Delivery Fee Income (4030) for delivery charge
    const revenueLines = [
      {
        accountId: courierRecAcc.id,
        debit: totalReceivable,
        credit: 0,
        memo: `COD receivable for delivered order ${order.orderNumber}`,
      },
      {
        accountId: revAcc.id,
        debit: 0,
        credit: grossSales,
        memo: `Clothing sales revenue`,
      },
    ];

    if (deliveryIncome > 0) {
      revenueLines.push({
        accountId: delivAcc.id,
        debit: 0,
        credit: deliveryIncome,
        memo: `Delivery fee collected from customer`,
      });
    }

    await postJournalEntry(
      {
        date: new Date(),
        entryType: "SALES",
        description: `Sales revenue recognized for ${order.orderNumber} (${order.customerName})`,
        reference: `${order.orderNumber}-REV`,
        sourceModule: "SALES",
        sourceId: order.id,
        userId: data.userId,
        lines: revenueLines,
      },
      tx
    );

    // 4. Post COGS Journal inside the same transaction:
    // Debit COGS (5010), Credit Finished Inventory (1230)
    await postJournalEntry(
      {
        date: new Date(),
        entryType: "SALES",
        description: `COGS recognized for order ${order.orderNumber}`,
        reference: `${order.orderNumber}-COGS`,
        sourceModule: "SALES",
        sourceId: order.id,
        userId: data.userId,
        lines: [
          {
            accountId: cogsAcc.id,
            debit: totalCogs,
            credit: 0,
            memo: `Cost of goods sold for ${order.orderNumber}`,
          },
          {
            accountId: finInvAcc.id,
            debit: 0,
            credit: totalCogs,
            memo: `Finished inventory consumed on delivery`,
          },
        ],
      },
      tx
    );

    return { success: true, order, totalCogs, totalReceivable };
  });
}

// Courier COD Settlement Remittance
export async function settleCourierRemittance(data: {
  courierId: string;
  paymentAccountId: string;
  settlements: {
    salesOrderId: string;
    codAmount: number;
    courierFee: number;
  }[];
  settlementNumber?: string;
  notes?: string;
  userId?: string;
}) {
  const [courier] = await db.select().from(contacts).where(eq(contacts.id, data.courierId)).limit(1);
  if (!courier) throw new Error("Courier contact not found.");

  const [payAcc] = await db
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.id, data.paymentAccountId))
    .limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  if (data.settlements.length === 0) throw new Error("Select at least one order to settle.");
  for (const s of data.settlements) {
    if (!(s.codAmount > 0)) throw new Error("COD amount must be greater than zero.");
    if (s.courierFee < 0 || s.courierFee > s.codAmount) {
      throw new Error("Courier fee must be between zero and the COD amount.");
    }
  }
  // Guard against double-settling (would clear courier receivables twice)
  const settleOrders = await db
    .select()
    .from(salesOrders)
    .where(inArray(salesOrders.id, data.settlements.map((s) => s.salesOrderId)));
  for (const so of settleOrders) {
    if (so.status !== "DELIVERED") {
      throw new Error(`Order ${so.orderNumber} is ${so.status}; only delivered orders can be settled.`);
    }
    if (so.paymentStatus === "PAID") {
      throw new Error(`Order ${so.orderNumber} is already settled.`);
    }
  }
  if (settleOrders.length !== new Set(data.settlements.map((s) => s.salesOrderId)).size) {
    throw new Error("One or more orders to settle were not found.");
  }

  const [courierRecAcc] = await db.select().from(accounts).where(eq(accounts.code, "1120")).limit(1); // Courier Receivables
  const [courierFeeAcc] = await db.select().from(accounts).where(eq(accounts.code, "6010")).limit(1); // Courier Delivery & COD Fees

  let totalCod = 0;
  let totalFees = 0;

  for (const s of data.settlements) {
    totalCod += s.codAmount;
    totalFees += s.courierFee;
  }
  const netRemittance = totalCod - totalFees;

  const setNumber = data.settlementNumber || `SET-${Date.now().toString().slice(-6)}`;

  return await db.transaction(async (tx) => {
    // 1. Post Courier Settlement Journal:
    // Debit Bank/bKash (Net Cash Remitted)
    // Debit Courier Delivery & COD Fees (Expense)
    // Credit Courier Receivables (Gross COD Cleared)
    const journal = await postJournalEntry(
      {
        date: new Date(),
        entryType: "SETTLEMENT",
        description: `Courier COD remittance from ${courier.name} (${setNumber})`,
        reference: setNumber,
        sourceModule: "COURIER",
        userId: data.userId,
        lines: [
          {
            accountId: payAcc.glAccountId,
            debit: netRemittance,
            credit: 0,
            memo: `Net remittance deposited to ${payAcc.name}`,
          },
          {
            accountId: courierFeeAcc.id,
            debit: totalFees,
            credit: 0,
            memo: `Courier delivery & COD fee deducted`,
          },
          {
            accountId: courierRecAcc.id,
            debit: 0,
            credit: totalCod,
            memo: `Settlement of courier receivables for ${data.settlements.length} orders`,
          },
        ],
      },
      tx
    );

    // 2. Insert Settlement Record
    const [settlement] = await tx
      .insert(courierSettlements)
      .values({
        settlementNumber: setNumber,
        courierId: data.courierId,
        totalCodCollected: totalCod.toFixed(2),
        courierFeesDeducted: totalFees.toFixed(2),
        netAmountReceived: netRemittance.toFixed(2),
        paymentAccountId: data.paymentAccountId,
        journalEntryId: journal.id,
        notes: data.notes,
        verifiedByUserId: data.userId,
      })
      .returning();

    // 3. Insert Settlement Lines and mark orders PAID
    for (const s of data.settlements) {
      await tx.insert(courierSettlementLines).values({
        courierSettlementId: settlement.id,
        salesOrderId: s.salesOrderId,
        codAmount: s.codAmount.toFixed(2),
        courierFee: s.courierFee.toFixed(2),
        netAmount: (s.codAmount - s.courierFee).toFixed(2),
      });

      await tx
        .update(salesOrders)
        .set({ paymentStatus: "PAID" })
        .where(eq(salesOrders.id, s.salesOrderId));
    }

    return settlement;
  });
}

// Sales Return and Stock Disposition (Restock vs Defective)
export async function processSalesReturn(data: {
  salesOrderId: string;
  reason: string;
  isRestockable: boolean;
  refundAmount: number;
  paymentAccountId?: string;
  userId?: string;
  notes?: string;
}) {
  const [order] = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, data.salesOrderId))
    .limit(1);
  if (!order) throw new Error("Order not found.");
  if (order.status === "RETURNED") throw new Error(`Order ${order.orderNumber} was already returned.`);
  if (order.status !== "DELIVERED") {
    throw new Error(
      `Order ${order.orderNumber} is ${order.status}. Only delivered orders can be returned — cancel it instead if it has not been delivered.`
    );
  }
  if (!data.reason?.trim()) throw new Error("A return reason is required.");
  if (!(data.refundAmount >= 0) || data.refundAmount > Number(order.totalAmount)) {
    throw new Error(`Refund must be between ৳0 and the order total (৳${order.totalAmount}).`);
  }

  const lines = await db.select().from(salesLines).where(eq(salesLines.salesOrderId, order.id));

  const [returnRevAcc] = await db.select().from(accounts).where(eq(accounts.code, "4020")).limit(1); // Sales Returns
  const [cogsAcc] = await db.select().from(accounts).where(eq(accounts.code, "5010")).limit(1); // COGS
  const [finInvAcc] = await db.select().from(accounts).where(eq(accounts.code, "1230")).limit(1); // Finished Goods
  const [defectAcc] = await db.select().from(accounts).where(eq(accounts.code, "5020")).limit(1); // Wastage & Rejects

  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);
  const [damagedLoc] = await db.select().from(locations).where(eq(locations.code, "DAMAGED")).limit(1);

  let creditAccountId: string;
  if (data.paymentAccountId) {
    const [payAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.id, data.paymentAccountId))
      .limit(1);
    creditAccountId = payAcc.glAccountId;
  } else {
    // If not refunded from cash/bank, credit Customer Receivables
    const [recAcc] = await db.select().from(accounts).where(eq(accounts.code, "1110")).limit(1);
    creditAccountId = recAcc.id;
  }

  let totalCogsToReverse = 0;
  for (const line of lines) {
    totalCogsToReverse += line.quantity * Number(line.cogsUnitCost);
  }

  const returnNumber = `RMA-${Date.now().toString().slice(-6)}`;

  return await db.transaction(async (tx) => {
    // 1. Mark order RETURNED
    await tx
      .update(salesOrders)
      .set({ status: "RETURNED" })
      .where(eq(salesOrders.id, order.id));

    // 2. Post Revenue Reversal inside the same transaction:
    // Debit Sales Returns (Contra-Revenue), Credit Bank/Customer Receivables
    const journal = await postJournalEntry(
      {
        date: new Date(),
        entryType: "SALES",
        description: `Sales return refund for ${order.orderNumber} (${returnNumber})`,
        reference: returnNumber,
        sourceModule: "RETURNS",
        sourceId: order.id,
        userId: data.userId,
        lines: [
          {
            accountId: returnRevAcc.id,
            debit: data.refundAmount,
            credit: 0,
            memo: `Sales return contra-revenue for ${order.orderNumber}`,
          },
          {
            accountId: creditAccountId,
            debit: 0,
            credit: data.refundAmount,
            memo: `Refund payout`,
          },
        ],
      },
      tx
    );

    // 3. Post Inventory / COGS Reversal inside the same transaction:
    // If Restockable: Debit Finished Goods Inventory, Credit COGS
    // If Defective: Debit Production Wastage & Rejects, Credit COGS
    const inventoryDebitAccountId = data.isRestockable ? finInvAcc.id : defectAcc.id;
    const targetLocationId = data.isRestockable ? mainWh.id : damagedLoc.id;
    const movementType = data.isRestockable ? "RETURN_RESTOCK" : "RETURN_DEFECT";

    await postJournalEntry(
      {
        date: new Date(),
        entryType: "SALES",
        description: `Inventory return disposition (${data.isRestockable ? "Restocked" : "Defective"}) for ${order.orderNumber}`,
        reference: `${returnNumber}-INV`,
        sourceModule: "RETURNS",
        sourceId: order.id,
        userId: data.userId,
        lines: [
          {
            accountId: inventoryDebitAccountId,
            debit: totalCogsToReverse,
            credit: 0,
            memo: data.isRestockable ? `Garment returned to finished stock` : `Garment written off as defective`,
          },
          {
            accountId: cogsAcc.id,
            debit: 0,
            credit: totalCogsToReverse,
            memo: `COGS reversal upon customer return`,
          },
        ],
      },
      tx
    );

    // 4. Record stock movement and restore lot if restockable
    for (const line of lines) {
      if (data.isRestockable && line.lotId) {
        const [lot] = await tx
          .select()
          .from(inventoryLots)
          .where(eq(inventoryLots.id, line.lotId))
          .for("update");

        if (lot) {
          await tx
            .update(inventoryLots)
            .set({
              currentQuantity: lot.currentQuantity + line.quantity,
              status: "ACTIVE",
            })
            .where(eq(inventoryLots.id, lot.id));
        }
      }

      await tx.insert(stockMovements).values({
        variantId: line.variantId,
        lotId: line.lotId,
        toLocationId: targetLocationId,
        movementType,
        quantity: line.quantity,
        unitCost: line.cogsUnitCost,
        referenceType: "RETURN",
        referenceId: returnNumber,
        performedByUserId: data.userId,
        notes: `Returned item: ${data.isRestockable ? "Restocked to Main WH" : "Moved to Damaged Bin"}`,
      });
    }

    // 5. Insert Return Record
    const [rma] = await tx
      .insert(returnsAndExchanges)
      .values({
        returnNumber,
        salesOrderId: order.id,
        reason: data.reason,
        status: "REFUNDED",
        inspectionResult: data.isRestockable ? "RESTOCKABLE" : "DEFECTIVE",
        refundAmount: data.refundAmount.toFixed(2),
        paymentAccountId: data.paymentAccountId,
        journalEntryId: journal.id,
        processedByUserId: data.userId,
        notes: data.notes,
      })
      .returning();

    return rma;
  });
}

export async function processReturnOrExchange(data: {
  orderId?: string;
  salesOrderId?: string;
  reason: string;
  isRestockable: boolean;
  refundAmount: number;
  paymentAccountId?: string;
  userId?: string;
  notes?: string;
}) {
  return processSalesReturn({
    salesOrderId: data.orderId || data.salesOrderId!,
    reason: data.reason,
    isRestockable: data.isRestockable,
    refundAmount: data.refundAmount,
    paymentAccountId: data.paymentAccountId,
    userId: data.userId,
    notes: data.notes,
  });
}

// Cancel an order that has not been delivered: releases the stock reservation.
// - CONFIRMED / PACKED: stock never left the warehouse -> just release reservation.
// - SHIPPED: goods are with the courier (no revenue booked yet) -> bring stock
//   back from TRANSIT to MAIN_WH and release reservation.
// Delivered orders must go through the return flow (revenue was recognised).
export async function cancelSalesOrder(data: {
  orderId: string;
  reason: string;
  userId?: string;
}) {
  const reason = data.reason?.trim();
  if (!reason) throw new Error("A cancellation reason is required.");

  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, data.orderId)).limit(1);
  if (!order) throw new Error("Order not found.");
  if (order.status === "CANCELLED") throw new Error(`Order ${order.orderNumber} is already cancelled.`);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new Error(
      order.status === "DELIVERED"
        ? `Order ${order.orderNumber} is already delivered — use "Return" to reverse the sale.`
        : `Order ${order.orderNumber} is ${order.status} and cannot be cancelled.`
    );
  }

  const [transitLoc] = await db.select().from(locations).where(eq(locations.code, "TRANSIT")).limit(1);
  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);

  const cancelled = await db.transaction(async (tx) => {
    const lines = await tx.select().from(salesLines).where(eq(salesLines.salesOrderId, order.id));

    for (const line of lines) {
      if (line.lotId) {
        const [lot] = await tx
          .select()
          .from(inventoryLots)
          .where(eq(inventoryLots.id, line.lotId))
          .for("update");
        if (lot) {
          await tx
            .update(inventoryLots)
            .set({ reservedQuantity: Math.max(0, lot.reservedQuantity - line.quantity) })
            .where(eq(inventoryLots.id, lot.id));
        }
      }

      if (order.status === "SHIPPED" && transitLoc && mainWh) {
        await tx.insert(stockMovements).values({
          variantId: line.variantId,
          lotId: line.lotId,
          fromLocationId: transitLoc.id,
          toLocationId: mainWh.id,
          movementType: "TRANSFER",
          quantity: line.quantity,
          unitCost: line.cogsUnitCost,
          referenceType: "ORDER",
          referenceId: order.orderNumber,
          performedByUserId: data.userId,
          notes: `Order cancelled while with courier — stock returned to Main WH (${reason})`,
        });
      }
    }

    const cancelNote = `CANCELLED: ${reason}`;
    await tx
      .update(salesOrders)
      .set({
        status: "CANCELLED",
        paymentStatus: "VOID",
        notes: order.notes ? `${order.notes}\n${cancelNote}` : cancelNote,
      })
      .where(eq(salesOrders.id, order.id));

    await tx.insert(auditLogs).values({
      userId: data.userId,
      action: "UPDATE",
      entityType: "ORDER",
      entityId: order.id,
      details: `Order ${order.orderNumber} cancelled from ${order.status}: ${reason}`,
      oldValues: { status: order.status },
      newValues: { status: "CANCELLED" },
    });

    return { success: true, orderNumber: order.orderNumber, releasedUnits: lines.reduce((s, l) => s + l.quantity, 0) };
  });
  schedulePortalSync("order-cancelled");
  return cancelled;
}

// Sellable catalogue for the quick-sale picker: price, cost and AVAILABLE stock
// (on hand minus reserved across active lots).
export async function listSellableVariants() {
  const rows = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      sellingPrice: productVariants.sellingPrice,
      costPrice: productVariants.costPrice,
      retailPrice: products.retailPrice,
      available: sql<number>`COALESCE(SUM(${inventoryLots.currentQuantity} - ${inventoryLots.reservedQuantity}) FILTER (WHERE ${inventoryLots.status} = 'ACTIVE'), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(inventoryLots, eq(inventoryLots.variantId, productVariants.id))
    .where(
      and(eq(products.status, "ACTIVE"), inArray(products.productType, ["FINISHED_GARMENT", "BLANK"]))
    )
    .groupBy(productVariants.id, products.name, products.retailPrice)
    .orderBy(products.name, productVariants.sku);

  return rows.map((r) => {
    const selling = Number(r.sellingPrice);
    return {
      id: r.id,
      sku: r.sku,
      productName: r.productName,
      size: r.size,
      color: r.color,
      price: selling > 0 ? selling : Number(r.retailPrice),
      cost: Number(r.costPrice),
      available: Math.max(0, Number(r.available)),
    };
  });
}

// Recent orders with their line items and gross profit, for the orders workspace.
export async function listRecentOrdersWithItems(limit = 100) {
  const orders = await db.select().from(salesOrders).orderBy(desc(salesOrders.orderDate)).limit(limit);
  if (orders.length === 0) return [];

  const lines = await db
    .select({
      salesOrderId: salesLines.salesOrderId,
      quantity: salesLines.quantity,
      unitPrice: salesLines.unitPrice,
      totalPrice: salesLines.totalPrice,
      cogsUnitCost: salesLines.cogsUnitCost,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
    })
    .from(salesLines)
    .innerJoin(productVariants, eq(salesLines.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(salesLines.salesOrderId, orders.map((o) => o.id)));

  const couriers = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.type, "COURIER"));
  const courierName = new Map(couriers.map((c) => [c.id, c.name]));

  return orders.map((o) => {
    const items = lines
      .filter((l) => l.salesOrderId === o.id)
      .map((l) => ({
        sku: l.sku,
        name: l.productName,
        size: l.size,
        color: l.color,
        quantity: l.quantity,
        unitPrice: Number(l.unitPrice),
        total: Number(l.totalPrice),
        cogs: l.quantity * Number(l.cogsUnitCost),
      }));
    const cogs = items.reduce((s, i) => s + i.cogs, 0);
    const total = Number(o.totalAmount);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      cityZone: o.cityZone,
      channel: o.channel,
      orderDate: o.orderDate.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      deliveryCharge: Number(o.deliveryCharge),
      total,
      courierId: o.courierId,
      courierName: o.courierId ? courierName.get(o.courierId) ?? null : null,
      waybillNumber: o.waybillNumber,
      items,
      units: items.reduce((s, i) => s + i.quantity, 0),
      // Gross profit = goods revenue (after discount) - cost; delivery charge excluded
      profit: total - Number(o.deliveryCharge) - cogs,
    };
  });
}
