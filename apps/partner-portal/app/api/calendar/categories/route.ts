import { NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/auth";
import { getPortalCategories } from "@/lib/calendar";

export async function GET() {
  try {
    const partner = await getCurrentPartner();
    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await getPortalCategories();
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load categories" }, { status: 500 });
  }
}
