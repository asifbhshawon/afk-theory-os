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
import { eq, and, sql } from "drizzle-orm";
import { postJournalEntry } from "./finance";

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

// Generate unique sequential order number
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(salesOrders);

  const seq = (Number(result?.count || 0) + 1).toString().padStart(5, "0");
  const rand = Math.floor(Math.random() * 90 + 10);
  return `AFK-ORD-${year}-${seq}${rand}`;
}

// Create sales order with atomic stock reservation (concurrency safe)
export async function createSalesOrder(input: CreateSalesOrderInput) {
  if (!input.lines || input.lines.length === 0) {
    throw new Error("Order must contain at least one line item.");
  }

  // Idempotency check
  if (input.idempotencyKey) {
    const [existingOrder] = await db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.notes, `IDEMPOTENCY:${input.idempotencyKey}`))
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

  return await db.transaction(async (tx) => {
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
        throw new Error(
          `Out of stock for SKU. Requested: ${line.quantity}, unavailable: ${remainingToReserve}`
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
        notes: input.idempotencyKey ? `IDEMPOTENCY:${input.idempotencyKey}` : input.notes,
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

  const [transitLoc] = await db.select().from(locations).where(eq(locations.code, "TRANSIT")).limit(1);
  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);

  return await db.transaction(async (tx) => {
    await tx
      .update(salesOrders)
      .set({
        status: "SHIPPED",
        courierId: data.courierId,
        waybillNumber: data.waybillNumber,
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

    await postJournalEntry({
      date: new Date(),
      entryType: "SALES",
      description: `Sales revenue recognized for ${order.orderNumber} (${order.customerName})`,
      reference: `${order.orderNumber}-REV`,
      sourceModule: "SALES",
      sourceId: order.id,
      userId: data.userId,
      lines: revenueLines,
    });

    // 4. Post COGS Journal:
    // Debit COGS (5010), Credit Finished Inventory (1230)
    await postJournalEntry({
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
    });

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
    const journal = await postJournalEntry({
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
    });

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

    // 2. Post Revenue Reversal:
    // Debit Sales Returns (Contra-Revenue), Credit Bank/Customer Receivables
    const journal = await postJournalEntry({
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
    });

    // 3. Post Inventory / COGS Reversal:
    // If Restockable: Debit Finished Goods Inventory, Credit COGS
    // If Defective: Debit Production Wastage & Rejects, Credit COGS
    const inventoryDebitAccountId = data.isRestockable ? finInvAcc.id : defectAcc.id;
    const targetLocationId = data.isRestockable ? mainWh.id : damagedLoc.id;
    const movementType = data.isRestockable ? "RETURN_RESTOCK" : "RETURN_DEFECT";

    await postJournalEntry({
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
    });

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
