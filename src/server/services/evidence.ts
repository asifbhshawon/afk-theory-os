import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/db";
import { documents, documentLinks, auditLogs, users } from "@/db/schema";
import { eq, and, desc, sql, ilike, or, inArray } from "drizzle-orm";

export const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";
export const EVIDENCE_SUBDIR = path.join("uploads", "evidence");
export const THUMBNAILS_SUBDIR = path.join("uploads", "thumbnails");

export const VALID_CATEGORIES = [
  "PAYMENT_PROOF",
  "RECEIPT",
  "INVOICE",
  "DELIVERY_PROOF",
  "QC_DEFECT",
  "AGREEMENT",
  "SAMPLE_PHOTO",
  "GENERAL_EVIDENCE",
] as const;

export type EvidenceCategory = (typeof VALID_CATEGORIES)[number];

export const VALID_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "SUPERSEDED",
] as const;

export type VerificationStatus = (typeof VALID_VERIFICATION_STATUSES)[number];

export interface StoreEvidenceInput {
  fileBuffer: Buffer;
  originalName: string;
  mimeType?: string;
  module?: string; // FINANCE, VENTURES, INVENTORY, MANUFACTURING, SALES, GENERAL
  referenceId?: string;
  entityType?: string; // EXPENSE, VENTURE, PRODUCTION_ORDER, SALES_ORDER, etc.
  entityId?: string;
  displayTitle?: string;
  category?: string;
  description?: string;
  uploadedByUserId?: string;
}

export interface VerificationInput {
  documentId: string;
  status: VerificationStatus;
  notes?: string;
  verifiedByUserId: string;
}

// Ensure the storage directories exist recursively
export function ensureStorageDirectories(): {
  storageDir: string;
  evidenceDir: string;
  thumbnailsDir: string;
} {
  const root = path.resolve(process.cwd(), STORAGE_DIR);
  const evidenceDir = path.join(root, EVIDENCE_SUBDIR);
  const thumbnailsDir = path.join(root, THUMBNAILS_SUBDIR);

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  return { storageDir: root, evidenceDir, thumbnailsDir };
}

// Safe resolution of relative storage path preventing directory traversal
export function resolveStoragePath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Invalid relative path");
  }
  const root = path.resolve(process.cwd(), STORAGE_DIR);
  const resolved = path.resolve(root, relativePath);

  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error("Security violation: path traversal detected");
  }

  return resolved;
}

// Magic bytes validation for safe file content
export function detectFormatFromBuffer(buffer: Buffer): {
  isImage: boolean;
  isPdf: boolean;
  format: string;
  mimeType: string;
} {
  if (!buffer || buffer.length < 4) {
    throw new Error("Invalid or empty file buffer");
  }

  // Check for dangerous scripts or executable headers
  // MZ header for DOS/Windows executable
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new Error("Security violation: Windows executables (.exe, .dll) are forbidden");
  }
  // ELF header for Linux executable
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    throw new Error("Security violation: Linux binaries are forbidden");
  }

  // Check for SVG or HTML/script injection in image disguises
  const headerPreview = buffer.subarray(0, 1024).toString("utf8").toLowerCase();
  if (
    headerPreview.includes("<svg") ||
    headerPreview.includes("xmlns=\"http://www.w3.org/2000/svg\"") ||
    headerPreview.includes("<!doctype html") ||
    headerPreview.includes("<html") ||
    headerPreview.includes("<script")
  ) {
    throw new Error("Security violation: SVG and HTML scripts are forbidden as evidence attachments");
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { isImage: false, isPdf: true, format: "pdf", mimeType: "application/pdf" };
  }

  // 2. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isImage: true, isPdf: false, format: "jpeg", mimeType: "image/jpeg" };
  }

  // 3. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isImage: true, isPdf: false, format: "png", mimeType: "image/png" };
  }

  // 4. WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isImage: true, isPdf: false, format: "webp", mimeType: "image/webp" };
  }

  // 5. GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { isImage: true, isPdf: false, format: "gif", mimeType: "image/gif" };
  }

  // 6. TIFF: II*. or MM.*
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return { isImage: true, isPdf: false, format: "tiff", mimeType: "image/tiff" };
  }

  // 7. HEIC / HEIF (FTYP box)
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const ftyp = buffer.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "mif1", "msf1", "hevc"].includes(ftyp)) {
      return { isImage: true, isPdf: false, format: "heic", mimeType: "image/heic" };
    }
  }

  throw new Error("Unsupported file format: only JPG, PNG, WebP, HEIC/HEIF, TIFF and PDF documents are allowed");
}

// Convert image buffer to WebP and generate thumbnail using Sharp
export async function processImageToWebP(inputBuffer: Buffer): Promise<{
  webpBuffer: Buffer;
  thumbnailBuffer: Buffer;
  width: number;
  height: number;
}> {
  const image = sharp(inputBuffer, { failOn: "error" });
  const meta = await image.metadata();

  if (!meta.width || !meta.height) {
    throw new Error("Unable to read image dimensions");
  }

  if (meta.width > 12000 || meta.height > 12000) {
    throw new Error("Image dimensions exceed maximum allowed limit (12,000 x 12,000 pixels)");
  }

  // 1. High quality WebP output with auto EXIF rotation applied
  const webpBuffer = await sharp(inputBuffer)
    .rotate() // Automatically orient based on EXIF orientation tag
    .webp({
      quality: 85,
      effort: 4,
      lossless: false,
    })
    .toBuffer();

  const convertedMeta = await sharp(webpBuffer).metadata();

  // 2. High performance WebP thumbnail for fast catalog rendering (max 240x240 inside fit)
  const thumbnailBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 240,
      height: 240,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 80,
      effort: 3,
    })
    .toBuffer();

  return {
    webpBuffer,
    thumbnailBuffer,
    width: convertedMeta.width || meta.width,
    height: convertedMeta.height || meta.height,
  };
}

// Main evidence ingestion function
export async function storeEvidence(input: StoreEvidenceInput) {
  const { storageDir, evidenceDir, thumbnailsDir } = ensureStorageDirectories();

  const detected = detectFormatFromBuffer(input.fileBuffer);
  const docId = crypto.randomUUID();
  const originalSize = input.fileBuffer.length;
  const cleanOriginalName = path.basename(input.originalName || "evidence").trim();

  let finalBuffer: Buffer;
  let finalMimeType: string;
  let finalFilename: string;
  let storageRelativePath: string;
  let thumbnailRelativePath: string | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;

  if (detected.isImage) {
    // MANDATORY REQUIREMENT: All accepted images are converted to WebP before storage
    const { webpBuffer, thumbnailBuffer, width, height } = await processImageToWebP(input.fileBuffer);

    finalBuffer = webpBuffer;
    finalMimeType = "image/webp";
    finalFilename = `evidence_${docId}.webp`;
    storageRelativePath = path.join("uploads", "evidence", finalFilename).replace(/\\/g, "/");

    const thumbFilename = `thumb_${docId}.webp`;
    thumbnailRelativePath = path.join("uploads", "thumbnails", thumbFilename).replace(/\\/g, "/");

    imageWidth = width;
    imageHeight = height;

    // Write WebP image & thumbnail to disk
    fs.writeFileSync(path.join(evidenceDir, finalFilename), finalBuffer);
    fs.writeFileSync(path.join(thumbnailsDir, thumbFilename), thumbnailBuffer);
  } else if (detected.isPdf) {
    // Keep original PDF intact
    finalBuffer = input.fileBuffer;
    finalMimeType = "application/pdf";
    finalFilename = `doc_${docId}.pdf`;
    storageRelativePath = path.join("uploads", "evidence", finalFilename).replace(/\\/g, "/");

    // Write PDF to disk
    fs.writeFileSync(path.join(evidenceDir, finalFilename), finalBuffer);
  } else {
    throw new Error("Unsupported format");
  }

  // Calculate SHA-256 hash of the stored file
  const fileHash = crypto.createHash("sha256").update(finalBuffer).digest("hex");

  const validatedCategory = VALID_CATEGORIES.includes(input.category as any)
    ? input.category!
    : "GENERAL_EVIDENCE";

  const moduleName = input.module?.toUpperCase() || "GENERAL";
  const displayTitle = input.displayTitle?.trim() || cleanOriginalName;

  // Insert document record in database
  const [doc] = await db
    .insert(documents)
    .values({
      id: docId,
      filename: finalFilename,
      originalName: cleanOriginalName,
      mimeType: finalMimeType,
      originalMimeType: detected.mimeType,
      fileSizeBytes: finalBuffer.length,
      originalSizeBytes: originalSize,
      storagePath: storageRelativePath,
      thumbnailPath: thumbnailRelativePath,
      fileHash,
      width: imageWidth,
      height: imageHeight,
      module: moduleName,
      referenceId: input.referenceId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      displayTitle,
      category: validatedCategory,
      description: input.description?.trim() || null,
      verificationStatus: "PENDING",
      uploadedByUserId: input.uploadedByUserId || null,
    })
    .returning();

  // If entity reference is specified, create primary link in document_links
  if (input.entityType && input.entityId) {
    await db.insert(documentLinks).values({
      documentId: docId,
      entityType: input.entityType,
      entityId: input.entityId,
      linkType: "PRIMARY",
      notes: input.description || null,
      linkedByUserId: input.uploadedByUserId || null,
    });
  }

  // Log audit entry
  try {
    await db.insert(auditLogs).values({
      userId: input.uploadedByUserId || null,
      action: "EVIDENCE_UPLOADED",
      entityType: input.entityType || "DOCUMENT",
      entityId: input.entityId || docId,
      details: `Uploaded evidence "${displayTitle}" (${finalMimeType}, ${finalBuffer.length} bytes, SHA256: ${fileHash.substring(0, 8)}...)`,
      newValues: {
        documentId: docId,
        filename: finalFilename,
        category: validatedCategory,
        mimeType: finalMimeType,
        sizeBytes: finalBuffer.length,
      },
    });
  } catch {
    // Ignore audit log error
  }

  return {
    ...doc,
    url: `/api/documents/${doc.id}`,
    thumbnailUrl: doc.thumbnailPath ? `/api/documents/${doc.id}/thumbnail` : null,
  };
}

// Verification workflow (PENDING -> VERIFIED | REJECTED | SUPERSEDED)
export async function verifyEvidence(input: VerificationInput) {
  if (!VALID_VERIFICATION_STATUSES.includes(input.status)) {
    throw new Error(`Invalid verification status: ${input.status}`);
  }

  const [existing] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);

  if (!existing) {
    throw new Error(`Document not found: ${input.documentId}`);
  }

  const [updated] = await db
    .update(documents)
    .set({
      verificationStatus: input.status,
      verifiedByUserId: input.verifiedByUserId,
      verifiedAt: new Date(),
      verificationNotes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.documentId))
    .returning();

  // Log audit entry
  try {
    await db.insert(auditLogs).values({
      userId: input.verifiedByUserId,
      action: `EVIDENCE_${input.status}`,
      entityType: existing.entityType || "DOCUMENT",
      entityId: existing.entityId || existing.id,
      details: `Evidence "${existing.displayTitle || existing.originalName}" verification updated to ${input.status}. Notes: ${input.notes || "None"}`,
      oldValues: { verificationStatus: existing.verificationStatus },
      newValues: { verificationStatus: input.status, notes: input.notes },
    });
  } catch {
    // Ignore audit log error
  }

  return updated;
}

// Link an existing document to an additional entity (many-to-many)
export async function linkDocumentToEntity(
  documentId: string,
  entityType: string,
  entityId: string,
  linkType: "PRIMARY" | "SUPPORTING" | "REFERENCE" = "SUPPORTING",
  notes?: string,
  userId?: string
) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error("Document not found");
  }

  const [link] = await db
    .insert(documentLinks)
    .values({
      documentId,
      entityType,
      entityId,
      linkType,
      notes: notes?.trim() || null,
      linkedByUserId: userId || null,
    })
    .returning();

  return link;
}

// Unlink a document from an entity
export async function unlinkDocumentFromEntity(
  documentId: string,
  entityType: string,
  entityId: string
) {
  await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.documentId, documentId),
        eq(documentLinks.entityType, entityType),
        eq(documentLinks.entityId, entityId)
      )
    );
}

// Get all documents linked to a specific entity
export async function getEvidenceForEntity(entityType: string, entityId: string) {
  // Query via document_links
  const linkedDocs = await db
    .select({
      doc: documents,
      link: documentLinks,
      uploaderName: users.name,
    })
    .from(documentLinks)
    .innerJoin(documents, eq(documentLinks.documentId, documents.id))
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(
      and(
        eq(documentLinks.entityType, entityType),
        eq(documentLinks.entityId, entityId),
        eq(documents.isArchived, false)
      )
    )
    .orderBy(desc(documents.createdAt));

  // Also query directly on documents table for entities linked directly
  const directDocs = await db
    .select({
      doc: documents,
      uploaderName: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(
      and(
        eq(documents.entityType, entityType),
        eq(documents.entityId, entityId),
        eq(documents.isArchived, false)
      )
    )
    .orderBy(desc(documents.createdAt));

  // Merge results without duplicates
  const seenIds = new Set<string>();
  const results: any[] = [];

  for (const item of directDocs) {
    if (!seenIds.has(item.doc.id)) {
      seenIds.add(item.doc.id);
      results.push({
        ...item.doc,
        uploaderName: item.uploaderName || "System",
        linkType: "PRIMARY",
        url: `/api/documents/${item.doc.id}`,
        thumbnailUrl: item.doc.thumbnailPath ? `/api/documents/${item.doc.id}/thumbnail` : null,
      });
    }
  }

  for (const item of linkedDocs) {
    if (!seenIds.has(item.doc.id)) {
      seenIds.add(item.doc.id);
      results.push({
        ...item.doc,
        uploaderName: item.uploaderName || "System",
        linkType: item.link.linkType,
        linkNotes: item.link.notes,
        url: `/api/documents/${item.doc.id}`,
        thumbnailUrl: item.doc.thumbnailPath ? `/api/documents/${item.doc.id}/thumbnail` : null,
      });
    }
  }

  return results;
}

// Batch lookup of evidence for multiple entities in a single query
export async function getEvidenceForEntities(
  entityType: string,
  entityIds: string[]
): Promise<Record<string, any[]>> {
  if (!entityIds || entityIds.length === 0) return {};

  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const resultMap: Record<string, any[]> = {};
  for (const id of uniqueIds) {
    resultMap[id] = [];
  }

  const directDocs = await db
    .select({
      doc: documents,
      uploaderName: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(
      and(
        eq(documents.entityType, entityType),
        inArray(documents.entityId, uniqueIds),
        eq(documents.isArchived, false)
      )
    )
    .orderBy(desc(documents.createdAt));

  const linkedDocs = await db
    .select({
      doc: documents,
      link: documentLinks,
      uploaderName: users.name,
    })
    .from(documentLinks)
    .innerJoin(documents, eq(documentLinks.documentId, documents.id))
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(
      and(
        eq(documentLinks.entityType, entityType),
        inArray(documentLinks.entityId, uniqueIds),
        eq(documents.isArchived, false)
      )
    )
    .orderBy(desc(documents.createdAt));

  const seenPerEntity = new Map<string, Set<string>>();

  for (const item of directDocs) {
    const eId = item.doc.entityId;
    if (eId) {
      if (!seenPerEntity.has(eId)) seenPerEntity.set(eId, new Set());
      const seen = seenPerEntity.get(eId)!;
      if (!seen.has(item.doc.id)) {
        seen.add(item.doc.id);
        if (!resultMap[eId]) resultMap[eId] = [];
        resultMap[eId].push({
          ...item.doc,
          uploaderName: item.uploaderName || "System",
          linkType: "PRIMARY",
          url: `/api/documents/${item.doc.id}`,
          thumbnailUrl: item.doc.thumbnailPath ? `/api/documents/${item.doc.id}/thumbnail` : null,
        });
      }
    }
  }

  for (const item of linkedDocs) {
    const eId = item.link.entityId;
    if (eId) {
      if (!seenPerEntity.has(eId)) seenPerEntity.set(eId, new Set());
      const seen = seenPerEntity.get(eId)!;
      if (!seen.has(item.doc.id)) {
        seen.add(item.doc.id);
        if (!resultMap[eId]) resultMap[eId] = [];
        resultMap[eId].push({
          ...item.doc,
          uploaderName: item.uploaderName || "System",
          linkType: item.link.linkType,
          linkNotes: item.link.notes,
          url: `/api/documents/${item.doc.id}`,
          thumbnailUrl: item.doc.thumbnailPath ? `/api/documents/${item.doc.id}/thumbnail` : null,
        });
      }
    }
  }

  return resultMap;
}

export interface ListDocumentsParams {
  search?: string;
  module?: string;
  category?: string;
  verificationStatus?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

// List documents for Central Library with filters, search, and metrics
export async function listDocuments(params: ListDocumentsParams = {}) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const conditions = [eq(documents.isArchived, false)];

  if (params.module && params.module !== "ALL") {
    conditions.push(eq(documents.module, params.module.toUpperCase()));
  }

  if (params.category && params.category !== "ALL") {
    conditions.push(eq(documents.category, params.category));
  }

  if (params.verificationStatus && params.verificationStatus !== "ALL") {
    conditions.push(eq(documents.verificationStatus, params.verificationStatus));
  }

  if (params.entityType && params.entityType !== "ALL") {
    conditions.push(eq(documents.entityType, params.entityType));
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(documents.originalName, term),
        ilike(documents.displayTitle, term),
        ilike(documents.description, term),
        ilike(documents.referenceId, term)
      )!
    );
  }

  const whereClause = and(...conditions);

  // Fetch paginated rows with uploader and verifier details
  const rows = await db
    .select({
      doc: documents,
      uploaderName: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(whereClause)
    .orderBy(desc(documents.createdAt))
    .limit(limit)
    .offset(offset);

  // Summary aggregation metrics for library dashboard
  const metricsResult = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      totalSizeBytes: sql<number>`coalesce(sum(${documents.fileSizeBytes}), 0)::bigint`,
      pendingCount: sql<number>`coalesce(sum(case when ${documents.verificationStatus} = 'PENDING' then 1 else 0 end), 0)::int`,
      verifiedCount: sql<number>`coalesce(sum(case when ${documents.verificationStatus} = 'VERIFIED' then 1 else 0 end), 0)::int`,
      rejectedCount: sql<number>`coalesce(sum(case when ${documents.verificationStatus} = 'REJECTED' then 1 else 0 end), 0)::int`,
    })
    .from(documents)
    .where(eq(documents.isArchived, false));

  const metrics = metricsResult[0] || {
    totalCount: 0,
    totalSizeBytes: 0,
    pendingCount: 0,
    verifiedCount: 0,
    rejectedCount: 0,
  };

  const items = rows.map((r) => ({
    ...r.doc,
    uploaderName: r.uploaderName || "Unknown",
    url: `/api/documents/${r.doc.id}`,
    thumbnailUrl: r.doc.thumbnailPath ? `/api/documents/${r.doc.id}/thumbnail` : null,
  }));

  return {
    items,
    metrics,
    limit,
    offset,
  };
}

// Get single document by ID
export async function getDocumentById(id: string) {
  const [row] = await db
    .select({
      doc: documents,
      uploaderName: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(eq(documents.id, id))
    .limit(1);

  if (!row) return null;

  return {
    ...row.doc,
    uploaderName: row.uploaderName || "Unknown",
    url: `/api/documents/${row.doc.id}`,
    thumbnailUrl: row.doc.thumbnailPath ? `/api/documents/${row.doc.id}/thumbnail` : null,
  };
}

// Delete document (removes disk files and DB record)
export async function deleteDocument(id: string, userId?: string, isAdmin: boolean = false) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    throw new Error("Document not found");
  }

  // Authorization: Only admin or the original uploader can delete
  if (!isAdmin && doc.uploadedByUserId && doc.uploadedByUserId !== userId) {
    throw new Error("Unauthorized to delete this evidence");
  }

  // Delete files from disk safely
  try {
    const mainFile = resolveStoragePath(doc.storagePath);
    if (fs.existsSync(mainFile)) {
      fs.unlinkSync(mainFile);
    }
  } catch {
    // Ignore file removal error
  }

  if (doc.thumbnailPath) {
    try {
      const thumbFile = resolveStoragePath(doc.thumbnailPath);
      if (fs.existsSync(thumbFile)) {
        fs.unlinkSync(thumbFile);
      }
    } catch {
      // Ignore thumbnail removal error
    }
  }

  // Delete from DB (documentLinks cascades automatically)
  await db.delete(documents).where(eq(documents.id, id));

  // Log audit entry
  try {
    await db.insert(auditLogs).values({
      userId: userId || null,
      action: "EVIDENCE_DELETED",
      entityType: doc.entityType || "DOCUMENT",
      entityId: doc.entityId || doc.id,
      details: `Deleted evidence "${doc.displayTitle || doc.originalName}" (${doc.filename})`,
    });
  } catch {
    // Ignore audit log error
  }

  return { success: true };
}

// Update editable document metadata (display title, category, description)
export async function updateDocumentMetadata(
  id: string,
  data: { displayTitle?: string; category?: string; description?: string },
  userId?: string
) {
  const [existing] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Document not found");
  }

  const updates: Partial<typeof documents.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.displayTitle !== undefined) updates.displayTitle = data.displayTitle.trim();
  if (data.category && VALID_CATEGORIES.includes(data.category as any)) {
    updates.category = data.category;
  }
  if (data.description !== undefined) updates.description = data.description.trim();

  const [updated] = await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id))
    .returning();

  return updated;
}
