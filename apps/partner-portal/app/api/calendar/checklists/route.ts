import { NextRequest, NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/auth";
import { togglePortalChecklistItem } from "@/lib/calendar";

export async function POST(req: NextRequest) {
  try {
    const partner = await getCurrentPartner();
    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.checklistItemId) {
      return NextResponse.json({ error: "checklistItemId is required" }, { status: 400 });
    }

    const updated = await togglePortalChecklistItem(partner, body.checklistItemId);
    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to toggle checklist" }, { status: 400 });
  }
}
