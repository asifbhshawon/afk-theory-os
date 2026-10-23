import { db } from "@/db";
import {
  recordPartnerContribution,
  recordPartnerLoan,
  recordPartnerDrawing,
  recordPartnerReimbursement,
  recordBusinessExpense,
  transferFunds,
} from "./finance";
import {
  storeEvidence,
  linkDocumentToEntity,
  detectFormatFromBuffer,
  processImageToWebP,
} from "./evidence";
import { journalEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface TransactionWithEvidenceInput {
  action:
    | "PARTNER_CONTRIBUTION"
    | "PARTNER_LOAN"
    | "PARTNER_DRAWING"
    | "PARTNER_REIMBURSEMENT"
    | "EXPENSE"
    | "TRANSFER";
  partnerId?: string;
  paymentAccountId?: string;
  amount: number;
  reference?: string;
  description?: string;
  // Expense fields
  expenseAccountId?: string;
  customCategoryName?: string;
  // Transfer fields
  fromPaymentAccountId?: string;
  toPaymentAccountId?: string;
  // Attached files
  files?: Array<{
    buffer: Buffer;
    originalName: string;
    mimeType?: string;
    category?: string;
    description?: string;
    displayTitle?: string;
  }>;
  userId: string;
  idempotencyKey?: string;
}

export async function postFinancialTransactionWithEvidence(input: TransactionWithEvidenceInput) {
  if (!input.amount || input.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  // Idempotency check if key provided
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.reference, input.idempotencyKey))
      .limit(1);

    if (existing) {
      return {
        success: true,
        journal: existing,
        documents: [],
        isDuplicate: true,
      };
    }
  }

  // Pre-validate all attached files before executing financial journal
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      if (file.buffer.length > 30 * 1024 * 1024) {
        throw new Error(`File "${file.originalName}" exceeds the maximum allowed size of 30MB.`);
      }
      // Validates format (JPEG, PNG, WebP, PDF, etc.)
      const format = detectFormatFromBuffer(file.buffer);
      if (!format.isImage && !format.isPdf) {
        throw new Error(`File "${file.originalName}" has an unsupported format.`);
      }
    }
  }

  // 1. Post the appropriate double-entry financial journal
  let journal: any;
  const refToUse = input.reference || input.idempotencyKey || undefined;

  switch (input.action) {
    case "PARTNER_CONTRIBUTION":
      if (!input.partnerId || !input.paymentAccountId) {
        throw new Error("Partner and receiving account are required for capital contribution.");
      }
      journal = await recordPartnerContribution({
        partnerId: input.partnerId,
        paymentAccountId: input.paymentAccountId,
        amount: input.amount,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    case "PARTNER_LOAN":
      if (!input.partnerId || !input.paymentAccountId) {
        throw new Error("Partner and receiving account are required for partner loan.");
      }
      journal = await recordPartnerLoan({
        partnerId: input.partnerId,
        paymentAccountId: input.paymentAccountId,
        amount: input.amount,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    case "PARTNER_DRAWING":
      if (!input.partnerId || !input.paymentAccountId) {
        throw new Error("Partner and disbursing account are required for drawings.");
      }
      journal = await recordPartnerDrawing({
        partnerId: input.partnerId,
        paymentAccountId: input.paymentAccountId,
        amount: input.amount,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    case "PARTNER_REIMBURSEMENT":
      if (!input.partnerId || !input.paymentAccountId) {
        throw new Error("Partner and disbursing account are required for loan repayment.");
      }
      journal = await recordPartnerReimbursement({
        partnerId: input.partnerId,
        paymentAccountId: input.paymentAccountId,
        amount: input.amount,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    case "EXPENSE":
      if ((!input.expenseAccountId && !input.customCategoryName) || !input.description) {
        throw new Error("Expense category, description, and funding source are required.");
      }
      journal = await recordBusinessExpense({
        expenseAccountId: input.expenseAccountId === "NEW_CUSTOM" ? undefined : input.expenseAccountId,
        customCategoryName: input.customCategoryName,
        paymentAccountId: input.paymentAccountId,
        partnerId: input.partnerId,
        amount: input.amount,
        description: input.description,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    case "TRANSFER":
      if (!input.fromPaymentAccountId || !input.toPaymentAccountId) {
        throw new Error("Source and destination accounts are required for funds transfer.");
      }
      journal = await transferFunds({
        fromPaymentAccountId: input.fromPaymentAccountId,
        toPaymentAccountId: input.toPaymentAccountId,
        amount: input.amount,
        reference: refToUse,
        userId: input.userId,
      });
      break;

    default:
      throw new Error(`Unsupported transaction action: ${input.action}`);
  }

  // 2. Attach and link all validated evidence files
  const savedDocuments: any[] = [];
  const moduleName = input.action.startsWith("PARTNER_") ? "PARTNERS" : "FINANCE";
  const defaultCategory = input.action.startsWith("PARTNER_") ? "PAYMENT_PROOF" : "RECEIPT";

  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      try {
        const doc = await storeEvidence({
          fileBuffer: file.buffer,
          originalName: file.originalName,
          mimeType: file.mimeType,
          module: moduleName,
          entityType: "JOURNAL_ENTRY",
          entityId: journal.id,
          referenceId: journal.entryNumber,
          category: file.category || defaultCategory,
          description: file.description || input.description || `Attached to ${journal.entryNumber}`,
          displayTitle: file.displayTitle || file.originalName,
          uploadedByUserId: input.userId,
        });

        // If partner is involved, create secondary link to PARTNER entity
        if (input.partnerId) {
          await linkDocumentToEntity(
            doc.id,
            "PARTNER",
            input.partnerId,
            "SUPPORTING",
            `Proof for transaction ${journal.entryNumber}`,
            input.userId
          );
        }

        savedDocuments.push(doc);
      } catch (err: any) {
        console.error(`Failed to store evidence "${file.originalName}":`, err);
        // Note: Even if secondary link fails, document is saved with primary link to journal
      }
    }
  }

  return {
    success: true,
    journal,
    documents: savedDocuments,
  };
}
