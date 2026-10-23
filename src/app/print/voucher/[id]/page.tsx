import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getEvidenceForEntity } from "@/server/services/evidence";

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

  // Fetch attached evidence documents
  const attachedEvidence = await getEvidenceForEntity("JOURNAL_ENTRY", id);

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

      {/* Supporting Evidence & Verification Appendix */}
      <div className="mb-8 p-3 rounded border border-gray-300 bg-gray-50 text-xs">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2 mb-2 font-bold">
          <span className="uppercase tracking-wider">Supporting Proof & Evidence Appendix</span>
          <span className="font-mono text-[11px] bg-black text-white px-2 py-0.5 rounded">
            Attachments: {attachedEvidence.length}
          </span>
        </div>

        {attachedEvidence.length > 0 ? (
          <div className="space-y-2">
            {attachedEvidence.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between text-[11px] border-b border-gray-200 pb-1.5 last:border-0 last:pb-0"
              >
                <div>
                  <span className="font-semibold">{ev.displayTitle || ev.originalName}</span>
                  <span className="text-gray-500 font-mono ml-2">[{ev.category}]</span>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    SHA256: {ev.fileHash.substring(0, 16)}... · {(ev.fileSizeBytes / 1024).toFixed(0)} KB WebP
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                      ev.verificationStatus === "VERIFIED"
                        ? "bg-green-100 text-green-800"
                        : ev.verificationStatus === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {ev.verificationStatus}
                  </span>
                  {ev.verifiedAt && (
                    <span className="block text-[9px] text-gray-500 mt-0.5">
                      {new Date(ev.verifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic text-[11px]">
            No electronic evidence documents attached to this transaction voucher.
          </p>
        )}
      </div>

      {/* Signatures & Approvals Block */}
      <div className="grid grid-cols-3 gap-6 pt-12 border-t border-gray-300 text-center text-xs">
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
