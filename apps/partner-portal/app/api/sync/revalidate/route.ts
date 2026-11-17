import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { PORTAL_DATA_TAG } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Called by the local ERP right after a successful push so cached dashboard
 * data is dropped immediately (instead of waiting for the safety TTL).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SHARED_SECRET is not configured on the portal." }, { status: 500 });
  }

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const header = req.headers.get("x-sync-secret") ?? "";
  if (!safeEqual(bearer, secret) && !safeEqual(header, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(PORTAL_DATA_TAG);
  return NextResponse.json({ ok: true, revalidated: PORTAL_DATA_TAG, at: new Date().toISOString() });
}
