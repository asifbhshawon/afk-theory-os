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
import { eq, and, or, sql, desc, gte, lte, inArray } from "drizzle-orm";
import { getEvidenceForEntities } from "./evidence";

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  partnerId?: string;
  memo?: string;
  ventureId?: string;
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
        ventureId: line.ventureId,
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
  const reversingLines = lines.map((l: any) => ({
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

// Create Custom Expense Category / Account
export async function createCustomExpenseCategory(input: {
  name: string;
  description?: string;
  code?: string;
  userId?: string;
}) {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Expense category name is required");

  // Check if account with same name already exists (case-insensitive)
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.group, "EXPENSE"), sql`lower(${accounts.name}) = lower(${trimmedName})`))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  let codeToUse = input.code?.trim();
  if (!codeToUse) {
    // Determine next available code in 6000 operating expenses
    const expAccounts = await db
      .select({ code: accounts.code })
      .from(accounts)
      .where(eq(accounts.group, "EXPENSE"));

    const numericCodes = expAccounts
      .map((a) => parseInt(a.code, 10))
      .filter((n) => !isNaN(n) && n >= 6000 && n < 7000);

    const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 6050;
    codeToUse = String(maxCode + 10);
  }

  const [newAcc] = await db
    .insert(accounts)
    .values({
      code: codeToUse,
      name: trimmedName,
      group: "EXPENSE",
      normalBalance: "DEBIT",
      description: input.description || `Custom expense category: ${trimmedName}`,
      isSystem: false,
      isActive: true,
    })
    .returning();

  if (input.userId) {
    await db.insert(auditLogs).values({
      userId: input.userId,
      action: "CREATE_EXPENSE_ACCOUNT",
      entityType: "ACCOUNT",
      entityId: newAcc.id,
      details: `Created custom expense category ${newAcc.code} - ${newAcc.name}`,
    });
  }

  return newAcc;
}

// Business Expense (from Payment Account, Due to Partner, or Trade Payables)
export async function recordBusinessExpense(data: {
  expenseAccountId?: string;
  customCategoryName?: string;
  paymentAccountId?: string;
  partnerId?: string; // If paid personally by partner
  isSupplierPayable?: boolean; // If unpaid / due to supplier (Trade Payables 2010)
  amount: number;
  description: string;
  reference?: string;
  userId?: string;
  date?: Date;
}) {
  let targetExpenseAccountId = data.expenseAccountId;

  // Auto-create or resolve custom category if provided
  if (data.customCategoryName && data.customCategoryName.trim()) {
    const customAcc = await createCustomExpenseCategory({
      name: data.customCategoryName,
      userId: data.userId,
    });
    targetExpenseAccountId = customAcc.id;
  }

  if (!targetExpenseAccountId || targetExpenseAccountId === "NEW_CUSTOM") {
    throw new Error("Must select an expense category or provide a custom category name.");
  }

  const [expenseAcc] = await db.select().from(accounts).where(eq(accounts.id, targetExpenseAccountId)).limit(1);
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
  } else if (data.isSupplierPayable) {
    const [payableAcc] = await db.select().from(accounts).where(eq(accounts.code, "2010")).limit(1);
    if (!payableAcc) throw new Error("Trade Payables account (2010) not found.");
    creditAccountId = payableAcc.id;
    memo = `Supplier invoice due (Trade Payables)`;
  } else if (data.paymentAccountId) {
    const [payAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.paymentAccountId)).limit(1);
    if (!payAcc) throw new Error("Payment account not found.");
    creditAccountId = payAcc.glAccountId;
    memo = `Paid from ${payAcc.name}`;
  } else {
    throw new Error("Must specify payment account, partner who paid, or mark as supplier payable.");
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

// Partner Drawings / Withdrawals
export async function recordPartnerDrawing(data: {
  partnerId: string;
  amount: number;
  paymentAccountId: string;
  reference?: string;
  userId?: string;
  notes?: string;
  date?: Date;
}) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, data.partnerId)).limit(1);
  if (!partner) throw new Error("Partner not found.");

  const [payAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.paymentAccountId)).limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  const [drawAcc] = await db.select().from(accounts).where(eq(accounts.name, `Partner Drawings - ${partner.name}`)).limit(1);
  if (!drawAcc) throw new Error(`Drawings account not found for ${partner.name}`);

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "DRAWING",
    description: `Partner withdrawal / drawings by ${partner.name}`,
    reference: data.reference,
    sourceModule: "PARTNERS",
    sourceId: partner.id,
    userId: data.userId,
    lines: [
      {
        accountId: drawAcc.id,
        debit: data.amount,
        credit: 0,
        partnerId: partner.id,
        memo: `Drawings withdrawal by ${partner.name}`,
      },
      {
        accountId: payAcc.glAccountId,
        debit: 0,
        credit: data.amount,
        memo: `Disbursed from ${payAcc.name}`,
      },
    ],
  });
}

// Partner Reimbursement / Loan Repayment
export async function recordPartnerReimbursement(data: {
  partnerId: string;
  amount: number;
  paymentAccountId: string;
  reference?: string;
  userId?: string;
  notes?: string;
  date?: Date;
}) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, data.partnerId)).limit(1);
  if (!partner) throw new Error("Partner not found.");

  const [payAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.paymentAccountId)).limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  const [dueAcc] = await db.select().from(accounts).where(eq(accounts.name, `Due to ${partner.name}`)).limit(1);
  if (!dueAcc) throw new Error(`Due to account not found for ${partner.name}`);

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "PARTNER_REIMBURSEMENT",
    description: `Loan reimbursement / repayment to partner ${partner.name}`,
    reference: data.reference,
    sourceModule: "PARTNERS",
    sourceId: partner.id,
    userId: data.userId,
    lines: [
      {
        accountId: dueAcc.id,
        debit: data.amount,
        credit: 0,
        partnerId: partner.id,
        memo: `Repayment of advance due to ${partner.name}`,
      },
      {
        accountId: payAcc.glAccountId,
        debit: 0,
        credit: data.amount,
        memo: `Disbursed from ${payAcc.name}`,
      },
    ],
  });
}

// Transfer funds between cash, bank, bKash, and Nagad payment accounts
export async function transferFunds(data: {
  fromPaymentAccountId: string;
  toPaymentAccountId: string;
  amount: number;
  reference?: string;
  userId?: string;
  date?: Date;
}) {
  if (data.fromPaymentAccountId === data.toPaymentAccountId) {
    throw new Error("Source and destination accounts must be different.");
  }

  const [fromAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.fromPaymentAccountId)).limit(1);
  const [toAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, data.toPaymentAccountId)).limit(1);

  if (!fromAcc || !toAcc) {
    throw new Error("Source or destination payment account not found.");
  }

  return await postJournalEntry({
    date: data.date || new Date(),
    entryType: "TRANSFER",
    description: `Transfer ৳${data.amount.toFixed(2)} from ${fromAcc.name} to ${toAcc.name}`,
    reference: data.reference,
    sourceModule: "FINANCE",
    userId: data.userId,
    lines: [
      {
        accountId: toAcc.glAccountId,
        debit: data.amount,
        credit: 0,
        memo: `Transfer deposit to ${toAcc.name}`,
      },
      {
        accountId: fromAcc.glAccountId,
        debit: 0,
        credit: data.amount,
        memo: `Transfer withdrawal from ${fromAcc.name}`,
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
    const grossDebit = Number(found?.totalDebit || 0);
    const grossCredit = Number(found?.totalCredit || 0);
    const balance = acc.normalBalance === "DEBIT" ? grossDebit - grossCredit : grossCredit - grossDebit;

    // Standard GAAP Net Trial Balance amounts (net ending balances)
    const netDebit =
      acc.normalBalance === "DEBIT"
        ? (balance > 0 ? balance : 0)
        : (balance < 0 ? Math.abs(balance) : 0);

    const netCredit =
      acc.normalBalance === "CREDIT"
        ? (balance > 0 ? balance : 0)
        : (balance < 0 ? Math.abs(balance) : 0);

    return {
      ...acc,
      grossDebit,
      grossCredit,
      debit: netDebit,
      credit: netCredit,
      balance,
    };
  });

  // 1. Trial Balance (Sum of net debit balances == Sum of net credit balances)
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

export interface PartnerTransactionHistoryItem {
  id: string; // journalEntry id
  entryNumber: string;
  date: Date;
  entryType: string;
  description: string;
  reference?: string | null;
  status: string;
  partnerId?: string | null;
  partnerName?: string | null;
  amount: number;
  evidence: any[];
}

export async function getPartnerTransactionHistory(
  partnerId?: string,
  limit = 50
): Promise<PartnerTransactionHistoryItem[]> {
  const entries = await db
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      entryType: journalEntries.entryType,
      description: journalEntries.description,
      reference: journalEntries.reference,
      status: journalEntries.status,
      sourceModule: journalEntries.sourceModule,
      sourceId: journalEntries.sourceId,
    })
    .from(journalEntries)
    .where(
      and(
        inArray(journalEntries.status, ["POSTED", "REVERSED"]),
        partnerId
          ? or(
              and(eq(journalEntries.sourceModule, "PARTNERS"), eq(journalEntries.sourceId, partnerId)),
              eq(journalEntries.sourceId, partnerId)
            )
          : or(
              eq(journalEntries.sourceModule, "PARTNERS"),
              inArray(journalEntries.entryType, [
                "CAPITAL_DEPOSIT",
                "PARTNER_LOAN",
                "PARTNER_DRAWINGS",
                "PARTNER_REIMBURSEMENT",
              ])
            )
      )
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.entryNumber))
    .limit(limit);

  if (entries.length === 0) return [];

  const journalIds = entries.map((e) => e.id);
  const evidenceMap = await getEvidenceForEntities("JOURNAL_ENTRY", journalIds);

  const lines = await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      partnerId: journalLines.partnerId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      memo: journalLines.memo,
      accountId: journalLines.accountId,
    })
    .from(journalLines)
    .where(inArray(journalLines.journalEntryId, journalIds));

  const allPartners = await db.select().from(partners);
  const partnerMap = new Map(allPartners.map((p) => [p.id, p]));

  return entries.map((entry) => {
    const entryLines = lines.filter((l) => l.journalEntryId === entry.id);
    let assignedPartnerId = entry.sourceId;
    if (!assignedPartnerId || !partnerMap.has(assignedPartnerId)) {
      const lineWithPartner = entryLines.find((l) => l.partnerId && partnerMap.has(l.partnerId));
      assignedPartnerId = lineWithPartner?.partnerId || assignedPartnerId;
    }
    const partner = assignedPartnerId ? partnerMap.get(assignedPartnerId) : undefined;

    const amount = entryLines.reduce((max, l) => Math.max(max, Number(l.debit), Number(l.credit)), 0);

    return {
      id: entry.id,
      entryNumber: entry.entryNumber,
      date: entry.date,
      entryType: entry.entryType,
      description: entry.description,
      reference: entry.reference,
      status: entry.status,
      partnerId: partner?.id || null,
      partnerName: partner?.name || null,
      amount,
      evidence: evidenceMap[entry.id] || [],
    };
  });
}
