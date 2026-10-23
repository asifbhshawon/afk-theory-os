import { db } from "@/db";
import { accounts, journalEntries, journalLines, paymentAccounts, partners } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import {
  getFinancialStatements,
  recordBusinessExpense,
  transferFunds,
  reverseJournalEntry,
  createCustomExpenseCategory,
} from "@/server/services/finance";
import { revalidatePath } from "next/cache";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/server/services/evidence";
import { FinanceEvidenceSection } from "@/components/evidence/FinanceEvidenceSection";
import Link from "next/link";
import { Printer, RotateCcw, ArrowRightLeft, PlusCircle, Tag, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const statements = await getFinancialStatements();
  const allAccounts = await db.select().from(accounts).orderBy(asc(accounts.code));
  const payAccounts = await db.select().from(paymentAccounts);
  const allPartners = await db.select().from(partners).where(eq(partners.status, "ACTIVE"));

  const expenseAccounts = allAccounts.filter((a) => a.group === "EXPENSE");
  const currentUser = await getCurrentUser();
  const financeDocs = await listDocuments({ module: "FINANCE", limit: 30 });

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

  // Server action to record a business expense (supports existing or custom categories, and partner-paid reimbursable)
  async function handleCreateExpense(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);

    const expenseAccountId = formData.get("expenseAccountId") as string;
    const customCategoryName = (formData.get("customCategoryName") as string)?.trim();
    const fundingSource = formData.get("fundingSource") as string;
    const amount = Number(formData.get("amount"));
    const description = formData.get("description") as string;
    const reference = formData.get("reference") as string;

    if ((!expenseAccountId && !customCategoryName) || !fundingSource || !amount || !description) {
      throw new Error("Category, funding source, amount, and description are required.");
    }

    let paymentAccountId: string | undefined;
    let partnerId: string | undefined;

    if (fundingSource.startsWith("partner_")) {
      partnerId = fundingSource.replace("partner_", "");
    } else if (fundingSource.startsWith("pay_")) {
      paymentAccountId = fundingSource.replace("pay_", "");
    } else {
      paymentAccountId = fundingSource;
    }

    await recordBusinessExpense({
      expenseAccountId: expenseAccountId === "NEW_CUSTOM" ? undefined : expenseAccountId,
      customCategoryName: customCategoryName || (expenseAccountId === "NEW_CUSTOM" ? description : undefined),
      paymentAccountId,
      partnerId,
      amount,
      description,
      reference: reference || undefined,
      userId: user.id,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/partners");
    revalidatePath("/");
  }

  // Server action to add a new custom expense category to Chart of Accounts
  async function handleCreateCategory(formData: FormData) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR"]);

    const name = formData.get("categoryName") as string;
    const code = (formData.get("categoryCode") as string)?.trim() || undefined;
    const description = (formData.get("categoryDescription") as string)?.trim() || undefined;

    if (!name || !name.trim()) {
      throw new Error("Category name is required");
    }

    await createCustomExpenseCategory({
      name,
      code,
      description,
      userId: user.id,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-afk-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Finance & General Ledger</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Double-entry journals, chart of accounts, custom expense categories, and balanced financial transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/financial-statements?type=trial-balance"
            className="px-3 py-1.5 bg-afk-surface hover:bg-afk-olive/20 text-afk-offwhite text-xs font-semibold rounded border border-afk-border flex items-center gap-1.5 transition-colors"
          >
            <span>📥 Export Trial Balance (CSV)</span>
          </a>
        </div>
      </div>

      {/* Financial Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Business Expense Quick Form */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-afk-offwhite">Record Business Expense</h3>
            <span className="text-[10px] text-afk-olive-accent bg-afk-olive-dark px-2 py-0.5 rounded border border-afk-olive">
              Auto GL Posting
            </span>
          </div>
          <form action={handleCreateExpense} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Category</label>
                <select
                  name="expenseAccountId"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Existing Category...</option>
                  <option value="NEW_CUSTOM">✨ + Type New Custom Category Below</option>
                  <optgroup label="Available Expense Categories">
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} {!a.isSystem ? "★ (Custom)" : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Paid From / Funding Source</label>
                <select
                  name="fundingSource"
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="">Select Funding Source...</option>
                  <optgroup label="Company Payment Accounts">
                    {payAccounts.map((pa) => (
                      <option key={pa.id} value={`pay_${pa.id}`}>
                        🏢 {pa.name} ({pa.type})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Paid Out-of-Pocket by Partner (Reimbursable)">
                    {allPartners.map((p) => (
                      <option key={p.id} value={`partner_${p.id}`}>
                        👤 Paid by {p.name} (Due to Partner)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Custom Expense Category Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] text-afk-olive-accent font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-afk-olive-accent" />
                  Or Type New Custom Category
                </label>
                <span className="text-[10px] text-afk-muted">Auto-creates account in Chart of Accounts</span>
              </div>
              <input
                type="text"
                name="customCategoryName"
                placeholder="e.g. Studio Rent, Photoshoot & Models, Office Refreshments, Canva Subscription"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive placeholder:text-afk-muted/60"
              />
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
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Memo / Description</label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="e.g. Meta ads campaign, hang tags & poly bags, photo studio rent"
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
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border flex flex-col justify-between">
          <div>
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
      </div>

      {/* Custom Expense Categories Manager */}
      <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-afk-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-afk-olive-accent" />
              <h3 className="text-sm font-semibold text-afk-offwhite">Expense Categories & Cost Centers</h3>
            </div>
            <p className="text-[11px] text-afk-muted mt-0.5">
              Define custom operating expense categories to match your brand operations (studio rent, photo shoots, food, marketing tools).
            </p>
          </div>
          <span className="text-xs font-mono text-afk-muted">
            {expenseAccounts.length} categories active
          </span>
        </div>

        {/* Add Category Form */}
        <form action={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-afk-surface/60 p-3 rounded-lg border border-afk-border text-xs">
          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Category Name</label>
            <input
              type="text"
              name="categoryName"
              required
              placeholder="e.g. Studio Rent / Photoshoot"
              className="w-full bg-afk-charcoal border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">GL Code (Optional)</label>
            <input
              type="text"
              name="categoryCode"
              placeholder="Auto (e.g. 6060, 6070...)"
              className="w-full bg-afk-charcoal border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Description (Optional)</label>
            <input
              type="text"
              name="categoryDescription"
              placeholder="Details or usage scope"
              className="w-full bg-afk-charcoal border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Custom Category</span>
            </button>
          </div>
        </form>

        {/* Existing Categories Pill List */}
        <div className="flex flex-wrap gap-2 pt-1">
          {expenseAccounts.map((a) => (
            <div
              key={a.id}
              className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                !a.isSystem
                  ? "bg-afk-olive-dark/40 text-afk-offwhite border-afk-olive"
                  : "bg-afk-surface text-afk-muted border-afk-border"
              }`}
            >
              <span className="font-mono text-[10px] text-afk-olive-accent font-bold">[{a.code}]</span>
              <span>{a.name}</span>
              {!a.isSystem && (
                <span className="text-[9px] bg-afk-olive px-1.5 py-0.2 rounded text-afk-offwhite font-bold">
                  Custom
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Attached Evidence & Receipts */}
      <FinanceEvidenceSection
        initialDocuments={financeDocs.items}
        canVerify={currentUser?.isAdmin || currentUser?.roles?.includes("FINANCE_MGR")}
      />

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
            <tbody className="divide-y divide-afk-border/40 font-mono">
              {entriesWithLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-afk-muted">
                    No journal entries recorded yet. Record an expense or receive goods to start posting.
                  </td>
                </tr>
              ) : (
                entriesWithLines.map((entry) => (
                  <tr key={entry.id} className="hover:bg-afk-surface/30">
                    <td className="py-2.5 font-bold text-afk-offwhite">{entry.entryNumber}</td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-afk-surface border border-afk-border text-afk-muted">
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 text-afk-muted">
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 text-afk-offwhite font-sans max-w-xs truncate">{entry.description}</td>
                    <td className="py-2.5 text-afk-muted">{entry.reference || "—"}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          entry.status === "POSTED"
                            ? "text-afk-success bg-afk-olive-dark border border-afk-olive"
                            : "text-afk-danger bg-afk-danger/20"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        {/* Printable Voucher Button */}
                        <Link
                          href={`/print/voucher/${entry.id}`}
                          target="_blank"
                          className="px-2 py-1 bg-afk-surface hover:bg-afk-border text-afk-offwhite text-[10px] rounded border border-afk-border flex items-center gap-1 transition"
                          title="Print Official A4 Voucher"
                        >
                          <Printer className="w-3 h-3 text-afk-muted" />
                          <span>Voucher</span>
                        </Link>

                        {/* Reversal Form */}
                        {entry.status === "POSTED" && entry.entryType !== "REVERSAL" && (
                          <form action={handleReverseJournal} className="inline-block">
                            <input type="hidden" name="journalEntryId" value={entry.id} />
                            <input type="hidden" name="reason" value="Operational correction / manual reversal" />
                            <button
                              type="submit"
                              className="px-2 py-1 bg-afk-surface hover:bg-afk-danger/20 hover:text-afk-danger text-afk-muted text-[10px] rounded border border-afk-border flex items-center gap-1 transition cursor-pointer"
                              title="Post Reversal Journal Entry"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
