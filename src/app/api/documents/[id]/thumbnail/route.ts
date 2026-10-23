import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentById, resolveStoragePath } from "@/server/services/evidence";

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

    // If no thumbnail path (e.g. PDF), redirect to the full document route or 404
    if (!doc.thumbnailPath) {
      const url = new URL(`/api/documents/${doc.id}`, req.url);
      return NextResponse.redirect(url);
    }

    const thumbPath = resolveStoragePath(doc.thumbnailPath);
    if (!fs.existsSync(thumbPath)) {
      // Fallback to original file if thumbnail missing
      const fullPath = resolveStoragePath(doc.storagePath);
      if (fs.existsSync(fullPath)) {
        const fullBuffer = fs.readFileSync(fullPath);
        return new NextResponse(fullBuffer, {
          status: 200,
          headers: {
            "Content-Type": doc.mimeType,
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
      return NextResponse.json(
        { success: false, error: "Thumbnail file not found" },
        { status: 404 }
      );
    }

    const thumbBuffer = fs.readFileSync(thumbPath);

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
