import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryLots, productVariants, products, salesOrders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getFinancialStatements } from "@/server/services/finance";

function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(formatCsvCell).join(",");
}

// ==========================================
// 1. Financial Statements CSV Export
// ==========================================

export async function handleExportFinancialStatementsGet(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "trial-balance";
    const statements = await getFinancialStatements();
    const dateStr = new Date().toISOString().split("T")[0];

    let csvContent = "";
    let filename = `afk-financial-report-${dateStr}.csv`;

    if (type === "trial-balance") {
      filename = `afk-trial-balance-${dateStr}.csv`;
      const rows: string[] = [];
      rows.push(toCsvRow(["AFK THEORY - TRIAL BALANCE", `As of ${dateStr}`, "Currency: BDT"]));
      rows.push("");
      rows.push(toCsvRow(["Account Code", "Account Name", "Classification Group", "Debit (BDT)", "Credit (BDT)"]));

      for (const acc of statements.trialBalance.accounts) {
        if (acc.debit > 0 || acc.credit > 0) {
          rows.push(toCsvRow([acc.code, acc.name, acc.group, acc.debit.toFixed(2), acc.credit.toFixed(2)]));
        }
      }

      rows.push("");
      rows.push(toCsvRow(["TOTALS", "", "", statements.trialBalance.totalDebit.toFixed(2), statements.trialBalance.totalCredit.toFixed(2)]));
      rows.push(toCsvRow(["STATUS", statements.trialBalance.isBalanced ? "BALANCED" : "OUT OF BALANCE", "", "", ""]));
      csvContent = rows.join("\r\n");
    } else if (type === "income-statement") {
      filename = `afk-income-statement-${dateStr}.csv`;
      const rows: string[] = [];
      rows.push(toCsvRow(["AFK THEORY - INCOME STATEMENT (PROFIT & LOSS)", `As of ${dateStr}`, "Currency: BDT"]));
      rows.push("");
      rows.push(toCsvRow(["Category / Account", "Details", "Amount (BDT)"]));
      rows.push(toCsvRow(["REVENUE", "Gross Sales Revenue", statements.incomeStatement.totalGrossRevenue.toFixed(2)]));
      if (statements.incomeStatement.totalReturns > 0) {
        rows.push(toCsvRow(["CONTRA REVENUE", "Less: Sales Returns & Allowances", (-statements.incomeStatement.totalReturns).toFixed(2)]));
      }
      rows.push(toCsvRow(["NET REVENUE", "", statements.incomeStatement.netRevenue.toFixed(2)]));
      rows.push("");
      rows.push(toCsvRow(["COST OF GOODS SOLD (COGS)", "", ""]));
      for (const cogs of statements.incomeStatement.cogsAccounts) {
        rows.push(toCsvRow(["", `${cogs.code} - ${cogs.name}`, cogs.balance.toFixed(2)]));
      }
      rows.push(toCsvRow(["TOTAL COGS", "", statements.incomeStatement.totalCogs.toFixed(2)]));
      rows.push(toCsvRow(["GROSS PROFIT", "", statements.incomeStatement.grossProfit.toFixed(2)]));
      rows.push("");
      rows.push(toCsvRow(["OPERATING EXPENSES", "", ""]));
      for (const exp of statements.incomeStatement.expenseAccounts) {
        rows.push(toCsvRow(["", `${exp.code} - ${exp.name}`, exp.balance.toFixed(2)]));
      }
      rows.push(toCsvRow(["TOTAL OPERATING EXPENSES", "", statements.incomeStatement.totalOperatingExpenses.toFixed(2)]));
      rows.push(toCsvRow(["NET PROFIT / (LOSS)", "", statements.incomeStatement.netProfit.toFixed(2)]));
      csvContent = rows.join("\r\n");
    } else if (type === "balance-sheet") {
      filename = `afk-balance-sheet-${dateStr}.csv`;
      const rows: string[] = [];
      rows.push(toCsvRow(["AFK THEORY - BALANCE SHEET (FINANCIAL POSITION)", `As of ${dateStr}`, "Currency: BDT"]));
      rows.push("");
      rows.push(toCsvRow(["Classification", "Account Code & Name", "Balance (BDT)"]));
      rows.push(toCsvRow(["ASSETS", "", ""]));
      for (const a of statements.balanceSheet.assetAccounts) {
        rows.push(toCsvRow(["Asset", `${a.code} - ${a.name}`, a.balance.toFixed(2)]));
      }
      rows.push(toCsvRow(["TOTAL ASSETS", "", statements.balanceSheet.totalAssets.toFixed(2)]));
      rows.push("");
      rows.push(toCsvRow(["LIABILITIES", "", ""]));
      for (const l of statements.balanceSheet.liabilityAccounts) {
        rows.push(toCsvRow(["Liability", `${l.code} - ${l.name}`, l.balance.toFixed(2)]));
      }
      rows.push(toCsvRow(["TOTAL LIABILITIES", "", statements.balanceSheet.totalLiabilities.toFixed(2)]));
      rows.push("");
      rows.push(toCsvRow(["PARTNER EQUITY", "", ""]));
      for (const eq of statements.balanceSheet.capitalAccounts) {
        rows.push(toCsvRow(["Capital", eq.name, eq.balance.toFixed(2)]));
      }
      rows.push(toCsvRow(["Retained Earnings", "Current Period Net Earnings", statements.balanceSheet.netProfitRetained.toFixed(2)]));
      rows.push(toCsvRow(["TOTAL EQUITY", "", statements.balanceSheet.totalEquity.toFixed(2)]));
      rows.push(toCsvRow(["TOTAL LIABILITIES & EQUITY", "", (statements.balanceSheet.totalLiabilities + statements.balanceSheet.totalEquity).toFixed(2)]));
      rows.push(toCsvRow(["BALANCE STATUS", statements.balanceSheet.isBalanced ? "BALANCED" : "OUT OF BALANCE", ""]));
      csvContent = rows.join("\r\n");
    } else if (type === "partner-statements") {
      filename = `afk-partner-statements-${dateStr}.csv`;
      const rows: string[] = [];
      rows.push(toCsvRow(["AFK THEORY - PARTNER CAPITAL & EQUITY STATEMENTS", `As of ${dateStr}`, "Currency: BDT"]));
      rows.push("");
      rows.push(toCsvRow(["Partner Name", "Ownership Share (%)", "Capital Account (BDT)", "Loan/Payable (BDT)", "Est. Profit Share (BDT)", "Total Equity Exposure (BDT)"]));

      for (const p of statements.partnerStatements) {
        rows.push(
          toCsvRow([
            p.name,
            p.ownershipPct.toFixed(2) + "%",
            p.capitalContributed.toFixed(2),
            p.loanBalanceOwedByCompany.toFixed(2),
            p.shareOfProfit.toFixed(2),
            p.totalEquity.toFixed(2),
          ])
        );
      }
      csvContent = rows.join("\r\n");
    } else {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    // Prepend UTF-8 BOM so Excel opens non-ASCII characters and currencies reliably
    const bom = "\uFEFF";
    const fullPayload = bom + csvContent;

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

// ==========================================
// 2. Inventory Lots Valuation CSV Export
// ==========================================

export async function handleExportInventoryGet(req: NextRequest) {
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

// ==========================================
// 3. Sales Orders CSV Export
// ==========================================

export async function handleExportOrdersGet(req: NextRequest) {
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
