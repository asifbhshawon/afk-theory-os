import { NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/sync";

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to get sync status" }, { status: 500 });
  }
}
