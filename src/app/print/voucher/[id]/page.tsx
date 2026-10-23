import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getEvidenceForEntity } from "@/server/services/evidence";
import { PrintableVoucherView } from "@/components/voucher/PrintableVoucherView";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrintableVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, id))
    .limit(1);

  if (!entry) {
    notFound();
  }

  const lines = await db
    .select({
      id: journalLines.id,
      debit: journalLines.debit,
      credit: journalLines.credit,
      memo: journalLines.memo,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(eq(journalLines.journalEntryId, entry.id));

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

  // Fetch attached evidence documents
  const attachedEvidence = await getEvidenceForEntity("JOURNAL_ENTRY", id);

  const canManage = !!(
    user?.isAdmin ||
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("FINANCE_MGR")
  );

  return (
    <div className="bg-white text-black min-h-screen p-8 max-w-4xl mx-auto font-sans">
      <PrintableVoucherView
        entry={entry}
        lines={lines}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        initialEvidence={attachedEvidence}
        canManage={canManage}
      />
    </div>
  );
}
