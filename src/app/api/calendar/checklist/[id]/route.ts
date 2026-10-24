import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleChecklistItem } from "@/server/services/calendar";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const updated = await toggleChecklistItem(id, Boolean(body.isCompleted));
    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("[API /api/calendar/checklist/[id] PATCH]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
