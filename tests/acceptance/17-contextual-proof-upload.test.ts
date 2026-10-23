import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/db";
import {
  partners,
  paymentAccounts,
  journalEntries,
  journalLines,
  accounts,
  documents,
  documentLinks,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { postFinancialTransactionWithEvidence } from "@/server/services/finance-with-evidence";
import {
  getEvidenceForEntity,
  getEvidenceForEntities,
  storeEvidence,
  linkDocumentToEntity,
  STORAGE_DIR,
} from "@/server/services/evidence";
import {
  getPartnerTransactionHistory,
  getFinancialStatements,
} from "@/server/services/finance";
import { createLocalBackup } from "@/server/services/backup";

describe("Acceptance Suite 17: Contextual Proof & Evidence Upload Engine", () => {
  let testUserId: string;
  let midhatPartner: any;
  let shawonPartner: any;
  let bracBankAcc: any;
  let cashAcc: any;
  let rentExpenseAcc: any;

  beforeAll(async () => {
    // 1. Get or create test user
    const [u] = await db.select().from(users).limit(1);
    if (u) {
      testUserId = u.id;
    } else {
      const [newU] = await db
        .insert(users)
        .values({
          email: "contextual_test@afktheory.local",
          name: "Contextual Tester",
          passwordHash: "test_hash",
          status: "ACTIVE",
        })
        .returning();
      testUserId = newU.id;
    }

    // 2. Fetch partners
    const allPartners = await db.select().from(partners);
    midhatPartner = allPartners.find((p) => p.name === "Midhat") || allPartners[0];
    shawonPartner = allPartners.find((p) => p.name === "Shawon") || allPartners[1];

    // 3. Fetch payment accounts
    const allPay = await db.select().from(paymentAccounts);
    bracBankAcc = allPay.find((a) => a.name.includes("Bank")) || allPay[0];
    cashAcc = allPay.find((a) => a.name.includes("Cash")) || allPay[1];

    // 4. Fetch expense account
    const allAccs = await db.select().from(accounts);
    rentExpenseAcc = allAccs.find((a) => a.group === "EXPENSE") || allAccs[0];
  });

  describe("Test A: Partner Capital Contribution with Contextual Proof", () => {
    it("posts capital contribution and links WebP proof atomically to journal and partner", async () => {
      // 1. Generate test screenshot image (PNG)
      const pngBuffer = await sharp({
        create: {
          width: 500,
          height: 350,
          channels: 4,
          background: { r: 34, g: 197, b: 94, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const uniqueRef = `DEP-REF-${Date.now()}`;

      // 2. Post capital contribution with evidence in one step
      const result = await postFinancialTransactionWithEvidence({
        action: "PARTNER_CONTRIBUTION",
        partnerId: midhatPartner.id,
        paymentAccountId: bracBankAcc.id,
        amount: 10000,
        reference: uniqueRef,
        description: "Midhat capital contribution with bank slip",
        files: [
          {
            buffer: pngBuffer,
            originalName: "Bank_Deposit_Challan.png",
            mimeType: "image/png",
            category: "PAYMENT_PROOF",
            displayTitle: "BRAC Bank Deposit Challan",
          },
        ],
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.journal).toBeDefined();
      expect(result.journal.entryType).toBe("CAPITAL_DEPOSIT");
      expect(result.documents.length).toBe(1);

      const savedDoc = result.documents[0];
      // Mandatory WebP verification
      expect(savedDoc.mimeType).toBe("image/webp");
      expect(savedDoc.filename.endsWith(".webp")).toBe(true);
      expect(savedDoc.thumbnailPath).toBeDefined();
      expect(savedDoc.entityType).toBe("JOURNAL_ENTRY");
      expect(savedDoc.entityId).toBe(result.journal.id);

      // Verify file exists on local disk
      const filePath = path.resolve(process.cwd(), STORAGE_DIR, savedDoc.storagePath);
      expect(fs.existsSync(filePath)).toBe(true);

      // 3. Verify query for JOURNAL_ENTRY entity returns the proof
      const journalEvidence = await getEvidenceForEntity("JOURNAL_ENTRY", result.journal.id);
      expect(journalEvidence.length).toBe(1);
      expect(journalEvidence[0].id).toBe(savedDoc.id);

      // 4. Verify query for PARTNER entity returns the proof
      const partnerEvidence = await getEvidenceForEntity("PARTNER", midhatPartner.id);
      const foundMidhatDoc = partnerEvidence.find((d) => d.id === savedDoc.id);
      expect(foundMidhatDoc).toBeDefined();

      // 5. Verify isolation: Shawon's partner evidence does NOT show Midhat's proof
      const shawonEvidence = await getEvidenceForEntity("PARTNER", shawonPartner.id);
      const foundShawonDoc = shawonEvidence.find((d) => d.id === savedDoc.id);
      expect(foundShawonDoc).toBeUndefined();

      // 6. Verify partner history query retrieves this transaction with attached evidence
      const history = await getPartnerTransactionHistory(midhatPartner.id);
      const historyItem = history.find((h) => h.id === result.journal.id);
      expect(historyItem).toBeDefined();
      expect(historyItem?.evidence.length).toBe(1);
      expect(historyItem?.evidence[0].id).toBe(savedDoc.id);
    });
  });

  describe("Test B: Partner Loan with Bank Slip Proof", () => {
    it("records partner loan and links proof to liability record", async () => {
      const jpgBuffer = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 3,
          background: { r: 245, g: 158, b: 11 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      const loanRef = `LOAN-REF-${Date.now()}`;

      const result = await postFinancialTransactionWithEvidence({
        action: "PARTNER_LOAN",
        partnerId: shawonPartner.id,
        paymentAccountId: bracBankAcc.id,
        amount: 25000,
        reference: loanRef,
        description: "Shawon temporary liquidity advance",
        files: [
          {
            buffer: jpgBuffer,
            originalName: "Loan_Bank_Transfer.jpg",
            mimeType: "image/jpeg",
            category: "PAYMENT_PROOF",
            displayTitle: "Loan Bank Transfer Advice",
          },
        ],
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.journal.entryType).toBe("PARTNER_LOAN");
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].mimeType).toBe("image/webp");

      // Verify attached evidence is linked to journal
      const evidence = await getEvidenceForEntity("JOURNAL_ENTRY", result.journal.id);
      expect(evidence.length).toBe(1);
      expect(evidence[0].displayTitle).toBe("Loan Bank Transfer Advice");
    });
  });

  describe("Test C: Business Expense with Multiple Attachments", () => {
    it("posts business expense and links multiple receipts to journal and expense record", async () => {
      // Create receipt 1
      const receipt1 = await sharp({
        create: {
          width: 300,
          height: 500,
          channels: 4,
          background: { r: 100, g: 116, b: 139, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // Create receipt 2
      const receipt2 = await sharp({
        create: {
          width: 300,
          height: 500,
          channels: 4,
          background: { r: 71, g: 85, b: 105, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const expenseRef = `EXP-REF-${Date.now()}`;

      const result = await postFinancialTransactionWithEvidence({
        action: "EXPENSE",
        expenseAccountId: rentExpenseAcc.id,
        paymentAccountId: cashAcc.id,
        amount: 8500,
        reference: expenseRef,
        description: "Studio lighting and fabric sample procurement",
        files: [
          {
            buffer: receipt1,
            originalName: "Cash_Memo_Lighting.png",
            mimeType: "image/png",
            category: "RECEIPT",
            displayTitle: "Lighting Store Cash Memo",
          },
          {
            buffer: receipt2,
            originalName: "Islampur_Fabric_Slip.png",
            mimeType: "image/png",
            category: "RECEIPT",
            displayTitle: "Islampur Fabric Delivery Memo",
          },
        ],
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.journal.entryType).toBe("EXPENSE");
      expect(result.documents.length).toBe(2);

      // Verify both are WebP
      expect(result.documents[0].mimeType).toBe("image/webp");
      expect(result.documents[1].mimeType).toBe("image/webp");

      // Verify both are retrievable for this journal entry
      const evidence = await getEvidenceForEntity("JOURNAL_ENTRY", result.journal.id);
      expect(evidence.length).toBe(2);
    });
  });

  describe("Test D: Inter-Account Transfer with Evidence", () => {
    it("transfers funds between accounts and links payment confirmation slip", async () => {
      const transferSlip = await sharp({
        create: {
          width: 450,
          height: 300,
          channels: 4,
          background: { r: 59, g: 130, b: 246, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const transferRef = `TRF-${Date.now()}`;

      const result = await postFinancialTransactionWithEvidence({
        action: "TRANSFER",
        fromPaymentAccountId: bracBankAcc.id,
        toPaymentAccountId: cashAcc.id,
        amount: 5000,
        reference: transferRef,
        files: [
          {
            buffer: transferSlip,
            originalName: "ATM_Withdrawal_Challan.png",
            mimeType: "image/png",
            category: "PAYMENT_PROOF",
            displayTitle: "ATM Cash Withdrawal Slip",
          },
        ],
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.journal.entryType).toBe("TRANSFER");
      expect(result.documents.length).toBe(1);

      const evidence = await getEvidenceForEntity("JOURNAL_ENTRY", result.journal.id);
      expect(evidence.length).toBe(1);
      expect(evidence[0].displayTitle).toBe("ATM Cash Withdrawal Slip");
    });
  });

  describe("Test E: Add Proof to Existing Record (Mode B)", () => {
    it("attaches additional evidence to an existing posted transaction without modifying journal balances", async () => {
      // 1. Post a contribution without initial evidence
      const initialContrib = await postFinancialTransactionWithEvidence({
        action: "PARTNER_CONTRIBUTION",
        partnerId: midhatPartner.id,
        paymentAccountId: bracBankAcc.id,
        amount: 15000,
        reference: `NO-PROOF-${Date.now()}`,
        description: "Initial deposit pending bank advice",
        userId: testUserId,
      });

      expect(initialContrib.success).toBe(true);
      expect(initialContrib.documents.length).toBe(0);

      // Verify no evidence attached initially
      const beforeEvidence = await getEvidenceForEntity("JOURNAL_ENTRY", initialContrib.journal.id);
      expect(beforeEvidence.length).toBe(0);

      // 2. Later: User attaches late proof to existing record
      const lateProof = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 4,
          background: { r: 168, g: 85, b: 247, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const storedDoc = await storeEvidence({
        fileBuffer: lateProof,
        originalName: "Late_Received_Bank_Receipt.png",
        mimeType: "image/png",
        module: "PARTNERS",
        entityType: "JOURNAL_ENTRY",
        entityId: initialContrib.journal.id,
        referenceId: initialContrib.journal.entryNumber,
        category: "PAYMENT_PROOF",
        displayTitle: "Bank Certified Deposit Advice",
        uploadedByUserId: testUserId,
      });

      // Link to partner as well
      await linkDocumentToEntity(
        storedDoc.id,
        "PARTNER",
        midhatPartner.id,
        "SUPPORTING",
        "Late attached bank receipt",
        testUserId
      );

      // 3. Verify evidence is now attached
      const afterEvidence = await getEvidenceForEntity("JOURNAL_ENTRY", initialContrib.journal.id);
      expect(afterEvidence.length).toBe(1);
      expect(afterEvidence[0].displayTitle).toBe("Bank Certified Deposit Advice");

      // 4. Verify journal entry itself remained unchanged (immutable double-entry)
      const [persistedJournal] = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.id, initialContrib.journal.id));

      expect(persistedJournal.status).toBe("POSTED");
      expect(persistedJournal.entryNumber).toBe(initialContrib.journal.entryNumber);
    });
  });

  describe("Test F: Failed Validation Aborts Financial Posting", () => {
    it("aborts transaction if evidence format is invalid and posts no partial journal", async () => {
      const corruptBuffer = Buffer.from("NOT_A_VALID_IMAGE_OR_PDF_BUFFER_12345");

      await expect(
        postFinancialTransactionWithEvidence({
          action: "PARTNER_CONTRIBUTION",
          partnerId: midhatPartner.id,
          paymentAccountId: bracBankAcc.id,
          amount: 5000,
          reference: "FAIL-TEST",
          files: [
            {
              buffer: corruptBuffer,
              originalName: "corrupt.exe",
              mimeType: "application/octet-stream",
            },
          ],
          userId: testUserId,
        })
      ).rejects.toThrow();

      // Verify no journal entry was posted with this reference
      const [failedEntry] = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.reference, "FAIL-TEST"));

      expect(failedEntry).toBeUndefined();
    });
  });

  describe("Test G: Batch Entity Evidence Lookup (N+1 Prevention)", () => {
    it("fetches evidence for multiple journals in a single query", async () => {
      // Fetch 5 journal entries
      const entries = await db.select().from(journalEntries).limit(5);
      const entryIds = entries.map((e) => e.id);

      const evidenceMap = await getEvidenceForEntities("JOURNAL_ENTRY", entryIds);
      expect(evidenceMap).toBeDefined();

      for (const id of entryIds) {
        expect(Array.isArray(evidenceMap[id])).toBe(true);
      }
    });
  });
});
