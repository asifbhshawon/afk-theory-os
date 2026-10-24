import { db } from "@/db";
import { partners, paymentAccounts } from "@/db/schema";
import {
  getFinancialStatements,
  getPartnerTransactionHistory,
} from "@/server/services/finance";
import { PartnerWorkspaceClient } from "@/components/partners/PartnerWorkspaceClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partner Accounts & Governance | AFK THEORY Business OS",
  description: "Capital accounts, loan balances, withdrawals, and profit allocations for five founding partners",
};

export default async function PartnersPage() {
  const statements = await getFinancialStatements();
  const allPartners = await db.select().from(partners).orderBy(partners.name);
  const payAccounts = await db.select().from(paymentAccounts);
  const history = await getPartnerTransactionHistory();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            Founding Partners & Governance
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            Five founding partners with initial 20% ownership each. Separate capital accounts, loans, profit allocations, and transactional proof.
          </p>
        </div>
        <a
          href="/api/export/financial-statements?type=partner-statements"
          className="px-4 py-2 bg-afk-surface hover:bg-afk-elevated text-afk-offwhite text-xs font-semibold rounded-lg border border-afk-border flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-sm"
        >
          <span>📥 Export Partner Statements (CSV)</span>
        </a>
      </div>

      {/* Partner Statement Cards - Responsive 1 to 5 cols with spacious padding & legible typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statements.partnerStatements.map((p) => (
          <div
            key={p.partnerId}
            className="bg-afk-card p-5 rounded-2xl border border-afk-border flex flex-col justify-between shadow-sm hover:border-afk-border-strong transition"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-afk-offwhite">{p.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-afk-olive/30 text-afk-olive-accent font-semibold font-mono border border-afk-olive/40">
                  {p.ownershipPct}%
                </span>
              </div>
              <p className="text-xs text-afk-muted mt-0.5 font-medium">
                Profit Allocation: {p.profitSharePct}%
              </p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-afk-secondary">
                  <span>Capital Contributed:</span>
                  <span className="tabular-nums text-afk-offwhite font-medium">
                    ৳{p.capitalContributed.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-secondary">
                  <span>Loan Owed:</span>
                  <span className="tabular-nums text-afk-offwhite font-medium">
                    ৳{p.loanBalanceOwedByCompany.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-secondary">
                  <span>Drawings (Out):</span>
                  <span className="tabular-nums text-afk-offwhite font-medium">
                    ৳{p.drawings.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-secondary">
                  <span>Profit Share:</span>
                  <span className="tabular-nums text-afk-offwhite font-medium">
                    ৳{p.shareOfProfit.toLocaleString("en-BD")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-afk-border flex justify-between items-center text-xs">
              <span className="text-afk-muted font-medium">Total Equity</span>
              <span className="font-bold text-afk-offwhite text-base tabular-nums">
                ৳{p.totalEquity.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Partner Transaction Workspace: 4 Integrated Forms with Contextual Uploader & Transaction History */}
      <PartnerWorkspaceClient
        partners={allPartners}
        paymentAccounts={payAccounts}
        initialHistory={history}
      />
    </div>
  );
}
