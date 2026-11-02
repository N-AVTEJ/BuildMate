import { NextResponse } from "next/server";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { disputes, projects, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET(req: Request) {
  try {
    await requireRole(["ADMIN"]);
    const url = new URL(req.url);

    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
    const rawOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const statusParam = url.searchParams.get("status")?.toUpperCase();

    const isFiltered = statusParam && ["OPEN", "RESOLVED", "CANCELLED"].includes(statusParam);
    const whereClause = isFiltered
      ? eq(disputes.status, statusParam as "OPEN" | "RESOLVED" | "CANCELLED")
      : undefined;

    // Total count
    const countQuery = db.select({ value: count() }).from(disputes);
    const [countResult] = whereClause
      ? await countQuery.where(whereClause)
      : await countQuery;

    const total = countResult?.value || 0;

    // Fetch paginated disputes
    const query = db
      .select({
        id: disputes.id,
        projectId: disputes.projectId,
        reason: disputes.reason,
        description: disputes.description,
        status: disputes.status,
        preDisputeStatus: disputes.preDisputeStatus,
        resolutionNote: disputes.resolutionNote,
        createdAt: disputes.createdAt,
        resolvedAt: disputes.resolvedAt,
        raisedById: disputes.raisedBy,
        raiserName: users.name,
        raiserEmail: users.email,
        projectCode: projects.projectCode,
        projectTitle: projects.title,
      })
      .from(disputes)
      .innerJoin(projects, eq(disputes.projectId, projects.id))
      .innerJoin(users, eq(disputes.raisedBy, users.id))
      .orderBy(desc(disputes.createdAt))
      .limit(limit)
      .offset(offset);

    const rows = whereClause ? await query.where(whereClause) : await query;

    return NextResponse.json({
      success: true,
      disputes: rows,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/Disputes/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching disputes." },
      { status: 500 }
    );
  }
}
