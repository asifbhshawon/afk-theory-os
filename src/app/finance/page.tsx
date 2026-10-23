import { db } from "@/db";
import { accounts, journalEntries, journalLines, paymentAccounts, partners } from "@/db/schema";
import { desc, eq, asc, inArray } from "drizzle-orm";
import {
  getFinancialStatements,
  createCustomExpenseCategory,
} from "@/server/services/finance";
import { revalidatePath } from "next/cache";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { listDocuments, getEvidenceForEntities } from "@/server/services/evidence";
import { FinanceEvidenceSection } from "@/components/evidence/FinanceEvidenceSection";
import { FinanceWorkspaceClient } from "@/components/finance/FinanceWorkspaceClient";
import { PlusCircle, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const statements = await getFinancialStatements();
  const allAccounts = await db.select().from(accounts).orderBy(asc(accounts.code));
  const payAccounts = await db.select().from(paymentAccounts);
  const allPartners = await db.select().from(partners).where(eq(partners.status, "ACTIVE"));

  const expenseAccounts = allAccounts.filter((a) => a.group === "EXPENSE");
  const currentUser = await getCurrentUser();
  const financeDocs = await listDocuments({ module: "FINANCE", limit: 30 });

  const rawEntries = await db
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
    .orderBy(desc(journalEntries.date), desc(journalEntries.entryNumber))
    .limit(50);

  // Batch fetch evidence and lines for these journal entries
  const entryIds = rawEntries.map((e) => e.id);
  const evidenceMap = await getEvidenceForEntities("JOURNAL_ENTRY", entryIds);
  const lines = entryIds.length > 0 ? await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      partnerId: journalLines.partnerId,
      memo: journalLines.memo,
    })
    .from(journalLines)
    .where(inArray(journalLines.journalEntryId, entryIds)) : [];

  const tradePayablesAcc = allAccounts.find((a) => a.code === "2010");

  const entriesWithEvidence = rawEntries.map((e) => {
    const entryLines = lines.filter((l) => l.journalEntryId === e.id);
    const amount = entryLines.reduce(
      (max, l) => Math.max(max, Number(l.debit), Number(l.credit)),
      0
    );

    const debitLine = entryLines.find((l) => Number(l.debit) > 0);
    const creditLine = entryLines.find((l) => Number(l.credit) > 0);

    const payAcc = creditLine
      ? payAccounts.find((p) => p.glAccountId === creditLine.accountId)
      : undefined;

    const isSupplier = creditLine && tradePayablesAcc
      ? creditLine.accountId === tradePayablesAcc.id
      : false;

    return {
      ...e,
      amount,
      expenseAccountId: debitLine?.accountId,
      partnerId: creditLine?.partnerId,
      paymentAccountId: payAcc?.id,
      isSupplierPayable: isSupplier,
      evidence: evidenceMap[e.id] || [],
    };
  });

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

  const canManage = !!(currentUser?.isAdmin || currentUser?.roles?.includes("FINANCE_MGR"));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-afk-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">
            Finance & General Ledger
          </h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Double-entry journals, chart of accounts, custom expense categories, and contextual payment proof attachments.
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

      {/* Interactive Finance Workspace (Quick Expense with Evidence, Transfers, GL Table with Proof Badges) */}
      <FinanceWorkspaceClient
        expenseAccounts={expenseAccounts}
        paymentAccounts={payAccounts}
        partners={allPartners}
        journalEntries={entriesWithEvidence}
        canManage={canManage}
      />

      {/* Custom Expense Categories Manager */}
      <div className="bg-afk-charcoal p-5 rounded-xl border border-afk-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-afk-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-afk-olive-accent" />
              <h3 className="text-sm font-semibold text-afk-offwhite">
                Expense Categories & Cost Centers
              </h3>
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
        <form
          action={handleCreateCategory}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-afk-surface/60 p-3 rounded-lg border border-afk-border text-xs"
        >
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

        {/* Active Categories List */}
        <div className="flex flex-wrap gap-2 pt-1">
          {expenseAccounts.map((a) => (
            <div
              key={a.id}
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                !a.isSystem
                  ? "bg-afk-olive-dark/40 text-afk-offwhite border-afk-olive"
                  : "bg-afk-surface text-afk-muted border-afk-border"
              }`}
            >
              <span className="font-mono text-[10px] text-afk-olive-accent font-bold">
                [{a.code}]
              </span>
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

      {/* Central Evidence Section */}
      <FinanceEvidenceSection
        initialDocuments={financeDocs.items}
        canVerify={canManage}
      />
    </div>
  );
}
