import { db } from "@/db";
import {
  ventures,
  ventureAgreements,
  ventureParticipants,
  ventureContributions,
  ventureProductLinks,
  ventureAllocationSnapshots,
  ventureSettlements,
  ventureSettlementLines,
  salesLines,
  salesOrders,
  inventoryLots,
  journalLines,
  journalEntries,
  accounts,
  paymentAccounts,
  partners,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { postJournalEntry } from "./finance";

export interface ParticipantWaterfallResult {
  participantId: string;
  partnerId?: string | null;
  name: string;
  isExternal: boolean;
  contributedCapital: number;
  capitalReturned: number;
  preferredReturn: number;
  residualProfit: number;
  lossAllocated: number;
  grossDistributed: number;
  reinvestedAmount: number;
  netPayable: number;
  profitSharePct: number;
  lossSharePct: number;
}

export interface WaterfallCalculationResult {
  ventureId: string;
  agreementId: string;
  grossRevenue: number;
  directCogs: number;
  grossMargin: number;
  operatingExpenses: number;
  allocatedOverhead: number;
  netProfit: number;
  retainedReserve: number;
  distributableProfit: number;
  participantResults: ParticipantWaterfallResult[];
  calculationBreakdown: Record<string, any>;
}

// Calculate comprehensive financial performance of a venture
export async function calculateVentureFinancials(ventureId: string): Promise<{
  grossRevenue: number;
  directCogs: number;
  grossMargin: number;
  operatingExpenses: number;
  allocatedOverhead: number;
  netProfit: number;
}> {
  const links = await db
    .select()
    .from(ventureProductLinks)
    .where(eq(ventureProductLinks.ventureId, ventureId));

  const linkedProductIds = links.map((l) => l.productId).filter(Boolean) as string[];

  const taggedLots = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(eq(inventoryLots.ventureId, ventureId));
  const linkedLotIds = taggedLots.map((l) => l.id);

  let grossRevenue = 0;
  let directCogs = 0;

  const allSalesLines = await db
    .select({
      salesLine: salesLines,
      order: salesOrders,
    })
    .from(salesLines)
    .innerJoin(salesOrders, eq(salesLines.salesOrderId, salesOrders.id));

  for (const { salesLine, order } of allSalesLines) {
    if (order.status === "CANCELLED") continue;

    const isMatch =
      salesLine.ventureId === ventureId ||
      (salesLine.lotId ? linkedLotIds.includes(salesLine.lotId) : false);

    if (isMatch) {
      grossRevenue += parseFloat(salesLine.totalPrice);
      directCogs += parseFloat(salesLine.cogsUnitCost || "0") * salesLine.quantity;
    }
  }

  const taggedExpenses = await db
    .select({
      line: journalLines,
      account: accounts,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journalLines.ventureId, ventureId),
        eq(accounts.group, "EXPENSE")
      )
    );

  let operatingExpenses = 0;
  for (const { line } of taggedExpenses) {
    operatingExpenses += parseFloat(line.debit) - parseFloat(line.credit);
  }

  grossRevenue = Math.round(grossRevenue * 100) / 100;
  directCogs = Math.round(directCogs * 100) / 100;
  operatingExpenses = Math.max(0, Math.round(operatingExpenses * 100) / 100);

  const grossMargin = Math.round((grossRevenue - directCogs) * 100) / 100;
  const allocatedOverhead = 0;
  const netProfit = Math.round((grossMargin - operatingExpenses - allocatedOverhead) * 100) / 100;

  return {
    grossRevenue,
    directCogs,
    grossMargin,
    operatingExpenses,
    allocatedOverhead,
    netProfit,
  };
}

// Execute deterministic waterfall calculation
export async function executeWaterfallCalculation(
  ventureId: string,
  customNetProfit?: number
): Promise<WaterfallCalculationResult> {
  const [agreement] = await db
    .select()
    .from(ventureAgreements)
    .where(and(eq(ventureAgreements.ventureId, ventureId), eq(ventureAgreements.status, "APPROVED")))
    .orderBy(desc(ventureAgreements.version))
    .limit(1);

  const activeAgreement = agreement || (
    await db
      .select()
      .from(ventureAgreements)
      .where(eq(ventureAgreements.ventureId, ventureId))
      .orderBy(desc(ventureAgreements.version))
      .limit(1)
  )[0];

  if (!activeAgreement) {
    throw new Error(`No agreement found for venture ${ventureId}.`);
  }

  const participants = await db
    .select()
    .from(ventureParticipants)
    .where(eq(ventureParticipants.agreementId, activeAgreement.id))
    .orderBy(ventureParticipants.capitalRecoveryPriority, ventureParticipants.createdAt);

  if (participants.length === 0) {
    throw new Error("Cannot execute waterfall: Agreement has no participants.");
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

  const financials = await calculateVentureFinancials(ventureId);
  const netProfit = customNetProfit !== undefined ? customNetProfit : financials.netProfit;

  const waterfallRules = (activeAgreement.waterfallRules as any) || {};
  const retainedPct = waterfallRules.retainedReservePct || 0;
  let retainedReserve = 0;
  if (netProfit > 0 && retainedPct > 0) {
    retainedReserve = Math.round(netProfit * (retainedPct / 100) * 100) / 100;
  }

  const distributableProfit = Math.round((netProfit - retainedReserve) * 100) / 100;

  const participantData = participants.map((p) => {
    const pContributions = contributions.filter((c) => c.participantId === p.id);
    const totalContributed = pContributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);

    return {
      participantId: p.id,
      partnerId: p.partnerId,
      name: p.name,
      isExternal: p.isExternal,
      contributedCapital: Math.round(totalContributed * 100) / 100,
      profitSharePct: parseFloat(p.profitSharingPercentage),
      lossSharePct: parseFloat(p.lossSharingPercentage),
      capitalRecoveryPriority: p.capitalRecoveryPriority || 1,
    };
  });

  const participantResults: ParticipantWaterfallResult[] = [];

  if (distributableProfit >= 0) {
    let remainingPool = distributableProfit;
    const isCapitalRecoveryFirst = activeAgreement.participationMode === "CAPITAL_RECOVERY_FIRST";
    const capitalReturnedMap = new Map<string, number>();

    if (isCapitalRecoveryFirst) {
      for (const p of participantData) {
        const canReturn = Math.min(p.contributedCapital, remainingPool);
        const returned = Math.round(canReturn * 100) / 100;
        capitalReturnedMap.set(p.participantId, returned);
        remainingPool = Math.round((remainingPool - returned) * 100) / 100;
      }
    }

    const residualPaisa = Math.round(remainingPool * 100);
    let runningResidualPaisa = 0;
    const residualMap = new Map<string, number>();

    const activeParticipants = participantData.filter((p) => p.profitSharePct > 0);

    for (let i = 0; i < activeParticipants.length; i++) {
      const p = activeParticipants[i];
      if (i === activeParticipants.length - 1) {
        const lastPaisa = Math.max(0, residualPaisa - runningResidualPaisa);
        residualMap.set(p.participantId, lastPaisa / 100);
      } else {
        const pPaisa = Math.floor(residualPaisa * (p.profitSharePct / 100));
        runningResidualPaisa += pPaisa;
        residualMap.set(p.participantId, pPaisa / 100);
      }
    }

    const reinvestmentPct = waterfallRules.reinvestmentPct || 0;

    for (const p of participantData) {
      const capRet = capitalReturnedMap.get(p.participantId) || 0;
      const resProfit = residualMap.get(p.participantId) || 0;
      const grossDist = Math.round((capRet + resProfit) * 100) / 100;

      let reinvestedAmt = 0;
      if (reinvestmentPct > 0 && resProfit > 0) {
        reinvestedAmt = Math.round(resProfit * (reinvestmentPct / 100) * 100) / 100;
      }

      const netPayable = Math.max(0, Math.round((grossDist - reinvestedAmt) * 100) / 100);

      participantResults.push({
        participantId: p.participantId,
        partnerId: p.partnerId,
        name: p.name,
        isExternal: p.isExternal,
        contributedCapital: p.contributedCapital,
        capitalReturned: capRet,
        preferredReturn: 0,
        residualProfit: resProfit,
        lossAllocated: 0,
        grossDistributed: grossDist,
        reinvestedAmount: reinvestedAmt,
        netPayable,
        profitSharePct: p.profitSharePct,
        lossSharePct: p.lossSharePct,
      });
    }
  } else {
    const absoluteLoss = Math.abs(distributableProfit);
    const lossPaisa = Math.round(absoluteLoss * 100);
    let runningLossPaisa = 0;

    const activeLossParticipants = participantData.filter((p) => p.lossSharePct > 0);

    for (let i = 0; i < activeLossParticipants.length; i++) {
      const p = activeLossParticipants[i];
      let pLoss = 0;
      if (i === activeLossParticipants.length - 1) {
        const lastPaisa = Math.max(0, lossPaisa - runningLossPaisa);
        pLoss = lastPaisa / 100;
      } else {
        const pPaisa = Math.floor(lossPaisa * (p.lossSharePct / 100));
        runningLossPaisa += pPaisa;
        pLoss = pPaisa / 100;
      }

      participantResults.push({
        participantId: p.participantId,
        partnerId: p.partnerId,
        name: p.name,
        isExternal: p.isExternal,
        contributedCapital: p.contributedCapital,
        capitalReturned: 0,
        preferredReturn: 0,
        residualProfit: 0,
        lossAllocated: pLoss,
        grossDistributed: 0,
        reinvestedAmount: 0,
        netPayable: 0,
        profitSharePct: p.profitSharePct,
        lossSharePct: p.lossSharePct,
      });
    }

    for (const p of participantData.filter((p) => p.lossSharePct <= 0)) {
      participantResults.push({
        participantId: p.participantId,
        partnerId: p.partnerId,
        name: p.name,
        isExternal: p.isExternal,
        contributedCapital: p.contributedCapital,
        capitalReturned: 0,
        preferredReturn: 0,
        residualProfit: 0,
        lossAllocated: 0,
        grossDistributed: 0,
        reinvestedAmount: 0,
        netPayable: 0,
        profitSharePct: p.profitSharePct,
        lossSharePct: p.lossSharePct,
      });
    }
  }

  const calculationBreakdown = {
    calculatedAt: new Date().toISOString(),
    participationMode: activeAgreement.participationMode,
    lossRecoveryPolicy: activeAgreement.lossRecoveryPolicy,
    financials,
    netProfitInput: netProfit,
    retainedReserve,
    distributableProfit,
  };

  return {
    ventureId,
    agreementId: activeAgreement.id,
    grossRevenue: financials.grossRevenue,
    directCogs: financials.directCogs,
    grossMargin: financials.grossMargin,
    operatingExpenses: financials.operatingExpenses,
    allocatedOverhead: financials.allocatedOverhead,
    netProfit,
    retainedReserve,
    distributableProfit,
    participantResults,
    calculationBreakdown,
  };
}

// Generate unique sequential settlement voucher number
export async function generateSettlementNumber(ventureCode: string, txClient?: any): Promise<string> {
  const client = txClient || db;
  const countRes = await client.execute(
    sql`SELECT COUNT(*)::int as cnt FROM venture_settlements`
  );
  const count = (countRes.rows[0]?.cnt || 0) + 1;
  const seq = String(count).padStart(3, "0");
  return `SETTLE-${ventureCode}-${seq}`;
}

// Create an immutable calculation snapshot and settlement draft
export async function createSettlementSnapshot(
  ventureId: string,
  input: {
    customNetProfit?: number;
    settlementType?: "FULL" | "PARTIAL" | "REINVESTMENT" | "LOSS_CARRYFORWARD";
    notes?: string;
    userId: string;
  }
) {
  return await db.transaction(async (tx) => {
    const [venture] = await tx.select().from(ventures).where(eq(ventures.id, ventureId)).limit(1);
    if (!venture) throw new Error(`Venture ${ventureId} not found.`);

    const result = await executeWaterfallCalculation(ventureId, input.customNetProfit);

    const snapshotNumber = `SNAP-${venture.ventureNumber}-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const [snapshot] = await tx
      .insert(ventureAllocationSnapshots)
      .values({
        ventureId,
        agreementId: result.agreementId,
        snapshotNumber,
        periodStart: venture.startDate || now,
        periodEnd: now,
        grossRevenue: result.grossRevenue.toFixed(2),
        returnsAndAllowances: "0.00",
        netRevenue: result.grossRevenue.toFixed(2),
        cogs: result.directCogs.toFixed(2),
        directExpenses: result.operatingExpenses.toFixed(2),
        sharedAllocatedExpenses: "0.00",
        operatingReserveRetained: result.retainedReserve.toFixed(2),
        netDistributable: result.distributableProfit.toFixed(2),
        calculationBasisJson: result.calculationBreakdown,
        isSettled: false,
        calculatedByUserId: input.userId,
      })
      .returning();

    const settlementNumber = await generateSettlementNumber(venture.ventureNumber, tx);
    const totalSettledAmount = result.participantResults.reduce((acc, p) => acc + p.netPayable, 0);

    const [settlement] = await tx
      .insert(ventureSettlements)
      .values({
        ventureId,
        snapshotId: snapshot.id,
        settlementNumber,
        settlementType: input.settlementType || (result.netProfit >= 0 ? "FULL" : "LOSS_CARRYFORWARD"),
        totalAmount: totalSettledAmount.toFixed(2),
        status: "DRAFT",
      })
      .returning();

    for (const p of result.participantResults) {
      await tx.insert(ventureSettlementLines).values({
        settlementId: settlement.id,
        participantId: p.participantId,
        grossEntitlement: p.grossDistributed.toFixed(2),
        capitalRecovered: p.capitalReturned.toFixed(2),
        profitDistributed: p.residualProfit.toFixed(2),
        lossesCarriedForward: p.lossAllocated.toFixed(2),
        reinvestedAmount: p.reinvestedAmount.toFixed(2),
        netCashPaid: p.netPayable.toFixed(2),
        status: p.reinvestedAmount > 0 ? "REINVESTED" : "PENDING",
      });
    }

    await tx.insert(auditLogs).values({
      userId: input.userId,
      action: "CREATE_SETTLEMENT",
      entityType: "VENTURE_SETTLEMENT",
      entityId: settlement.id,
      details: `Created settlement ${settlementNumber} for venture ${venture.ventureNumber} (Amount: ৳${totalSettledAmount.toFixed(2)})`,
    });

    return {
      snapshot,
      settlement,
      result,
    };
  });
}

// Approve settlement
export async function approveSettlement(
  settlementId: string,
  user: { id: string; roles: string[] }
) {
  if (!user.roles.includes("FINANCE_APPROVER") && !user.roles.includes("ADMIN")) {
    throw new Error("Authorisation failure: Only FINANCE_APPROVER or ADMIN can approve settlements.");
  }

  return await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(ventureSettlements)
      .where(eq(ventureSettlements.id, settlementId))
      .limit(1);

    if (!settlement) throw new Error("Settlement not found.");
    if (settlement.status !== "DRAFT") {
      throw new Error(`Cannot approve settlement in status ${settlement.status}.`);
    }

    const [updated] = await tx
      .update(ventureSettlements)
      .set({
        status: "APPROVED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
      })
      .where(eq(ventureSettlements.id, settlementId))
      .returning();

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "APPROVE_SETTLEMENT",
      entityType: "VENTURE_SETTLEMENT",
      entityId: settlementId,
      details: `Approved settlement ${settlement.settlementNumber}`,
    });

    return updated;
  });
}

// Disburse settlement and post atomic double-entry GL journals
export async function disburseSettlement(
  settlementId: string,
  input: {
    paymentAccountId: string;
    disbursementDate?: string | Date;
    user: { id: string; roles: string[] };
    notes?: string;
  }
) {
  if (!input.user.roles.includes("FINANCE_MGR") && !input.user.roles.includes("ADMIN")) {
    throw new Error("Authorisation failure: Only FINANCE_MGR or ADMIN can disburse settlements.");
  }

  return await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(ventureSettlements)
      .where(eq(ventureSettlements.id, settlementId))
      .limit(1);

    if (!settlement) throw new Error("Settlement not found.");
    if (settlement.status !== "APPROVED") {
      throw new Error(`Cannot disburse settlement: must be in APPROVED status (currently ${settlement.status}).`);
    }

    const [venture] = await tx
      .select()
      .from(ventures)
      .where(eq(ventures.id, settlement.ventureId))
      .limit(1);

    const [pa] = await tx
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.id, input.paymentAccountId))
      .limit(1);

    if (!pa) throw new Error("Specified disbursement payment account not found.");

    const lines = await tx
      .select()
      .from(ventureSettlementLines)
      .where(eq(ventureSettlementLines.settlementId, settlementId));

    const totalPayable = lines.reduce((acc, l) => acc + parseFloat(l.netCashPaid), 0);

    let journalId: string | null = null;

    if (totalPayable > 0) {
      const [partnerClearing] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.code, "2110"))
        .limit(1);

      if (partnerClearing) {
        const jEntry = await postJournalEntry(
          {
            date: input.disbursementDate ? new Date(input.disbursementDate) : new Date(),
            entryType: "PAYMENT",
            description: `Settlement Disbursement ${settlement.settlementNumber} for ${venture.ventureNumber}`,
            sourceModule: "VENTURES",
            sourceId: venture.id,
            userId: input.user.id,
            lines: [
              {
                accountId: partnerClearing.id,
                debit: totalPayable,
                credit: 0,
                memo: `Venture payout for ${venture.ventureNumber}`,
                ventureId: venture.id,
              },
              {
                accountId: pa.glAccountId,
                debit: 0,
                credit: totalPayable,
                memo: `Payment Account payout (${pa.name}) for ${settlement.settlementNumber}`,
                ventureId: venture.id,
              },
            ],
          },
          tx
        );
        journalId = jEntry.id;
      }
    }

    await tx
      .update(ventureSettlementLines)
      .set({ status: "PAID" })
      .where(eq(ventureSettlementLines.settlementId, settlementId));

    const [disbursed] = await tx
      .update(ventureSettlements)
      .set({
        status: "PAID",
        paidAt: input.disbursementDate ? new Date(input.disbursementDate) : new Date(),
        paymentAccountId: input.paymentAccountId,
        journalEntryId: journalId,
      })
      .where(eq(ventureSettlements.id, settlementId))
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.user.id,
      action: "DISBURSE_SETTLEMENT",
      entityType: "VENTURE_SETTLEMENT",
      entityId: settlementId,
      details: `Disbursed settlement ${settlement.settlementNumber} (৳${totalPayable.toFixed(2)}) from ${pa.name}`,
    });

    return disbursed;
  });
}

// Get all settlements for a venture
export async function getVentureSettlements(ventureId: string) {
  const rows = await db
    .select({
      settlement: ventureSettlements,
      snapshot: ventureAllocationSnapshots,
      paymentAccount: paymentAccounts,
      journal: journalEntries,
    })
    .from(ventureSettlements)
    .leftJoin(ventureAllocationSnapshots, eq(ventureSettlements.snapshotId, ventureAllocationSnapshots.id))
    .leftJoin(paymentAccounts, eq(ventureSettlements.paymentAccountId, paymentAccounts.id))
    .leftJoin(journalEntries, eq(ventureSettlements.journalEntryId, journalEntries.id))
    .where(eq(ventureSettlements.ventureId, ventureId))
    .orderBy(desc(ventureSettlements.createdAt));

  const result = [];
  for (const r of rows) {
    const lines = await db
      .select({
        line: ventureSettlementLines,
        participant: ventureParticipants,
      })
      .from(ventureSettlementLines)
      .innerJoin(ventureParticipants, eq(ventureSettlementLines.participantId, ventureParticipants.id))
      .where(eq(ventureSettlementLines.settlementId, r.settlement.id));

    result.push({
      ...r.settlement,
      totalSettledAmount: parseFloat(r.settlement.totalAmount),
      paymentAccountName: r.paymentAccount?.name || null,
      journalNumber: r.journal?.entryNumber || null,
      snapshotNumber: r.snapshot?.snapshotNumber || null,
      lines: lines.map((l) => ({
        ...l.line,
        partnerName: l.participant.name,
        capitalReturned: parseFloat(l.line.capitalRecovered),
        preferredReturn: 0,
        residualProfit: parseFloat(l.line.profitDistributed),
        reinvestedAmount: parseFloat(l.line.reinvestedAmount),
        netPayable: parseFloat(l.line.netCashPaid),
      })),
    });
  }

  return result;
}
