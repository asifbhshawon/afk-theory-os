import { db } from "@/db";
import { partners, paymentAccounts } from "@/db/schema";
import {
  getFinancialStatements,
  getPartnerTransactionHistory,
} from "@/server/services/finance";
import { PartnerWorkspaceClient } from "@/components/partners/PartnerWorkspaceClient";

export const dynamic = "force-dynamic";

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
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">
            Founding Partners & Governance
          </h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Five founding partners with initial 20% ownership each. Separate capital accounts, loans, profit allocations, and transactional proof.
          </p>
        </div>
        <a
          href="/api/export/financial-statements?type=partner-statements"
          className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <span>📥 Export Partner Statements (CSV)</span>
        </a>
      </div>

      {/* Partner Statement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statements.partnerStatements.map((p) => (
          <div
            key={p.partnerId}
            className="bg-afk-charcoal p-4 rounded-xl border border-afk-border flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-afk-offwhite">{p.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-olive-dark text-afk-olive-accent font-mono">
                  {p.ownershipPct}%
                </span>
              </div>
              <p className="text-[10px] text-afk-muted mt-0.5 font-mono">
                Profit Share: {p.profitSharePct}%
              </p>

              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-afk-muted">
                  <span>Capital In:</span>
                  <span className="font-mono text-afk-offwhite font-medium">
                    ৳{p.capitalContributed.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Loan Owed:</span>
                  <span className="font-mono text-afk-offwhite font-medium">
                    ৳{p.loanBalanceOwedByCompany.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Drawings:</span>
                  <span className="font-mono text-afk-offwhite font-medium">
                    ৳{p.drawings.toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Profit Share:</span>
                  <span className="font-mono text-afk-offwhite font-medium">
                    ৳{p.shareOfProfit.toLocaleString("en-BD")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-afk-border flex justify-between items-center text-xs">
              <span className="text-afk-muted font-medium">Total Equity</span>
              <span className="font-mono font-bold text-afk-offwhite text-sm">
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
