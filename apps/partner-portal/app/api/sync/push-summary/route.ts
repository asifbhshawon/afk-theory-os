import { NextRequest, NextResponse } from "next/server";
import { applyLocalErpPushSummary, SyncPushPayload } from "@/lib/sync";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const syncSecret = process.env.SYNC_SHARED_SECRET;

    if (!syncSecret) {
      return NextResponse.json(
        { error: "Server configuration error: SYNC_SHARED_SECRET is not configured on the portal." },
        { status: 500 }
      );
    }

    // Enforce strict authorization
    if (authHeader !== `Bearer ${syncSecret}` && req.headers.get("x-sync-secret") !== syncSecret) {
      return NextResponse.json(
        { error: "Unauthorized sync request. Invalid sync secret." },
        { status: 401 }
      );
    }

    const payload: SyncPushPayload = await req.json();

    if (!payload.businessSummary) {
      return NextResponse.json(
        { error: "Invalid payload: businessSummary is required." },
        { status: 400 }
      );
    }

    const result = await applyLocalErpPushSummary(payload);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Sync Push Summary API Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process push summary" },
      { status: 500 }
    );
  }
}
