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

    let query = db
      .select()
      .from(builderApplications)
      .orderBy(desc(builderApplications.createdAt));

    const applications = statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam)
      ? await db
          .select()
          .from(builderApplications)
          .where(eq(builderApplications.status, statusParam as "PENDING" | "APPROVED" | "REJECTED"))
          .orderBy(desc(builderApplications.createdAt))
      : await query;

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
