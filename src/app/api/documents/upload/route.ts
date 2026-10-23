import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { storeEvidence } from "@/server/services/evidence";

export async function POST(req: NextRequest) {
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
