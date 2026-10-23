import { db } from "@/db";
import {
  ventureContributions,
  ventureParticipants,
  ventureAgreements,
  ventures,
  partners,
  accounts,
  paymentAccounts,
  journalEntries,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { postJournalEntry } from "./finance";

export type ContributionType =
  | "CASH"
  | "PARTNER_LOAN"
  | "COMPANY_ALLOCATION"
  | "NON_CASH_ASSET"
  | "SERVICE_EQUITY";

export interface RecordContributionInput {
  ventureId: string;
  participantId?: string;
  partnerId?: string;
  contributionType: ContributionType;
  amount: number;
  paymentAccountId?: string;
  date?: string | Date;
  description: string;
  isRecordedInLedger?: boolean;
  notes?: string;
  userId?: string;
}

// Map partner name to their specific GL liability account (2110 - 2150)
async function getPartnerDueAccount(partnerId: string, txClient?: any) {
  const client = txClient || db;
  const [partner] = await client
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  if (!partner) return null;

  const partnerCodeMap: Record<string, string> = {
    Shawon: "2110",
    Rafi: "2120",
    Tousif: "2130",
    Midhat: "2140",
    Mueid: "2150",
  };

  const accountCode = partnerCodeMap[partner.name];
  if (!accountCode) return null;

  const [acc] = await client
    .select()
    .from(accounts)
    .where(eq(accounts.code, accountCode))
    .limit(1);

  return acc || null;
}

// Record a contribution with optional atomic GL ledger posting
export async function recordContribution(input: RecordContributionInput) {
  if (input.amount <= 0) {
    throw new Error("Contribution amount must be greater than zero.");
  }

  return await db.transaction(async (tx) => {
    // 1. Validate venture exists
    const [venture] = await tx
      .select()
      .from(ventures)
      .where(eq(ventures.id, input.ventureId))
      .limit(1);

    if (!venture) {
      throw new Error(`Venture ${input.ventureId} not found.`);
    }

    // 2. Resolve participant
    let participantId = input.participantId;
    if (!participantId && input.partnerId) {
      const [p] = await tx
        .select({ id: ventureParticipants.id })
        .from(ventureParticipants)
        .where(
          and(
            eq(ventureParticipants.ventureId, input.ventureId),
            eq(ventureParticipants.partnerId, input.partnerId)
          )
        )
        .limit(1);

      if (p) {
        participantId = p.id;
      }
    }

    // If still no participantId, find first participant or create ad-hoc
    if (!participantId) {
      const [firstP] = await tx
        .select({ id: ventureParticipants.id })
        .from(ventureParticipants)
        .where(eq(ventureParticipants.ventureId, input.ventureId))
        .limit(1);
      if (firstP) {
        participantId = firstP.id;
      } else {
        throw new Error("Cannot record contribution: participant could not be resolved.");
      }
    }

    let createdJournalId: string | null = null;
    const shouldPostLedger = input.isRecordedInLedger !== false;

    // 3. Post to General Ledger if applicable
    if (shouldPostLedger && (input.contributionType === "CASH" || input.contributionType === "PARTNER_LOAN")) {
      if (!input.paymentAccountId) {
        throw new Error("Payment account is required to post cash/loan contributions to the ledger.");
      }

      const [pa] = await tx
        .select()
        .from(paymentAccounts)
        .where(eq(paymentAccounts.id, input.paymentAccountId))
        .limit(1);

      if (!pa) throw new Error("Specified payment account not found.");

      let creditAccountId: string;
      if (input.partnerId) {
        const partnerAcc = await getPartnerDueAccount(input.partnerId, tx);
        if (!partnerAcc) throw new Error("Could not find GL Due to Partner account.");
        creditAccountId = partnerAcc.id;
      } else {
        const [tradePayable] = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.code, "2010"))
          .limit(1);
        if (!tradePayable) throw new Error("Trade Payables GL account (2010) not found.");
        creditAccountId = tradePayable.id;
      }

      const jEntry = await postJournalEntry(
        {
          date: input.date ? new Date(input.date) : new Date(),
          entryType: "TRANSFER",
          description: `Venture Funding (${venture.ventureNumber}): ${input.description}`,
          sourceModule: "VENTURES",
          sourceId: venture.id,
          userId: input.userId,
          lines: [
            {
              accountId: pa.glAccountId,
              debit: input.amount,
              credit: 0,
              memo: `Deposit to ${pa.name} for ${venture.ventureNumber}`,
              ventureId: venture.id,
              partnerId: input.partnerId,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: input.amount,
              memo: `Contribution for ${venture.ventureNumber}`,
              ventureId: venture.id,
              partnerId: input.partnerId,
            },
          ],
        },
        tx
      );

      createdJournalId = jEntry.id;
    } else if (shouldPostLedger && input.contributionType === "NON_CASH_ASSET") {
      const [materialsAcc] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.code, "1210"))
        .limit(1);

      if (materialsAcc && input.partnerId) {
        const partnerAcc = await getPartnerDueAccount(input.partnerId, tx);
        if (partnerAcc) {
          const jEntry = await postJournalEntry(
            {
              date: input.date ? new Date(input.date) : new Date(),
              entryType: "ADJUSTMENT",
              description: `Venture Non-Cash Asset (${venture.ventureNumber}): ${input.description}`,
              sourceModule: "VENTURES",
              sourceId: venture.id,
              userId: input.userId,
              lines: [
                {
                  accountId: materialsAcc.id,
                  debit: input.amount,
                  credit: 0,
                  memo: `Contributed materials for ${venture.ventureNumber}`,
                  ventureId: venture.id,
                  partnerId: input.partnerId,
                },
                {
                  accountId: partnerAcc.id,
                  debit: 0,
                  credit: input.amount,
                  memo: `Material contribution payable for ${venture.ventureNumber}`,
                  ventureId: venture.id,
                  partnerId: input.partnerId,
                },
              ],
            },
            tx
          );
          createdJournalId = jEntry.id;
        }
      }
    }

    // 4. Insert into ventureContributions
    const [contribution] = await tx
      .insert(ventureContributions)
      .values({
        ventureId: input.ventureId,
        participantId,
        contributionType: input.contributionType,
        amount: input.amount.toFixed(2),
        description: input.description,
        valuationBasis: input.contributionType,
        paymentAccountId: input.paymentAccountId || null,
        journalEntryId: createdJournalId,
        status: "CONFIRMED",
        contributedAt: input.date ? new Date(input.date) : new Date(),
        verifiedByUserId: input.userId || null,
        notes: input.notes || null,
      })
      .returning();

    // 5. Update actualCashContributed or approvedNonCashValue on participant
    if (input.contributionType === "CASH" || input.contributionType === "PARTNER_LOAN") {
      await tx.execute(
        sql`UPDATE venture_participants SET actual_cash_contributed = actual_cash_contributed + ${input.amount} WHERE id = ${participantId}`
      );
    } else {
      await tx.execute(
        sql`UPDATE venture_participants SET approved_non_cash_value = approved_non_cash_value + ${input.amount} WHERE id = ${participantId}`
      );
    }

    if (input.userId) {
      await tx.insert(auditLogs).values({
        userId: input.userId,
        action: "RECORD_CONTRIBUTION",
        entityType: "VENTURE_CONTRIBUTION",
        entityId: contribution.id,
        details: `Recorded ${input.contributionType} contribution of ৳${input.amount.toFixed(2)} for venture ${venture.ventureNumber}`,
      });
    }

    return contribution;
  });
}

// Get all contributions for a venture
export async function getVentureContributions(ventureId: string) {
  const rows = await db
    .select({
      contribution: ventureContributions,
      participant: ventureParticipants,
      paymentAccount: paymentAccounts,
      journal: journalEntries,
    })
    .from(ventureContributions)
    .innerJoin(ventureParticipants, eq(ventureContributions.participantId, ventureParticipants.id))
    .leftJoin(paymentAccounts, eq(ventureContributions.paymentAccountId, paymentAccounts.id))
    .leftJoin(journalEntries, eq(ventureContributions.journalEntryId, journalEntries.id))
    .where(eq(ventureContributions.ventureId, ventureId))
    .orderBy(desc(ventureContributions.contributedAt));

  return rows.map((r) => ({
    ...r.contribution,
    date: r.contribution.contributedAt,
    amount: parseFloat(r.contribution.amount),
    partnerName: r.participant.name,
    paymentAccountName: r.paymentAccount?.name || null,
    journalNumber: r.journal?.entryNumber || null,
  }));
}

// Get comprehensive funding dashboard summary per participant and overall venture
export async function getVentureFundingSummary(ventureId: string) {
  const [venture] = await db
    .select()
    .from(ventures)
    .where(eq(ventures.id, ventureId))
    .limit(1);

  const [activeAg] = await db
    .select()
    .from(ventureAgreements)
    .where(and(eq(ventureAgreements.ventureId, ventureId), eq(ventureAgreements.status, "APPROVED")))
    .orderBy(desc(ventureAgreements.version))
    .limit(1);

  const fallbackAg = activeAg || (
    await db
      .select()
      .from(ventureAgreements)
      .where(eq(ventureAgreements.ventureId, ventureId))
      .orderBy(desc(ventureAgreements.version))
      .limit(1)
  )[0];

  let participants: any[] = [];
  if (fallbackAg) {
    participants = await db
      .select({
        participant: ventureParticipants,
        partner: partners,
      })
      .from(ventureParticipants)
      .leftJoin(partners, eq(ventureParticipants.partnerId, partners.id))
      .where(eq(ventureParticipants.agreementId, fallbackAg.id));
  }

  const contributions = await db
    .select()
    .from(ventureContributions)
    .where(
      and(
        eq(ventureContributions.ventureId, ventureId),
        eq(ventureContributions.status, "CONFIRMED")
      )
    );

  const participantSummaries = participants.map(({ participant, partner }) => {
    const committed = parseFloat(participant.investmentCommitment || "0");
    const pContributions = contributions.filter((c) => c.participantId === participant.id);

    let totalContributed = 0;
    let cashContributed = 0;
    let nonCashContributed = 0;

    for (const c of pContributions) {
      const amt = parseFloat(c.amount);
      totalContributed += amt;
      if (c.contributionType === "CASH" || c.contributionType === "PARTNER_LOAN") {
        cashContributed += amt;
      } else {
        nonCashContributed += amt;
      }
    }

    const shortfall = Math.max(0, committed - totalContributed);
    const fundingPct = committed > 0 ? (totalContributed / committed) * 100 : 100;

    return {
      participantId: participant.id,
      partnerId: participant.partnerId,
      name: participant.name,
      isExternal: participant.isExternal,
      roleDescription: participant.role,
      committedCapital: committed,
      profitSharePct: parseFloat(participant.profitSharingPercentage),
      lossSharePct: parseFloat(participant.lossSharingPercentage),
      totalContributed,
      cashContributed,
      nonCashContributed,
      shortfall,
      fundingPct: Math.round(fundingPct * 100) / 100,
    };
  });

  const totalCommitted = participantSummaries.reduce((sum, p) => sum + p.committedCapital, 0);
  const totalContributed = participantSummaries.reduce((sum, p) => sum + p.totalContributed, 0);
  const totalCashContributed = participantSummaries.reduce((sum, p) => sum + p.cashContributed, 0);
  const totalShortfall = participantSummaries.reduce((sum, p) => sum + p.shortfall, 0);

  return {
    agreementMode: fallbackAg?.participationMode || "PROPORTIONAL",
    agreementStatus: fallbackAg?.status || "NONE",
    targetFundAmount: parseFloat(venture?.targetBudget || "0"),
    totalCommitted,
    totalContributed,
    totalCashContributed,
    totalShortfall,
    overallFundingPct: totalCommitted > 0 ? Math.round((totalContributed / totalCommitted) * 10000) / 100 : 100,
    participants: participantSummaries,
  };
}
