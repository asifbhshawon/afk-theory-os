import { getFinancialStatements } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const statements = await getFinancialStatements();

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-afk-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Financial Reports & Statements</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Real-time balance sheet, income statement, trial balance, and partner capital accounts computed from posted journals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/financial-statements?type=trial-balance"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 Trial Balance (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=income-statement"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 P&L (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=balance-sheet"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 Balance Sheet (CSV)</span>
          </a>
          <a
            href="/api/export/financial-statements?type=partner-statements"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 Partners (CSV)</span>
          </a>
          <a
            href="/api/export/inventory"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 Stock (CSV)</span>
          </a>
        </div>
      </div>

      {/* 1. Income Statement (P&L) */}
      <div className="bg-afk-charcoal p-6 rounded-lg border border-afk-border">
        <div className="flex items-center justify-between border-b border-afk-border pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-afk-offwhite">Income Statement (Profit & Loss)</h3>
            <p className="text-xs text-afk-muted">Period as of today (Asia/Dhaka)</p>
          </div>
          <span className="font-mono text-xs px-2 py-1 rounded bg-afk-surface border border-afk-border text-afk-muted">
            Currency: BDT (৳)
          </span>
        </div>

        <div className="space-y-4 text-xs font-mono">
          {/* Revenue */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite text-sm pb-1 border-b border-afk-border/40">
              <span>Gross Sales Revenue</span>
              <span>৳{statements.incomeStatement.totalGrossRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
            </div>
            {statements.incomeStatement.totalReturns > 0 && (
              <div className="flex justify-between text-afk-danger py-1 pl-4">
                <span>Less: Sales Returns & Allowances</span>
                <span>(৳{statements.incomeStatement.totalReturns.toLocaleString("en-BD", { minimumFractionDigits: 2 })})</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-afk-offwhite py-1 pl-4 border-t border-afk-border/30">
              <span>Net Sales Revenue</span>
              <span>৳{statements.incomeStatement.netRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* COGS */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite text-sm pb-1 border-b border-afk-border/40">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="text-afk-danger">
                (৳{statements.incomeStatement.totalCogs.toLocaleString("en-BD", { minimumFractionDigits: 2 })})
              </span>
            </div>
            {statements.incomeStatement.cogsAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-muted py-1 pl-4">
                <span>{a.name}</span>
                <span>৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          {/* Gross Profit */}
          <div className="flex justify-between font-bold text-afk-offwhite text-sm py-2 px-3 bg-afk-surface rounded border border-afk-border">
            <span>GROSS PROFIT</span>
            <span className={statements.incomeStatement.grossProfit >= 0 ? "text-afk-success" : "text-afk-danger"}>
              ৳{statements.incomeStatement.grossProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Operating Expenses */}
          <div>
            <div className="flex justify-between font-bold text-afk-offwhite text-sm pb-1 border-b border-afk-border/40">
              <span>Operating Expenses</span>
              <span>(৳{statements.incomeStatement.totalOperatingExpenses.toLocaleString("en-BD", { minimumFractionDigits: 2 })})</span>
            </div>
            {statements.incomeStatement.expenseAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-muted py-1 pl-4">
                <span>{a.code} - {a.name}</span>
                <span>৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          {/* Net Profit */}
          <div className="flex justify-between font-bold text-base py-3 px-4 bg-afk-olive-dark border border-afk-olive rounded text-afk-offwhite">
            <span>NET PROFIT / (LOSS)</span>
            <span className={statements.incomeStatement.netProfit >= 0 ? "text-afk-success" : "text-afk-danger"}>
              ৳{statements.incomeStatement.netProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Balance Sheet */}
      <div className="bg-afk-charcoal p-6 rounded-lg border border-afk-border">
        <div className="flex items-center justify-between border-b border-afk-border pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-afk-offwhite">Balance Sheet (Financial Position)</h3>
            <p className="text-xs text-afk-muted">Assets = Liabilities + Partner Equity</p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-mono ${
              statements.balanceSheet.isBalanced
                ? "bg-afk-olive-dark text-afk-olive-accent border border-afk-olive"
                : "bg-afk-danger/20 text-afk-danger"
            }`}
          >
            {statements.balanceSheet.isBalanced ? "✔ Balance Sheet Balanced" : "✖ Out of Balance"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-mono">
          {/* Left: Assets */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-afk-offwhite border-b border-afk-border pb-1">ASSETS</h4>
            {statements.balanceSheet.assetAccounts.map((a) => (
              <div key={a.id} className="flex justify-between text-afk-muted py-0.5">
                <span>{a.code} - {a.name}</span>
                <span className="text-afk-offwhite font-medium">৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm text-afk-offwhite pt-3 border-t border-afk-border">
              <span>TOTAL ASSETS</span>
              <span>৳{statements.balanceSheet.totalAssets.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Right: Liabilities & Equity */}
          <div className="space-y-4">
            {/* Liabilities */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-afk-offwhite border-b border-afk-border pb-1">LIABILITIES</h4>
              {statements.balanceSheet.liabilityAccounts.map((a) => (
                <div key={a.id} className="flex justify-between text-afk-muted py-0.5">
                  <span>{a.code} - {a.name}</span>
                  <span className="text-afk-offwhite font-medium">৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-afk-offwhite pt-1">
                <span>Total Liabilities</span>
                <span>৳{statements.balanceSheet.totalLiabilities.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Equity */}
            <div className="space-y-2 pt-2 border-t border-afk-border/40">
              <h4 className="font-bold text-sm text-afk-offwhite border-b border-afk-border pb-1">PARTNER EQUITY</h4>
              {statements.balanceSheet.capitalAccounts.map((a) => (
                <div key={a.id} className="flex justify-between text-afk-muted py-0.5">
                  <span>{a.name}</span>
                  <span className="text-afk-offwhite">৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-afk-muted py-0.5">
                <span>Net Earnings Retained</span>
                <span className={statements.balanceSheet.netProfitRetained >= 0 ? "text-afk-success" : "text-afk-danger"}>
                  ৳{statements.balanceSheet.netProfitRetained.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-afk-offwhite pt-1">
                <span>Total Equity</span>
                <span>৳{statements.balanceSheet.totalEquity.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Total Liabilities + Equity */}
            <div className="flex justify-between font-bold text-sm text-afk-offwhite pt-3 border-t border-afk-border">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span>
                ৳{(statements.balanceSheet.totalLiabilities + statements.balanceSheet.totalEquity).toLocaleString("en-BD", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Trial Balance */}
      <div className="bg-afk-charcoal p-6 rounded-lg border border-afk-border">
        <div className="flex items-center justify-between border-b border-afk-border pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-afk-offwhite">Trial Balance Verification</h3>
            <p className="text-xs text-afk-muted">Sum of all posted ledger debits vs credits</p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-mono ${
              statements.trialBalance.isBalanced
                ? "bg-afk-olive-dark text-afk-olive-accent border border-afk-olive"
                : "bg-afk-danger/20 text-afk-danger"
            }`}
          >
            {statements.trialBalance.isBalanced ? "✔ Ledger Balanced" : "✖ Imbalance"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2">Code</th>
                <th className="py-2">Account Name</th>
                <th className="py-2">Group</th>
                <th className="py-2 text-right">Debit (৳)</th>
                <th className="py-2 text-right">Credit (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {statements.trialBalance.accounts
                .filter((a) => a.debit > 0 || a.credit > 0)
                .map((a) => (
                  <tr key={a.id} className="hover:bg-afk-surface/30">
                    <td className="py-1.5 font-bold text-afk-offwhite">{a.code}</td>
                    <td className="py-1.5 text-afk-offwhite">{a.name}</td>
                    <td className="py-1.5 text-afk-muted">{a.group}</td>
                    <td className="py-1.5 text-right text-afk-offwhite">
                      {a.debit > 0 ? a.debit.toLocaleString("en-BD", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-1.5 text-right text-afk-offwhite">
                      {a.credit > 0 ? a.credit.toLocaleString("en-BD", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                ))}
              <tr className="font-bold border-t-2 border-afk-border text-sm">
                <td colSpan={3} className="py-2.5 text-afk-offwhite">TOTALS</td>
                <td className="py-2.5 text-right text-afk-offwhite">
                  ৳{statements.trialBalance.totalDebit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right text-afk-offwhite">
                  ৳{statements.trialBalance.totalCredit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
