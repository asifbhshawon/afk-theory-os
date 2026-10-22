import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintableVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  return (
    <div className="bg-white text-black min-h-screen p-8 max-w-4xl mx-auto font-sans">
      {/* Top action bar (hidden on print) */}
      <div className="no-print flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
        <span className="text-xs text-gray-500">Official A4 Voucher Preview</span>
        <PrintButton />
      </div>

      {/* Official Letterhead */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-widest uppercase">AFK THEORY</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mt-0.5">
            Apparel Manufacturing & Retail Operations
          </p>
          <p className="text-xs text-gray-500">Dhaka, Bangladesh · Currency: BDT (৳)</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider">
            PAYMENT / JOURNAL VOUCHER
          </span>
          <p className="text-xs font-mono font-bold mt-2">Voucher #: {entry.entryNumber}</p>
          <p className="text-xs text-gray-600 font-mono">
            Date: {new Date(entry.date).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Description & Reference */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-3 rounded border border-gray-200">
        <div>
          <span className="font-bold text-gray-700">Description / Narration:</span>
          <p className="mt-0.5 font-medium">{entry.description}</p>
        </div>
        <div>
          <span className="font-bold text-gray-700">Source Reference / Doc:</span>
          <p className="mt-0.5 font-mono">{entry.reference || "None"}</p>
        </div>
      </div>

      {/* Accounting Breakdown Table */}
      <table className="w-full text-xs border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 font-bold">Code</th>
            <th className="py-2 font-bold">Account Title</th>
            <th className="py-2 font-bold">Particulars / Memo</th>
            <th className="py-2 font-bold text-right">Debit (৳)</th>
            <th className="py-2 font-bold text-right">Credit (৳)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 font-mono">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2.5 font-bold">{l.accountCode}</td>
              <td className="py-2.5 font-sans font-medium">{l.accountName}</td>
              <td className="py-2.5 text-gray-600 font-sans">{l.memo || "—"}</td>
              <td className="py-2.5 text-right font-bold">
                {Number(l.debit) > 0 ? Number(l.debit).toLocaleString("en-BD", { minimumFractionDigits: 2 }) : "—"}
              </td>
              <td className="py-2.5 text-right font-bold">
                {Number(l.credit) > 0 ? Number(l.credit).toLocaleString("en-BD", { minimumFractionDigits: 2 }) : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-bold text-sm">
            <td colSpan={3} className="py-2.5 font-sans">TOTAL BDT (৳)</td>
            <td className="py-2.5 text-right">৳{totalDebit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
            <td className="py-2.5 text-right">৳{totalCredit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures & Approvals Block */}
      <div className="grid grid-cols-3 gap-6 pt-16 border-t border-gray-300 mt-12 text-center text-xs">
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Shawon</div>
          <p className="text-gray-500">Prepared By</p>
        </div>
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Rafi</div>
          <p className="text-gray-500">Checked / Reviewed</p>
        </div>
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Partner Approver</div>
          <p className="text-gray-500">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}
