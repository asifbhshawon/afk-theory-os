import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentById } from "@/server/services/evidence";
import { readStorageFile } from "@/server/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
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
    // Sanitize filename for Content-Disposition header
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
