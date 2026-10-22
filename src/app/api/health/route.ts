import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const res = await db.execute(sql`SELECT 1 as healthy, current_database() as db_name`);
    const result = res.rows[0] as { healthy: number; db_name: string } | undefined;

    return NextResponse.json(
      {
        status: "UP",
        business: "AFK THEORY",
        database: "CONNECTED",
        databaseName: result?.db_name || "afk_business_os",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "DOWN",
        database: "DISCONNECTED",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
