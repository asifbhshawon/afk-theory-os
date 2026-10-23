"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  verifyEvidence,
  updateDocumentMetadata,
  deleteDocument,
  linkDocumentToEntity,
  unlinkDocumentFromEntity,
  VerificationStatus,
} from "@/server/services/evidence";

export async function verifyDocumentAction(
  documentId: string,
  status: VerificationStatus,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const updated = await verifyEvidence({
      documentId,
      status,
      notes,
      verifiedByUserId: user.id,
    });

    revalidatePath("/documents");
    revalidatePath("/finance");
    revalidatePath("/ventures");
    revalidatePath("/inventory");
    revalidatePath("/manufacturing");
    revalidatePath("/orders");

    return { success: true, document: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify document" };
  }
}

export async function updateDocumentMetadataAction(
  documentId: string,
  data: { displayTitle?: string; category?: string; description?: string }
) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const updated = await updateDocumentMetadata(documentId, data, user.id);
    revalidatePath("/documents");
    return { success: true, document: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update metadata" };
  }
}

export async function deleteDocumentAction(documentId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await deleteDocument(documentId, user.id, user.isAdmin);
    revalidatePath("/documents");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete document" };
  }
}

export async function linkDocumentAction(
  documentId: string,
  entityType: string,
  entityId: string,
  linkType: "PRIMARY" | "SUPPORTING" | "REFERENCE" = "SUPPORTING",
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const link = await linkDocumentToEntity(
      documentId,
      entityType,
      entityId,
      linkType,
      notes,
      user.id
    );
    revalidatePath("/documents");
    return { success: true, link };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to link document" };
  }
}

export async function unlinkDocumentAction(
  documentId: string,
  entityType: string,
  entityId: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await unlinkDocumentFromEntity(documentId, entityType, entityId);
    revalidatePath("/documents");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to unlink document" };
  }
}
