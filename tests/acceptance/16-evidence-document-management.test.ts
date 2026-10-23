import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/db";
import { documents, documentLinks, users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  storeEvidence,
  verifyEvidence,
  deleteDocument,
  getEvidenceForEntity,
  linkDocumentToEntity,
  unlinkDocumentFromEntity,
  listDocuments,
  updateDocumentMetadata,
  resolveStoragePath,
  detectFormatFromBuffer,
  processImageToWebP,
  STORAGE_DIR,
} from "@/server/services/evidence";
import { createLocalBackup } from "@/server/services/backup";

describe("Acceptance Suite 16: Universal Evidence, WebP Conversion & Document Engine", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Find or create test user
    const [u] = await db.select().from(users).limit(1);
    if (u) {
      testUserId = u.id;
    } else {
      const [newU] = await db
        .insert(users)
        .values({
          email: "evidence_tester@afktheory.local",
          name: "Evidence Tester",
          passwordHash: "test_hash",
          status: "ACTIVE",
        })
        .returning();
      testUserId = newU.id;
    }
  });

  describe("1. Sharp WebP Image Processing & Validation", () => {
    it("converts PNG raster images to WebP with auto orientation and generates WebP thumbnail", async () => {
      // Create a 400x300 PNG buffer
      const pngBuffer = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 4,
          background: { r: 52, g: 60, b: 72, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const { webpBuffer, thumbnailBuffer, width, height } = await processImageToWebP(pngBuffer);

      // Validate output is WebP
      const webpMeta = await sharp(webpBuffer).metadata();
      expect(webpMeta.format).toBe("webp");
      expect(width).toBe(400);
      expect(height).toBe(300);

      // Validate WebP thumbnail fits within 240x240 inside fit
      const thumbMeta = await sharp(thumbnailBuffer).metadata();
      expect(thumbMeta.format).toBe("webp");
      expect(thumbMeta.width!).toBeLessThanOrEqual(240);
      expect(thumbMeta.height!).toBeLessThanOrEqual(240);
    });

    it("stores image evidence on disk strictly as WebP and records database metadata", async () => {
      // Create a 500x500 JPEG buffer
      const jpegBuffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 120, g: 150, b: 80 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      const doc = await storeEvidence({
        fileBuffer: jpegBuffer,
        originalName: "bKash_Transfer_Screenshot.jpg",
        mimeType: "image/jpeg",
        module: "FINANCE",
        referenceId: "TRX-BKASH-99881",
        category: "PAYMENT_PROOF",
        displayTitle: "Fabric Supplier bKash Payment",
        description: "Advance deposit to fabric mill for autumn drop",
        uploadedByUserId: testUserId,
      });

      expect(doc.id).toBeDefined();
      expect(doc.mimeType).toBe("image/webp");
      expect(doc.originalMimeType).toBe("image/jpeg");
      expect(doc.filename.endsWith(".webp")).toBe(true);
      expect(doc.thumbnailPath).toBeDefined();
      expect(doc.thumbnailPath!.endsWith(".webp")).toBe(true);
      expect(doc.verificationStatus).toBe("PENDING");

      // Verify file exists on disk
      const filePath = resolveStoragePath(doc.storagePath);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileContent = fs.readFileSync(filePath);
      const sha256 = crypto.createHash("sha256").update(fileContent).digest("hex");
      expect(sha256).toBe(doc.fileHash);

      // Verify thumbnail exists on disk
      const thumbPath = resolveStoragePath(doc.thumbnailPath!);
      expect(fs.existsSync(thumbPath)).toBe(true);
    });
  });

  describe("2. PDF Document Handling & Preservation", () => {
    it("preserves original PDF intact without converting whole PDF to WebP", async () => {
      // Minimal valid PDF buffer
      const pdfString = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n164\n%%EOF`;
      const pdfBuffer = Buffer.from(pdfString, "utf8");

      const doc = await storeEvidence({
        fileBuffer: pdfBuffer,
        originalName: "Partnership_Founding_Agreement.pdf",
        mimeType: "application/pdf",
        module: "VENTURES",
        referenceId: "VEN-2026-AGR",
        category: "AGREEMENT",
        displayTitle: "Signed Five-Partner MoU Agreement",
        uploadedByUserId: testUserId,
      });

      expect(doc.id).toBeDefined();
      expect(doc.mimeType).toBe("application/pdf");
      expect(doc.filename.endsWith(".pdf")).toBe(true);
      expect(doc.thumbnailPath).toBeNull();

      // Verify disk storage
      const filePath = resolveStoragePath(doc.storagePath);
      expect(fs.existsSync(filePath)).toBe(true);
      const diskBytes = fs.readFileSync(filePath);
      expect(diskBytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    });
  });

  describe("3. Security & Injection Defense", () => {
    it("rejects malicious SVG and HTML scripts disguised as images", () => {
      const maliciousSvg = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
      expect(() => detectFormatFromBuffer(maliciousSvg)).toThrow("Security violation: SVG and HTML scripts are forbidden");

      const maliciousHtml = Buffer.from("<!DOCTYPE html><html><body><script>maliciousCode()</script></body></html>");
      expect(() => detectFormatFromBuffer(maliciousHtml)).toThrow("Security violation: SVG and HTML scripts are forbidden");
    });

    it("rejects Windows and Linux executable binaries", () => {
      const windowsExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      expect(() => detectFormatFromBuffer(windowsExe)).toThrow("Security violation: Windows executables (.exe, .dll) are forbidden");

      const linuxElf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF header
      expect(() => detectFormatFromBuffer(linuxElf)).toThrow("Security violation: Linux binaries are forbidden");
    });

    it("prevents directory traversal attacks via resolveStoragePath", () => {
      expect(() => resolveStoragePath("../../../Windows/System32/cmd.exe")).toThrow();
      expect(() => resolveStoragePath("../../etc/shadow")).toThrow();
    });
  });

  describe("4. Verification Workflow & Audit Trail", () => {
    it("handles full lifecycle PENDING -> VERIFIED and records audit logs", async () => {
      const imgBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toBuffer();

      const doc = await storeEvidence({
        fileBuffer: imgBuffer,
        originalName: "Courier_Settlement_Slip.png",
        category: "DELIVERY_PROOF",
        uploadedByUserId: testUserId,
      });

      expect(doc.verificationStatus).toBe("PENDING");

      // Partner verifies the evidence
      const verified = await verifyEvidence({
        documentId: doc.id,
        status: "VERIFIED",
        notes: "Confirmed COD settlement received via Steadfast courier account",
        verifiedByUserId: testUserId,
      });

      expect(verified.verificationStatus).toBe("VERIFIED");
      expect(verified.verifiedByUserId).toBe(testUserId);
      expect(verified.verifiedAt).toBeDefined();
      expect(verified.verificationNotes).toContain("Confirmed COD settlement");

      // Verify audit log entry
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "EVIDENCE_VERIFIED"))
        .limit(1);

      expect(logs.length).toBeGreaterThan(0);
    });

    it("supports REJECTED verification status with reason notes", async () => {
      const imgBuffer = await sharp({
        create: { width: 80, height: 80, channels: 3, background: { r: 50, g: 50, b: 50 } },
      })
        .png()
        .toBuffer();

      const doc = await storeEvidence({
        fileBuffer: imgBuffer,
        originalName: "Blurry_Challan.png",
        uploadedByUserId: testUserId,
      });

      const rejected = await verifyEvidence({
        documentId: doc.id,
        status: "REJECTED",
        notes: "Image is unreadable; please rescan the vendor challan",
        verifiedByUserId: testUserId,
      });

      expect(rejected.verificationStatus).toBe("REJECTED");
      expect(rejected.verificationNotes).toBe("Image is unreadable; please rescan the vendor challan");
    });
  });

  describe("5. Multi-Entity Linking & Search Queries", () => {
    it("links document to business entities and queries by entity", async () => {
      const sampleBuffer = await sharp({
        create: { width: 150, height: 150, channels: 3, background: { r: 0, g: 120, b: 200 } },
      })
        .png()
        .toBuffer();

      const ventureEntityId = crypto.randomUUID();

      const doc = await storeEvidence({
        fileBuffer: sampleBuffer,
        originalName: "Raw_Fabric_Inspection.png",
        category: "QC_DEFECT",
        entityType: "VENTURE",
        entityId: ventureEntityId,
        uploadedByUserId: testUserId,
      });

      // Query via getEvidenceForEntity
      const linked = await getEvidenceForEntity("VENTURE", ventureEntityId);
      expect(linked.length).toBeGreaterThanOrEqual(1);
      const found = linked.find((item) => item.id === doc.id);
      expect(found).toBeDefined();
      expect(found.category).toBe("QC_DEFECT");

      // Link to a second entity (many-to-many)
      const expenseEntityId = crypto.randomUUID();
      await linkDocumentToEntity(doc.id, "EXPENSE", expenseEntityId, "SUPPORTING", "Shared fabric cost proof", testUserId);

      const expenseEvidence = await getEvidenceForEntity("EXPENSE", expenseEntityId);
      expect(expenseEvidence.some((e) => e.id === doc.id)).toBe(true);

      // Unlink
      await unlinkDocumentFromEntity(doc.id, "EXPENSE", expenseEntityId);
      const afterUnlink = await getEvidenceForEntity("EXPENSE", expenseEntityId);
      expect(afterUnlink.some((e) => e.id === doc.id)).toBe(false);
    });

    it("aggregates repository metrics in listDocuments", async () => {
      const result = await listDocuments({ limit: 10 });
      expect(result.items).toBeDefined();
      expect(result.metrics.totalCount).toBeGreaterThanOrEqual(1);
      expect(Number(result.metrics.totalSizeBytes)).toBeGreaterThan(0);
      expect(result.metrics.pendingCount).toBeDefined();
      expect(result.metrics.verifiedCount).toBeDefined();
    });
  });

  describe("6. Document Metadata Editing & Clean Deletion", () => {
    it("updates displayTitle, category and notes", async () => {
      const imgBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .png()
        .toBuffer();

      const doc = await storeEvidence({
        fileBuffer: imgBuffer,
        originalName: "Temp_Bill.png",
        uploadedByUserId: testUserId,
      });

      const updated = await updateDocumentMetadata(doc.id, {
        displayTitle: "Updated Supplier Invoice #102",
        category: "INVOICE",
        description: "Corrected invoice after discount applied",
      });

      expect(updated.displayTitle).toBe("Updated Supplier Invoice #102");
      expect(updated.category).toBe("INVOICE");
      expect(updated.description).toBe("Corrected invoice after discount applied");
    });

    it("deletes disk files and database record cleanly", async () => {
      const imgBuffer = await sharp({
        create: { width: 60, height: 60, channels: 3, background: { r: 99, g: 88, b: 77 } },
      })
        .png()
        .toBuffer();

      const doc = await storeEvidence({
        fileBuffer: imgBuffer,
        originalName: "To_Be_Deleted.png",
        uploadedByUserId: testUserId,
      });

      const mainFile = resolveStoragePath(doc.storagePath);
      const thumbFile = resolveStoragePath(doc.thumbnailPath!);

      expect(fs.existsSync(mainFile)).toBe(true);
      expect(fs.existsSync(thumbFile)).toBe(true);

      // Delete
      await deleteDocument(doc.id, testUserId, true);

      // Verify disk files removed
      expect(fs.existsSync(mainFile)).toBe(false);
      expect(fs.existsSync(thumbFile)).toBe(false);

      // Verify DB row removed
      const checkDb = await db.select().from(documents).where(eq(documents.id, doc.id));
      expect(checkDb.length).toBe(0);
    });
  });

  describe("7. Local Encrypted Backup System Includes Evidence", () => {
    it("archives nested uploads directory during local backup creation", async () => {
      // Store a test file to ensure uploads directory has files
      const imgBuffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 20, g: 40, b: 60 } },
      })
        .png()
        .toBuffer();

      await storeEvidence({
        fileBuffer: imgBuffer,
        originalName: "Backup_Test_Doc.png",
        uploadedByUserId: testUserId,
      });

      // Run backup to a temp folder
      const tempBackupDir = path.resolve(process.cwd(), "./backups/test-evidence-backup");
      fs.mkdirSync(tempBackupDir, { recursive: true });

      const backup = await createLocalBackup(tempBackupDir, "test-backup-password-2026");
      expect(backup.success).toBe(true);
      expect(backup.documentCount).toBeGreaterThanOrEqual(1);

      // Clean up temp backup
      try {
        fs.rmSync(tempBackupDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    });
  });
});
