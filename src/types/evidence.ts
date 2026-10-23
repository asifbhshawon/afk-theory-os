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

export interface ViewerDocument {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  displayTitle?: string | null;
  category: string;
  description?: string | null;
  verificationStatus: string;
  verifiedByUserId?: string | null;
  verifiedAt?: string | Date | null;
  verificationNotes?: string | null;
  module?: string;
  referenceId?: string | null;
  uploaderName?: string;
  createdAt: string | Date;
  fileHash: string;
  url?: string;
  thumbnailUrl?: string | null;
}
