import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * GET /api/health（app-runtime「健康检查端点」）
 * 数据库连通 → 200 healthy；不可达 → 503 unhealthy（明确指向数据库故障）。
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "healthy", database: "up" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "down",
        message: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
