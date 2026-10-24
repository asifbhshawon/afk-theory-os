import { getFinancialStatements } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Financial Reports & Statements | AFK THEORY Business OS",
  description: "Real-time balance sheet, income statement, trial balance, and partner capital accounts",
};

export default async function ReportsPage() {
  const statements = await getFinancialStatements();

  return (
    <div className="space-y-8 select-none">
      {/* Header & CSV Export Triggers */}
      <div className="pb-3 border-b border-afk-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            Financial Reports & Authoritative Statements
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            Real-time balance sheet, income statement, trial balance, and partner capital accounts computed from posted journals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/financial-statements?type=trial-balance"
            className="px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>📥 Trial Balance (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=income-statement"
            className="px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>📥 P&L (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=balance-sheet"
            className="px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>📥 Balance Sheet (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=partner-statements"
            className="px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>📥 Partners (CSV)</span>
          </a>
          <a
            href="/api/export/inventory"
            className="px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>📥 Stock Valuation (CSV)</span>
          </a>
        </div>
      </div>

      {/* 1. Income Statement (P&L) */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-afk-border pb-3">
          <div>
            <h2 className="text-base font-bold text-afk-offwhite">
              Income Statement (Profit & Loss)
            </h2>
            <p className="text-xs text-afk-muted">Cumulative period as of today (Asia/Dhaka)</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-afk-surface border border-afk-border text-afk-secondary">
            Currency: BDT (৳)
          </span>
        </div>

        <div className="space-y-4 text-sm">
          {/* Revenue */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite pb-1.5 border-b border-afk-border/50">
              <span>Gross Sales Revenue</span>
              <span className="tabular-nums">
                ৳{statements.incomeStatement.totalGrossRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {statements.incomeStatement.totalReturns > 0 && (
              <div className="flex justify-between text-afk-danger py-1 pl-4 text-xs font-medium">
                <span>Less: Sales Returns & Allowances</span>
                <span className="tabular-nums">
                  (৳{statements.incomeStatement.totalReturns.toLocaleString("en-BD", { minimumFractionDigits: 2 })})
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-afk-offwhite py-1.5 pl-4 border-t border-afk-border/30">
              <span>Net Sales Revenue</span>
              <span className="tabular-nums">
                ৳{statements.incomeStatement.netRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* COGS */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite pb-1.5 border-b border-afk-border/50">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="text-afk-danger tabular-nums">
                (৳{statements.incomeStatement.totalCogs.toLocaleString("en-BD", { minimumFractionDigits: 2 })})
              </span>
            </div>
            {statements.incomeStatement.cogsAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-secondary py-1 pl-4 text-xs">
                <span>{a.name}</span>
                <span className="tabular-nums font-medium text-afk-offwhite">
                  ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          {/* Gross Profit */}
          <div className="flex justify-between font-bold text-sm py-2.5 px-4 bg-afk-surface rounded-lg border border-afk-border">
            <span>GROSS PROFIT</span>
            <span className={`tabular-nums ${statements.incomeStatement.grossProfit >= 0 ? "text-afk-success" : "text-afk-danger"}`}>
              ৳{statements.incomeStatement.grossProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Operating Expenses */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite pb-1.5 border-b border-afk-border/50">
              <span>Operating Expenses</span>
              <span className="tabular-nums">
                (৳{statements.incomeStatement.totalOperatingExpenses.toLocaleString("en-BD", { minimumFractionDigits: 2 })})
              </span>
            </div>
            {statements.incomeStatement.expenseAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-secondary py-1 pl-4 text-xs">
                <span>{a.code} - {a.name}</span>
                <span className="tabular-nums font-medium text-afk-offwhite">
                  ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          {/* Net Profit */}
          <div className="flex justify-between font-bold text-base py-3 px-4 bg-afk-olive/20 border border-afk-olive rounded-xl text-afk-offwhite shadow-sm">
            <span>NET PROFIT / (LOSS)</span>
            <span className={`tabular-nums text-lg ${statements.incomeStatement.netProfit >= 0 ? "text-afk-success" : "text-afk-danger"}`}>
              ৳{statements.incomeStatement.netProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Balance Sheet */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-afk-border pb-3">
          <div>
            <h2 className="text-base font-bold text-afk-offwhite">
              Balance Sheet (Financial Position)
            </h2>
            <p className="text-xs text-afk-muted">Assets = Liabilities + Partner Equity</p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-md font-semibold ${
              statements.balanceSheet.isBalanced
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {statements.balanceSheet.isBalanced ? "✔ Balance Sheet Balanced" : "✖ Out of Balance"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          {/* Left: Assets */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-afk-muted border-b border-afk-border pb-1">
              ASSETS
            </h3>
            {statements.balanceSheet.assetAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-secondary py-1 text-xs">
                <span>{a.code} - {a.name}</span>
                <span className="text-afk-offwhite font-medium tabular-nums">
                  ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm text-afk-offwhite pt-3 border-t border-afk-border">
              <span>TOTAL ASSETS</span>
              <span className="tabular-nums">
                ৳{statements.balanceSheet.totalAssets.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Right: Liabilities & Equity */}
          <div className="space-y-4">
            {/* Liabilities */}
            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-afk-muted border-b border-afk-border pb-1">
                LIABILITIES
              </h3>
              {statements.balanceSheet.liabilityAccounts.map((a) => (
                <div key={a.id} className="flex justify-between text-afk-secondary py-1 text-xs">
                  <span>{a.code} - {a.name}</span>
                  <span className="text-afk-offwhite font-medium tabular-nums">
                    ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-afk-offwhite pt-1 text-xs">
                <span>Total Liabilities</span>
                <span className="tabular-nums">
                  ৳{statements.balanceSheet.totalLiabilities.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Partner Equity */}
            <div className="space-y-2 pt-2 border-t border-afk-border">
              <h3 className="font-bold text-xs uppercase tracking-wider text-afk-muted border-b border-afk-border pb-1">
                PARTNER CAPITAL & RETAINED EARNINGS
              </h3>
              {statements.balanceSheet.capitalAccounts.map((a) => (
                <div key={a.id} className="flex justify-between text-afk-secondary py-1 text-xs">
                  <span>{a.code} - {a.name}</span>
                  <span className="text-afk-offwhite font-medium tabular-nums">
                    ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {statements.balanceSheet.drawingsAccounts.map((a) => (
                <div key={a.id} className="flex justify-between text-afk-danger py-1 text-xs">
                  <span>Less: {a.code} - {a.name}</span>
                  <span className="font-medium tabular-nums">
                    (৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })})
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-afk-secondary py-1 text-xs">
                <span>Retained Current Net Profit</span>
                <span className={`font-medium tabular-nums ${statements.balanceSheet.netProfitRetained >= 0 ? "text-afk-success" : "text-afk-danger"}`}>
                  ৳{statements.balanceSheet.netProfitRetained.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-afk-offwhite pt-1 text-xs">
                <span>Total Equity</span>
                <span className="tabular-nums">
                  ৳{statements.balanceSheet.totalEquity.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-sm text-afk-offwhite pt-3 border-t border-afk-border">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span className="tabular-nums">
                ৳{(statements.balanceSheet.totalLiabilities + statements.balanceSheet.totalEquity).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
