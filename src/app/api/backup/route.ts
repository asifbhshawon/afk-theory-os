import { NextResponse } from "next/server";
import { createLocalBackup } from "@/server/services/backup";

export async function POST() {
  try {
    const result = await createLocalBackup();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, backup: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
