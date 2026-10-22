import { db } from "@/db";
import { partners, paymentAccounts } from "@/db/schema";
import { getFinancialStatements, recordPartnerContribution, recordPartnerLoan } from "@/server/services/finance";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const statements = await getFinancialStatements();
  const allPartners = await db.select().from(partners).orderBy(partners.name);
  const payAccounts = await db.select().from(paymentAccounts);

  async function handleRecordContribution(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);
    const partnerId = formData.get("partnerId") as string;
    const paymentAccountId = formData.get("paymentAccountId") as string;
    const amount = Number(formData.get("amount"));
    const reference = formData.get("reference") as string;

    if (!partnerId || !paymentAccountId || !amount) {
      throw new Error("Partner, account, and amount are required");
    }

    await recordPartnerContribution({
      partnerId,
      paymentAccountId,
      amount,
      reference,
      userId: user.id,
    });

    revalidatePath("/partners");
    revalidatePath("/finance");
    revalidatePath("/");
  }

  async function handleRecordLoan(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);
    const partnerId = formData.get("partnerId") as string;
    const paymentAccountId = formData.get("paymentAccountId") as string;
    const amount = Number(formData.get("amount"));
    const reference = formData.get("reference") as string;

    if (!partnerId || !paymentAccountId || !amount) {
      throw new Error("Partner, account, and amount are required");
    }

    await recordPartnerLoan({
      partnerId,
      paymentAccountId,
      amount,
      reference,
      userId: user.id,
    });

    revalidatePath("/partners");
    revalidatePath("/finance");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-afk-border">
        <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Founding Partners & Governance</h2>
        <p className="text-xs text-afk-muted mt-0.5">
          Five founding partners with initial 20% ownership each. Separate capital accounts, loans, and profit allocations.
        </p>
      </div>

      {/* Partner Statement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statements.partnerStatements.map((p) => (
          <div key={p.partnerId} className="bg-afk-charcoal p-4 rounded-lg border border-afk-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-afk-offwhite">{p.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-olive-dark text-afk-olive-accent font-mono">
                  {p.ownershipPct}%
                </span>
              </div>
              <p className="text-[10px] text-afk-muted mt-0.5 font-mono">Profit Share: {p.profitSharePct}%</p>

              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-afk-muted">
                  <span>Capital In:</span>
                  <span className="font-mono text-afk-offwhite font-medium">৳{p.capitalContributed.toLocaleString("en-BD")}</span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Loan Owed:</span>
                  <span className="font-mono text-afk-offwhite font-medium">৳{p.loanBalanceOwedByCompany.toLocaleString("en-BD")}</span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Drawings:</span>
                  <span className="font-mono text-afk-offwhite font-medium">৳{p.drawings.toLocaleString("en-BD")}</span>
                </div>
                <div className="flex justify-between text-afk-muted">
                  <span>Profit Share:</span>
                  <span className="font-mono text-afk-offwhite font-medium">৳{p.shareOfProfit.toLocaleString("en-BD")}</span>
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

      {/* Forms Section: Record Equity Contribution & Partner Loan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Contribution Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-1">Record Partner Equity Contribution</h3>
          <p className="text-xs text-afk-muted mb-4">
            Credits Partner Capital account and debits Bank/Cash. Does not affect revenue or profit.
          </p>

          <form action={handleRecordContribution} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
              <select
                name="partnerId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Partner...</option>
                {allPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ownershipPct}% Ownership)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Receiving Account</label>
              <select
                name="paymentAccountId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Account...</option>
                {payAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name} ({pa.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="100"
                required
                placeholder="e.g. 50000"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference / Note</label>
              <input
                type="text"
                name="reference"
                placeholder="e.g. Bank slip #99812"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-semibold rounded transition"
            >
              Post Capital Contribution
            </button>
          </form>
        </div>

        {/* Partner Loan Advance Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-1">Record Partner Loan Advance</h3>
          <p className="text-xs text-afk-muted mb-4">
            Credits Due to Partner (Liability) and debits Bank/Cash. Repayable without altering equity share.
          </p>

          <form action={handleRecordLoan} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
              <select
                name="partnerId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Partner...</option>
                {allPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Receiving Account</label>
              <select
                name="paymentAccountId"
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Account...</option>
                {payAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name} ({pa.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="100"
                required
                placeholder="e.g. 25000"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference / Note</label>
              <input
                type="text"
                name="reference"
                placeholder="e.g. Temporary liquidity advance"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-offwhite font-semibold rounded transition"
            >
              Post Partner Loan
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
