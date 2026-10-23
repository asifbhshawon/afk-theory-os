import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reverseJournalEntry } from "@/server/services/finance";
import { revalidatePath } from "next/cache";

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
        { success: false, error: "Forbidden: Finance Manager or Admin role required to reverse transactions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { journalEntryId, reason } = body;

    if (!journalEntryId) {
      return NextResponse.json(
        { success: false, error: "Journal entry ID is required" },
        { status: 400 }
      );
    }

    const reversal = await reverseJournalEntry(
      journalEntryId,
      reason?.trim() || "Manual operational reversal",
      user.id
    );

    revalidatePath("/finance");
    revalidatePath("/partners");
    revalidatePath("/reports");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      message: `Transaction successfully reversed with entry ${reversal.entryNumber}`,
      reversal,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reverse transaction" },
      { status: 400 }
    );
  }
}
