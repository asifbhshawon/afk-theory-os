import { db } from "@/db";
import {
  journalEntries,
  journalLines,
  accounts,
  paymentAccounts,
  partners,
  fiscalPeriods,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql, desc, gte, lte, inArray } from "drizzle-orm";

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  partnerId?: string;
  memo?: string;
}

export interface CreateJournalEntryInput {
  date: Date;
  entryType: string;
  description: string;
  reference?: string;
  sourceModule?: string;
  sourceId?: string;
  lines: CreateJournalLineInput[];
  userId?: string;
  fiscalPeriodId?: string;
}

// Generate unique sequential journal entry number backed by atomic PostgreSQL sequence (concurrency-safe)
export async function generateJournalNumber(txClient?: any): Promise<string> {
  const client = txClient || db;
  const year = new Date().getFullYear();
  try {
    const res = await client.execute(sql`SELECT nextval('journal_entry_seq') as seq`);
    const seq = String(res.rows[0].seq).padStart(6, "0");
    return `AFK-JRN-${year}-${seq}`;
  } catch {
    await client.execute(sql`CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START WITH 100001`);
    const res = await client.execute(sql`SELECT nextval('journal_entry_seq') as seq`);
    const seq = String(res.rows[0].seq).padStart(6, "0");
    return `AFK-JRN-${year}-${seq}`;
  }
}

// Validate debits == credits and post atomic journal entry, optionally within parent transaction
export async function postJournalEntry(input: CreateJournalEntryInput, txClient?: any) {
  if (!input.lines || input.lines.length < 2) {
    throw new Error("Journal entry must contain at least two lines.");
  }

  // Calculate totals with 2 decimal precision (exact paisa arithmetic)
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of input.lines) {
    totalDebit = Math.round((totalDebit + (line.debit || 0)) * 100) / 100;
    totalCredit = Math.round((totalCredit + (line.credit || 0)) * 100) / 100;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Debit and Credit mismatch! Total Debit: ৳${totalDebit.toFixed(2)}, Total Credit: ৳${totalCredit.toFixed(2)}`
    );
  }

  if (totalDebit <= 0) {
    throw new Error("Journal total amount must be greater than zero.");
  }

  const client = txClient || db;

  // Check if target fiscal period is closed
  const entryDate = input.date;
  const [closedPeriod] = await client
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.isClosed, true),
        lte(fiscalPeriods.startDate, entryDate),
        gte(fiscalPeriods.endDate, entryDate)
      )
    )
    .limit(1);

  if (closedPeriod) {
    throw new Error(
      `Cannot post transaction to closed fiscal period: ${closedPeriod.name}. Only authorised adjustments in an open period are permitted.`
    );
  }

  // Check idempotency reference if provided
  if (input.reference) {
    const [existing] = await client
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.reference, input.reference),
          eq(journalEntries.entryType, input.entryType),
          eq(journalEntries.status, "POSTED")
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Duplicate transaction detected with reference: ${input.reference}`);
    }
  }

  const entryNumber = await generateJournalNumber();

  const executePost = async (tx: any) => {
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        entryNumber,
        date: input.date,
        entryType: input.entryType,
        description: input.description,
        reference: input.reference,
        sourceModule: input.sourceModule,
        sourceId: input.sourceId,
        status: "POSTED",
        postedByUserId: input.userId,
        fiscalPeriodId: input.fiscalPeriodId,
      })
      .returning();

    for (const line of input.lines) {
      await tx.insert(journalLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debit: line.debit.toFixed(2),
        credit: line.credit.toFixed(2),
        partnerId: line.partnerId,
        memo: line.memo,
      });
    }

    if (input.userId) {
      await tx.insert(auditLogs).values({
        userId: input.userId,
        action: "POST_JOURNAL",
        entityType: "JOURNAL",
        entityId: entry.id,
        details: `Posted journal ${entryNumber}: ${input.description} (৳${totalDebit.toFixed(2)})`,
      });
    }

    return entry;
  };

  if (txClient) {
    return await executePost(txClient);
  } else {
    return await db.transaction(async (tx) => {
      return await executePost(tx);
    });
  }
}

// Reverse posted journal entry
export async function reverseJournalEntry(
  journalEntryId: string,
  reason: string,
  userId: string,
  txClient?: any
) {
  const client = txClient || db;
  const [original] = await client
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, journalEntryId))
    .limit(1);

  if (!original) {
    throw new Error("Journal entry not found.");
  }

  if (original.status === "REVERSED") {
    throw new Error("Journal entry is already reversed.");
  }

  const lines = await client
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, original.id));

  // Invert debits and credits
  const reversingLines = lines.map((l) => ({
    accountId: l.accountId,
    debit: Number(l.credit),
    credit: Number(l.debit),
    partnerId: l.partnerId || undefined,
    memo: `Reversal of ${original.entryNumber}: ${l.memo || ""}`,
  }));

  const reversingNumber = await generateJournalNumber();

  const executeReversal = async (tx: any) => {
    // Mark original as reversed
    await tx
      .update(journalEntries)
      .set({ status: "REVERSED" })
      .where(eq(journalEntries.id, original.id));

    // Post reversing entry
    const [reversal] = await tx
      .insert(journalEntries)
      .values({
        entryNumber: reversingNumber,
        date: new Date(),
        entryType: "REVERSAL",
        description: `Reversal of ${original.entryNumber}: ${reason}`,
        reference: original.entryNumber,
        sourceModule: original.sourceModule,
        sourceId: original.sourceId,
        reversalOfId: original.id,
        status: "POSTED",
        postedByUserId: userId,
      })
      .returning();

    for (const rLine of reversingLines) {
      await tx.insert(journalLines).values({
        journalEntryId: reversal.id,
        accountId: rLine.accountId,
        debit: rLine.debit.toFixed(2),
        credit: rLine.credit.toFixed(2),
        partnerId: rLine.partnerId,
        memo: rLine.memo,
      });
    }

    await tx.insert(auditLogs).values({
      userId,
      action: "REVERSE_JOURNAL",
      entityType: "JOURNAL",
      entityId: original.id,
      details: `Reversed journal ${original.entryNumber} with ${reversingNumber}. Reason: ${reason}`,
    });

    return reversal;
  };

  if (txClient) {
    return await executeReversal(txClient);
  } else {
    return await db.transaction(async (tx) => {
      return await executeReversal(tx);
    });
  }
}

// Partner Equity Contribution
export async function recordPartnerContribution(data: {
  partnerId: string;
  amount: number;
  paymentAccountId: string;
  reference?: string;
  userId?: string;
  date?: Date;
}) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, data.partnerId)).limit(1);
  if (!partner) throw new Error("Partner not found.");

  const [payAcc] = await db
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.id, data.paymentAccountId))
    .limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  // Find partner capital account (e.g. "3010 Partner Capital - Shawon")
  const [capitalAcc] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.name, `Partner Capital - ${partner.name}`))
    .limit(1);
  if (!capitalAcc) throw new Error(`Capital account not found for partner ${partner.name}`);

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "CAPITAL_DEPOSIT",
    description: `Equity contribution from partner ${partner.name}`,
    reference: data.reference,
    sourceModule: "PARTNERS",
    sourceId: partner.id,
    userId: data.userId,
    lines: [
      {
        accountId: payAcc.glAccountId,
        debit: data.amount,
        credit: 0,
        memo: `Equity deposit received in ${payAcc.name}`,
      },
      {
        accountId: capitalAcc.id,
        debit: 0,
        credit: data.amount,
        partnerId: partner.id,
        memo: `Capital account credit for ${partner.name}`,
      },
    ],
  });
}

// Partner Loan Received (Repayable advance)
export async function recordPartnerLoan(data: {
  partnerId: string;
  amount: number;
  paymentAccountId: string;
  reference?: string;
  userId?: string;
  date?: Date;
}) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, data.partnerId)).limit(1);
  if (!partner) throw new Error("Partner not found.");

  const [payAcc] = await db
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.id, data.paymentAccountId))
    .limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  const [loanAcc] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.name, `Due to ${partner.name}`))
    .limit(1);
  if (!loanAcc) throw new Error(`Loan account not found for partner ${partner.name}`);

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "PARTNER_LOAN",
    description: `Loan advance received from partner ${partner.name}`,
    reference: data.reference,
    sourceModule: "PARTNERS",
    sourceId: partner.id,
    userId: data.userId,
    lines: [
      {
        accountId: payAcc.glAccountId,
        debit: data.amount,
        credit: 0,
        memo: `Loan funds deposited to ${payAcc.name}`,
      },
      {
        accountId: loanAcc.id,
        debit: 0,
        credit: data.amount,
        partnerId: partner.id,
        memo: `Payable liability to ${partner.name}`,
      },
    ],
  });
}

// Business Expense (from Payment Account or Due to Partner)
export async function recordBusinessExpense(data: {
  expenseAccountId: string;
  paymentAccountId?: string;
  partnerId?: string; // If paid personally by partner
  amount: number;
  description: string;
  reference?: string;
  userId?: string;
  date?: Date;
}) {
  const [expenseAcc] = await db.select().from(accounts).where(eq(accounts.id, data.expenseAccountId)).limit(1);
  if (!expenseAcc) throw new Error("Expense account not found.");

  let creditAccountId: string;
  let memo: string;
  let partnerId = data.partnerId;

  if (data.partnerId) {
    const [partner] = await db.select().from(partners).where(eq(partners.id, data.partnerId)).limit(1);
    if (!partner) throw new Error("Partner not found.");
    const [dueAcc] = await db.select().from(accounts).where(eq(accounts.name, `Due to ${partner.name}`)).limit(1);
    if (!dueAcc) throw new Error(`Due to account not found for ${partner.name}`);
    creditAccountId = dueAcc.id;
    memo = `Paid personally by ${partner.name} (reimbursable)`;
  } else if (data.paymentAccountId) {
    const [payAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.paymentAccountId)).limit(1);
    if (!payAcc) throw new Error("Payment account not found.");
    creditAccountId = payAcc.glAccountId;
    memo = `Paid from ${payAcc.name}`;
  } else {
    throw new Error("Must specify payment account or partner who paid.");
  }

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "EXPENSE",
    description: data.description,
    reference: data.reference,
    sourceModule: "FINANCE",
    userId: data.userId,
    lines: [
      {
        accountId: expenseAcc.id,
        debit: data.amount,
        credit: 0,
        memo: data.description,
      },
      {
        accountId: creditAccountId,
        debit: 0,
        credit: data.amount,
        partnerId,
        memo,
      },
    ],
  });
}

// Financial Statements Generation derived directly from posted journal lines
export async function getFinancialStatements(asOfDate: Date = new Date()) {
  const allAccounts = await db.select().from(accounts);
  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

  // Calculate sum of debits and credits for all posted journal entries up to asOfDate
  const lineTotals = await db
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<string>`coalesce(sum(debit), 0)`,
      totalCredit: sql<string>`coalesce(sum(credit), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        inArray(journalEntries.status, ["POSTED", "REVERSED"]),
        lte(journalEntries.date, asOfDate)
      )
    )
    .groupBy(journalLines.accountId);

  const accountBalances = allAccounts.map((acc) => {
    const found = lineTotals.find((t) => t.accountId === acc.id);
    const debit = Number(found?.totalDebit || 0);
    const credit = Number(found?.totalCredit || 0);
    const balance = acc.normalBalance === "DEBIT" ? debit - credit : credit - debit;
    return {
      ...acc,
      debit,
      credit,
      balance,
    };
  });

  // 1. Trial Balance
  const totalDebit = accountBalances.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accountBalances.reduce((s, a) => s + a.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // 2. Income Statement (P&L)
  const revenueAccounts = accountBalances.filter((a) => a.group === "REVENUE");
  const contraRevenueAccounts = accountBalances.filter((a) => a.group === "CONTRA_REVENUE");
  const cogsAccounts = accountBalances.filter((a) => a.group === "COGS");
  const expenseAccounts = accountBalances.filter((a) => a.group === "EXPENSE");

  const totalGrossRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0);
  const totalReturns = contraRevenueAccounts.reduce((s, a) => s + a.balance, 0);
  const netRevenue = totalGrossRevenue - totalReturns;
  const totalCogs = cogsAccounts.reduce((s, a) => s + a.balance, 0);
  const grossProfit = netRevenue - totalCogs;
  const totalOperatingExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  // 3. Balance Sheet
  const assetAccounts = accountBalances.filter((a) =>
    ["CASH", "RECEIVABLE", "INVENTORY", "WIP", "ASSET"].includes(a.group)
  );
  const liabilityAccounts = accountBalances.filter((a) => a.group === "LIABILITY");
  const capitalAccounts = accountBalances.filter((a) => a.group === "CAPITAL");
  const drawingsAccounts = accountBalances.filter((a) => a.group === "DRAWINGS");

  const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCapitalContributed = capitalAccounts.reduce((s, a) => s + a.balance, 0);
  const totalDrawings = drawingsAccounts.reduce((s, a) => s + a.balance, 0);
  const totalEquity = totalCapitalContributed - totalDrawings + netProfit;

  // 4. Partner Statements
  const allPartners = await db.select().from(partners);
  const partnerStatements = allPartners.map((p) => {
    const capitalAcc = accountBalances.find((a) => a.name === `Partner Capital - ${p.name}`);
    const loanAcc = accountBalances.find((a) => a.name === `Due to ${p.name}`);
    const drawAcc = accountBalances.find((a) => a.name === `Partner Drawings - ${p.name}`);

    const capitalBalance = capitalAcc?.balance || 0;
    const loanBalance = loanAcc?.balance || 0;
    const drawingsBalance = drawAcc?.balance || 0;
    const shareOfNetProfit = (netProfit * Number(p.profitSharePct)) / 100;
    const totalPartnerEquity = capitalBalance - drawingsBalance + shareOfNetProfit;

    return {
      partnerId: p.id,
      name: p.name,
      ownershipPct: Number(p.ownershipPct),
      profitSharePct: Number(p.profitSharePct),
      capitalContributed: capitalBalance,
      drawings: drawingsBalance,
      loanBalanceOwedByCompany: loanBalance,
      shareOfProfit: shareOfNetProfit,
      totalEquity: totalPartnerEquity,
    };
  });

  return {
    asOfDate,
    trialBalance: {
      accounts: accountBalances,
      totalDebit,
      totalCredit,
      isBalanced,
    },
    incomeStatement: {
      revenueAccounts,
      contraRevenueAccounts,
      cogsAccounts,
      expenseAccounts,
      totalGrossRevenue,
      totalReturns,
      netRevenue,
      totalCogs,
      grossProfit,
      totalOperatingExpenses,
      netProfit,
    },
    balanceSheet: {
      assetAccounts,
      liabilityAccounts,
      capitalAccounts,
      drawingsAccounts,
      totalAssets,
      totalLiabilities,
      totalCapitalContributed,
      totalDrawings,
      netProfitRetained: netProfit,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05,
    },
    partnerStatements,
  };
}
