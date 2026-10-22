import { db } from "@/db";
import { accounts, journalEntries, journalLines, paymentAccounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getFinancialStatements, recordBusinessExpense, transferFunds, reverseJournalEntry } from "@/server/services/finance";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Printer, RotateCcw, ArrowRightLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const statements = await getFinancialStatements();
  const allAccounts = await db.select().from(accounts).orderBy(accounts.code);
  const payAccounts = await db.select().from(paymentAccounts);

  const entriesWithLines = await db
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      description: journalEntries.description,
      entryType: journalEntries.entryType,
      reference: journalEntries.reference,
      status: journalEntries.status,
    })
    .from(journalEntries)
    .orderBy(desc(journalEntries.date))
    .limit(50);

  // Server action to record a business expense
  async function handleCreateExpense(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);

    const expenseAccountId = formData.get("expenseAccountId") as string;
    const paymentAccountId = formData.get("paymentAccountId") as string;
    const amount = Number(formData.get("amount"));
    const description = formData.get("description") as string;
    const reference = formData.get("reference") as string;

    if (!expenseAccountId || !paymentAccountId || !amount || !description) {
      throw new Error("All fields required");
    }

    await recordBusinessExpense({
      expenseAccountId,
      paymentAccountId,
      amount,
      description,
      reference,
      userId: user.id,
    });

    revalidatePath("/finance");
    revalidatePath("/");
  }

  // Server action for inter-account funds transfer
  async function handleTransferFunds(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);

    const fromPaymentAccountId = formData.get("fromPaymentAccountId") as string;
    const toPaymentAccountId = formData.get("toPaymentAccountId") as string;
    const amount = Number(formData.get("amount"));
    const reference = formData.get("reference") as string;

    if (!fromPaymentAccountId || !toPaymentAccountId || !amount) {
      throw new Error("Source, destination, and amount are required");
    }

    await transferFunds({
      fromPaymentAccountId,
      toPaymentAccountId,
      amount,
      reference: reference || undefined,
      userId: user.id,
    });

    revalidatePath("/finance");
    revalidatePath("/");
  }

  // Server action to reverse a posted journal entry
  async function handleReverseJournal(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);

    const journalEntryId = formData.get("journalEntryId") as string;
    const reason = (formData.get("reason") as string) || "Manual operational reversal";

    if (!journalEntryId) {
      throw new Error("Journal entry ID required");
    }

    await reverseJournalEntry(journalEntryId, reason, user.id);

    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-afk-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Finance & General Ledger</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Double-entry journals, chart of accounts, and balanced financial transactions.
          </p>
        </div>
      </div>

      {/* Financial Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Business Expense Quick Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Record Business Expense</h3>
          <form action={handleCreateExpense} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Category</label>
                <select
                  name="expenseAccountId"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Expense...</option>
                  {allAccounts
                    .filter((a) => a.group === "EXPENSE")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Payment Account</label>
                <select
                  name="paymentAccountId"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Account...</option>
                  {payAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Description</label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="e.g. Meta ads campaign, hang tags & poly bags"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <input
                type="text"
                name="reference"
                placeholder="Reference / Invoice # (optional)"
                className="bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive w-1/2"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition shadow cursor-pointer"
              >
                Post Expense
              </button>
            </div>
          </form>
        </div>

        {/* Transfer Funds Between Payment Accounts Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-4 h-4 text-afk-olive-accent" />
            <h3 className="text-sm font-semibold text-afk-offwhite">Inter-Account Fund Transfer</h3>
          </div>
          <form action={handleTransferFunds} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Source Account (From)</label>
                <select
                  name="fromPaymentAccountId"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Source...</option>
                  {payAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name} ({pa.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Destination Account (To)</label>
                <select
                  name="toPaymentAccountId"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Destination...</option>
                  {payAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name} ({pa.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Transfer Amount (BDT ৳)</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Transfer Reference</label>
                <input
                  type="text"
                  name="reference"
                  placeholder="e.g. Bank Deposit Slip / MFS Trx ID"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition shadow cursor-pointer"
              >
                Transfer Funds
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Posted Journal Entries Table */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">General Ledger Journal Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Entry Number</th>
                <th className="py-2.5 font-medium">Type</th>
                <th className="py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Description</th>
                <th className="py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {entriesWithLines.map((j) => (
                <tr key={j.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2.5 font-mono text-afk-offwhite font-medium">{j.entryNumber}</td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                      {j.entryType}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-afk-muted">
                    {new Date(j.date).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="py-2.5 text-afk-offwhite">{j.description}</td>
                  <td className="py-2.5 font-mono text-afk-muted">{j.reference || "—"}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        j.status === "POSTED"
                          ? "bg-afk-olive-dark text-afk-olive-accent"
                          : "bg-afk-danger/20 text-afk-danger"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/print/voucher/${j.id}`}
                        target="_blank"
                        title="Print Official Voucher"
                        className="p-1 text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface rounded border border-afk-border transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Link>

                      {j.status === "POSTED" && j.entryType !== "REVERSAL" && (
                        <form action={handleReverseJournal} className="inline">
                          <input type="hidden" name="journalEntryId" value={j.id} />
                          <input type="hidden" name="reason" value="Reversal by authorized finance manager" />
                          <button
                            type="submit"
                            title="Reverse this journal entry"
                            className="p-1 text-afk-muted hover:text-red-400 hover:bg-afk-surface rounded border border-afk-border transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart of Accounts Grid */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Chart of Accounts (COA)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Account Name</th>
                <th className="py-2 font-medium">Group</th>
                <th className="py-2 font-medium">Normal Sign</th>
                <th className="py-2 font-medium text-right">Debit</th>
                <th className="py-2 font-medium text-right">Credit</th>
                <th className="py-2 font-medium text-right">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {statements.trialBalance.accounts.map((a) => (
                <tr key={a.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2 font-mono font-bold text-afk-offwhite">{a.code}</td>
                  <td className="py-2 text-afk-offwhite">{a.name}</td>
                  <td className="py-2 text-afk-muted font-mono text-[11px]">{a.group}</td>
                  <td className="py-2 text-afk-muted text-[10px] uppercase font-mono">{a.normalBalance}</td>
                  <td className="py-2 text-right font-mono text-afk-muted">
                    ৳{a.debit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right font-mono text-afk-muted">
                    ৳{a.credit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-afk-offwhite">
                    ৳{a.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
