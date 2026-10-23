import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { postFinancialTransactionWithEvidence } from "@/server/services/finance-with-evidence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: login required" },
        { status: 401 }
      );
    }

    const hasPermission =
      user.isAdmin ||
      user.roles?.includes("ADMIN") ||
      user.roles?.includes("FINANCE_MGR");

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Finance Manager or Admin role required" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const action = formData.get("action") as any;
    const partnerId = (formData.get("partnerId") as string) || undefined;
    const paymentAccountId = (formData.get("paymentAccountId") as string) || undefined;
    const amount = Number(formData.get("amount"));
    const reference = (formData.get("reference") as string) || undefined;
    const description = (formData.get("description") as string) || undefined;
    const expenseAccountId = (formData.get("expenseAccountId") as string) || undefined;
    const customCategoryName = (formData.get("customCategoryName") as string) || undefined;
    const fromPaymentAccountId = (formData.get("fromPaymentAccountId") as string) || undefined;
    const toPaymentAccountId = (formData.get("toPaymentAccountId") as string) || undefined;
    const isSupplierPayable = formData.get("isSupplierPayable") === "true";
    const idempotencyKey = (formData.get("idempotencyKey") as string) || undefined;

    // Collect attached files
    const rawFiles: File[] = [];
    const allFiles = formData.getAll("files");
    for (const item of allFiles) {
      if (item instanceof File && item.size > 0) {
        rawFiles.push(item);
      }
    }
    const singleFile = formData.get("file");
    if (singleFile instanceof File && singleFile.size > 0 && !rawFiles.includes(singleFile)) {
      rawFiles.push(singleFile);
    }

    const filePayloads: Array<{
      buffer: Buffer;
      originalName: string;
      mimeType?: string;
      category?: string;
      description?: string;
      displayTitle?: string;
    }> = [];

    for (const file of rawFiles) {
      const arrayBuffer = await file.arrayBuffer();
      filePayloads.push({
        buffer: Buffer.from(arrayBuffer),
        originalName: file.name,
        mimeType: file.type,
      });
    }

    const result = await postFinancialTransactionWithEvidence({
      action,
      partnerId,
      paymentAccountId,
      amount,
      reference,
      description,
      expenseAccountId,
      customCategoryName,
      fromPaymentAccountId,
      toPaymentAccountId,
      isSupplierPayable,
      files: filePayloads,
      userId: user.id,
      idempotencyKey,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process transaction with evidence" },
      { status: 400 }
    );
  }
}
