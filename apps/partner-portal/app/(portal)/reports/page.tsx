import { db } from "@/lib/db";
import {
  portalBusinessSummaries,
  portalPartnerStatements,
} from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCurrentPartner } from "@/lib/auth";
import { formatBdt, formatDate } from "@/lib/format";
import { Printer, FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const [summary] = await db
    .select()
    .from(portalBusinessSummaries)
    .where(eq(portalBusinessSummaries.id, "latest"))
    .limit(1);

  const statements = await db.select().from(portalPartnerStatements);

  const netRevenue = Number(summary?.netRevenue || 0);
  const grossRevenue = Number(summary?.grossRevenue || 0);
  const salesReturns = Number(summary?.salesReturns || 0);
  const totalCogs = Number(summary?.totalCogs || 0);
  const grossProfit = Number(summary?.grossProfit || 0);
  const operatingExpenses = Number(summary?.operatingExpenses || 0);
  const netProfit = Number(summary?.netProfit || 0);
  const availableCash = Number(summary?.availableCash || 0);
  const totalInventory = Number(summary?.totalInventoryValue || 0);
  const courierCod = Number(summary?.courierCodReceivable || 0);

  const totalAssets = availableCash + totalInventory + courierCod;

  return (
    <div className="space-y-6">
      {/* Screen Toolbar (hidden in print) */}
      <div className="no-print pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>Executive Financial Reports & Summaries</span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Verified financial statements derived from authoritative ERP general ledger postings
          </p>
        </div>

        <PrintButton />
      </div>

      {/* Printable Document Container */}
      <div className="bg-afk-card print:bg-white print:text-black p-6 sm:p-8 rounded-xl border border-afk-border print:border-none shadow-sm space-y-8 print:p-0">
        {/* Printable Header */}
        <div className="border-b-2 border-afk-border print:border-black pb-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg sm:text-xl tracking-tight text-afk-offwhite print:text-black">
                AFK THEORY
              </span>
              <span className="text-2xs uppercase tracking-wider px-2 py-0.5 rounded bg-afk-surface print:border print:border-black text-afk-secondary print:text-black">
                Executive Partner Summary
              </span>
            </div>
            <p className="text-xs text-afk-secondary print:text-gray-700 mt-1">
              Apparel Manufacturing & E-Commerce Operations • Bangladesh
            </p>
          </div>
          <div className="text-right text-xs text-afk-muted print:text-gray-600">
            <p className="font-mono">As of {formatDate(new Date())}</p>
            <p className="text-2xs mt-0.5">Currency: BDT (৳)</p>
          </div>
        </div>

        {/* 1. Income Statement (P&L) */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-afk-offwhite print:text-black uppercase tracking-wider pb-1 border-b border-afk-border print:border-gray-400">
            1. Income Statement (Profit & Loss)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-afk-border print:divide-gray-300">
                <tr className="hover:bg-afk-surface/30">
                  <td className="py-2 text-afk-offwhite print:text-black font-medium">Gross Apparel Sales Revenue</td>
                  <td className="py-2 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(grossRevenue)}</td>
                </tr>
                <tr className="hover:bg-afk-surface/30">
                  <td className="py-2 text-afk-secondary print:text-gray-600 pl-4">Less: Sales Returns & Customer Allowances</td>
                  <td className="py-2 text-right font-mono text-amber-400 print:text-black">({formatBdt(salesReturns)})</td>
                </tr>
                <tr className="bg-afk-surface/40 print:bg-gray-100 font-bold">
                  <td className="py-2 text-afk-offwhite print:text-black">Net Sales Revenue</td>
                  <td className="py-2 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(netRevenue)}</td>
                </tr>
                <tr className="hover:bg-afk-surface/30">
                  <td className="py-2 text-afk-secondary print:text-gray-600 pl-4">Less: Cost of Goods Sold (Finished Garments)</td>
                  <td className="py-2 text-right font-mono text-amber-400 print:text-black">({formatBdt(totalCogs)})</td>
                </tr>
                <tr className="bg-afk-surface/40 print:bg-gray-100 font-bold">
                  <td className="py-2 text-afk-offwhite print:text-black">Gross Operating Profit</td>
                  <td className="py-2 text-right font-mono text-afk-olive-accent print:text-black">{formatBdt(grossProfit)}</td>
                </tr>
                <tr className="hover:bg-afk-surface/30">
                  <td className="py-2 text-afk-secondary print:text-gray-600 pl-4">Less: Operating Expenses (Courier, Packaging, Marketing, Utilities)</td>
                  <td className="py-2 text-right font-mono text-amber-400 print:text-black">({formatBdt(operatingExpenses)})</td>
                </tr>
                <tr className="border-t-2 border-afk-border print:border-black font-bold text-sm">
                  <td className="py-2.5 text-afk-gold print:text-black">Net Operating Profit</td>
                  <td className="py-2.5 text-right font-mono text-afk-gold print:text-black">{formatBdt(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Balance Sheet Summary */}
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-bold text-afk-offwhite print:text-black uppercase tracking-wider pb-1 border-b border-afk-border print:border-gray-400">
            2. Balance Sheet Snapshot
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-afk-border print:divide-gray-300">
                <tr className="font-semibold text-afk-secondary print:text-gray-700">
                  <td colSpan={2} className="py-1">Current Assets</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-4 text-afk-offwhite print:text-black">Cash, Bank & Mobile Financial Services (bKash/Nagad)</td>
                  <td className="py-1.5 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(availableCash)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-4 text-afk-offwhite print:text-black">Inventory at Cost (Raw Materials, WIP, Finished Goods)</td>
                  <td className="py-1.5 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(totalInventory)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-4 text-afk-offwhite print:text-black">Courier COD Receivables Pending Remittance</td>
                  <td className="py-1.5 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(courierCod)}</td>
                </tr>
                <tr className="border-t border-afk-border print:border-gray-400 font-bold">
                  <td className="py-2 text-afk-offwhite print:text-black">Total Current Assets</td>
                  <td className="py-2 text-right font-mono text-afk-offwhite print:text-black">{formatBdt(totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Partner Capital & Equity Allocations */}
        <div className="space-y-3 pt-4 print-page-break">
          <h2 className="text-sm font-bold text-afk-offwhite print:text-black uppercase tracking-wider pb-1 border-b border-afk-border print:border-gray-400">
            3. Founding Partners Equity & Loans Summary
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-afk-border print:border-gray-400 text-afk-secondary print:text-gray-700">
                  <th className="py-2 px-2">Partner</th>
                  <th className="py-2 px-2 text-center">Ownership %</th>
                  <th className="py-2 px-2 text-right">Capital</th>
                  <th className="py-2 px-2 text-right">Loans Due</th>
                  <th className="py-2 px-2 text-right">Drawings</th>
                  <th className="py-2 px-2 text-right">Profit Share</th>
                  <th className="py-2 px-2 text-right font-bold">Net Equity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-afk-border print:divide-gray-300">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-afk-surface/30">
                    <td className="py-2.5 px-2 font-bold text-afk-offwhite print:text-black">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-2 text-center text-afk-secondary print:text-black font-mono">
                      {s.ownershipPct}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-afk-offwhite print:text-black">
                      {formatBdt(s.capitalContributed)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-400 print:text-black">
                      {formatBdt(s.loanBalanceOwed)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-400 print:text-black">
                      ({formatBdt(s.drawings)})
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-afk-offwhite print:text-black">
                      {formatBdt(s.shareOfProfit)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-afk-gold print:text-black">
                      {formatBdt(s.totalEquity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="pt-6 border-t border-afk-border print:border-gray-400 text-2xs text-afk-muted print:text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Prepared automatically from AFK THEORY Business OS ledger</span>
          <span>Certified for Executive Review by Founding Partners</span>
        </div>
      </div>
    </div>
  );
}
