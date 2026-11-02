import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { builderApplications } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET(req: Request) {
  try {
    // 1. Centralized Authorization: ADMIN role required
    await requireRole(["ADMIN"]);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status")?.toUpperCase();
    const rawLimit = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const rawOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const applications = statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam)
      ? await db
          .select()
          .from(builderApplications)
          .where(eq(builderApplications.status, statusParam as "PENDING" | "APPROVED" | "REJECTED"))
          .orderBy(desc(builderApplications.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(builderApplications)
          .orderBy(desc(builderApplications.createdAt))
          .limit(limit)
          .offset(offset);

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/BuilderApplications] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to fetch builder applications." }, { status: 500 });
  }
}
