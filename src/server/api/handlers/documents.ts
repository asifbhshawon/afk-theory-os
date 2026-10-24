import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentById, storeEvidence } from "@/server/services/evidence";
import { readStorageFile } from "@/server/storage";

// ==========================================
// 1. Evidence Upload
// ==========================================

export async function handleDocumentsUploadPost(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: login required to upload evidence" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const files: File[] = [];

    // Support both multiple "files" and single "file" keys
    const rawFiles = formData.getAll("files");
    if (rawFiles && rawFiles.length > 0) {
      for (const item of rawFiles) {
        if (item instanceof File && item.size > 0) {
          files.push(item);
        }
      }
    }

    const singleFile = formData.get("file");
    if (singleFile instanceof File && singleFile.size > 0 && !files.includes(singleFile)) {
      files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid files received" },
        { status: 400 }
      );
    }

    const moduleName = (formData.get("module") as string) || "GENERAL";
    const entityType = (formData.get("entityType") as string) || undefined;
    const entityId = (formData.get("entityId") as string) || undefined;
    const referenceId = (formData.get("referenceId") as string) || undefined;
    const category = (formData.get("category") as string) || "GENERAL_EVIDENCE";
    const description = (formData.get("description") as string) || undefined;
    const displayTitle = (formData.get("displayTitle") as string) || undefined;

    const savedDocuments: any[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const doc = await storeEvidence({
          fileBuffer: buffer,
          originalName: file.name,
          mimeType: file.type,
          module: moduleName,
          entityType,
          entityId,
          referenceId,
          category,
          description,
          displayTitle: displayTitle || file.name,
          uploadedByUserId: user.id,
        });

        savedDocuments.push(doc);
      } catch (err: any) {
        errors.push({
          file: file.name,
          error: err.message || "Failed to process file",
        });
      }
    }

    if (savedDocuments.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors[0].error,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: savedDocuments,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. Document by ID (Full File)
// ==========================================

export async function handleDocumentByIdGet(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document ID required" },
        { status: 400 }
      );
    }

    const doc = await getDocumentById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const fileBuffer = await readStorageFile(doc.storagePath);
    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: "Document file not found in storage" },
        { status: 404 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const isDownload = searchParams.get("download") === "1";

    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFilename = encodeURIComponent(doc.originalName || doc.filename);

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType || "application/octet-stream");
    headers.set("Content-Length", fileBuffer.length.toString());
    headers.set(
      "Content-Disposition",
      `${dispositionType}; filename="${doc.originalName || doc.filename}"; filename*=UTF-8''${safeFilename}`
    );
    headers.set("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Error retrieving evidence document:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve evidence file" },
      { status: 500 }
    );
  }
}

// ==========================================
// 3. Document Thumbnail by ID
// ==========================================

export async function handleDocumentThumbnailGet(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document ID required" },
        { status: 400 }
      );
    }

    const doc = await getDocumentById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // If no thumbnail path (e.g. PDF), redirect to the full document route or 404
    if (!doc.thumbnailPath) {
      const url = new URL(`/api/documents/${doc.id}`, req.url);
      return NextResponse.redirect(url);
    }

    let thumbBuffer = await readStorageFile(doc.thumbnailPath);
    if (!thumbBuffer) {
      // Fallback to original file if thumbnail missing
      thumbBuffer = await readStorageFile(doc.storagePath);
      if (thumbBuffer) {
        return new NextResponse(thumbBuffer, {
          status: 200,
          headers: {
            "Content-Type": doc.mimeType,
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
      return NextResponse.json(
        { success: false, error: "Thumbnail file not found in storage" },
        { status: 404 }
      );
    }

    return new NextResponse(thumbBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": thumbBuffer.length.toString(),
        "Cache-Control": "private, max-age=604800, stale-while-revalidate=2592000",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve thumbnail" },
      { status: 500 }
    );
  }
}
