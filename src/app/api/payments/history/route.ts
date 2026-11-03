import { NextResponse } from "next/server";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { payments, projects } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

export function truncatePaymentId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (trimmed.length <= 6) return trimmed;
  return `...${trimmed.slice(-6)}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();

    const url = new URL(req.url);
    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
    const rawOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const roleParam = url.searchParams.get("role")?.toUpperCase();
    const isAdminRequested = roleParam === "ADMIN";
    const isBuilderRequested = roleParam === "BUILDER";
    const isClientRequested = roleParam === "CLIENT";

    // Determine target role based on param or user roles
    let targetRole: "ADMIN" | "BUILDER" | "CLIENT";
    if (isAdminRequested && auth.roles.includes("ADMIN")) {
      targetRole = "ADMIN";
    } else if (isBuilderRequested && auth.roles.includes("BUILDER")) {
      targetRole = "BUILDER";
    } else if (isClientRequested && auth.roles.includes("CLIENT")) {
      targetRole = "CLIENT";
    } else if (auth.roles.includes("ADMIN")) {
      targetRole = "ADMIN";
    } else if (auth.roles.includes("BUILDER") && !auth.roles.includes("CLIENT")) {
      targetRole = "BUILDER";
    } else if (auth.roles.includes("CLIENT")) {
      targetRole = "CLIENT";
    } else if (auth.roles.includes("BUILDER")) {
      targetRole = "BUILDER";
    } else {
      return NextResponse.json(
        { error: "Forbidden. Insufficient permissions." },
        { status: 403 }
      );
    }

    if (targetRole === "ADMIN") {
      // Admin: every payment row across all projects
      const [totalResult] = await db
        .select({ total: count() })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id));

      const total = totalResult ? Number(totalResult.total) : 0;

      const rows = await db
        .select({
          id: payments.id,
          projectId: payments.projectId,
          projectCode: projects.projectCode,
          projectTitle: projects.title,
          type: payments.type,
          expectedAmount: payments.expectedAmount,
          submittedAmount: payments.submittedAmount,
          status: payments.status,
          verifiedAt: payments.verifiedAt,
          createdAt: payments.createdAt,
          razorpayPaymentId: payments.razorpayPaymentId,
          rejectionReason: payments.rejectionReason,
        })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      const formatted = rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        projectCode: r.projectCode,
        projectTitle: r.projectTitle,
        type: r.type,
        amount: r.submittedAmount ?? r.expectedAmount,
        status: r.status,
        verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        razorpayPaymentId: r.razorpayPaymentId,
        truncatedPaymentId: truncatePaymentId(r.razorpayPaymentId),
        rejectionReason: r.rejectionReason,
      }));

      return NextResponse.json({
        success: true,
        role: "ADMIN",
        payments: formatted,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + formatted.length < total,
        },
      });
    } else if (targetRole === "BUILDER") {
      // Builder: every payments row across all their projects where status = VERIFIED or REJECTED
      const condition = and(
        eq(projects.builderId, auth.user.id),
        inArray(payments.status, ["VERIFIED", "REJECTED"])
      );

      const [totalResult] = await db
        .select({ total: count() })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(condition);

      const total = totalResult ? Number(totalResult.total) : 0;

      const rows = await db
        .select({
          id: payments.id,
          projectId: payments.projectId,
          projectCode: projects.projectCode,
          projectTitle: projects.title,
          type: payments.type,
          expectedAmount: payments.expectedAmount,
          submittedAmount: payments.submittedAmount,
          status: payments.status,
          verifiedAt: payments.verifiedAt,
          createdAt: payments.createdAt,
          razorpayPaymentId: payments.razorpayPaymentId,
          rejectionReason: payments.rejectionReason,
        })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(condition)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      const formatted = rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        projectCode: r.projectCode,
        projectTitle: r.projectTitle,
        type: r.type,
        amount: r.submittedAmount ?? r.expectedAmount,
        status: r.status,
        verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        razorpayPaymentId: r.razorpayPaymentId,
        truncatedPaymentId: truncatePaymentId(r.razorpayPaymentId),
        rejectionReason: r.rejectionReason,
      }));

      return NextResponse.json({
        success: true,
        role: "BUILDER",
        payments: formatted,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + formatted.length < total,
        },
      });
    } else {
      // Client: every payment row on their own projects
      const condition = eq(projects.clientId, auth.user.id);

      const [totalResult] = await db
        .select({ total: count() })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(condition);

      const total = totalResult ? Number(totalResult.total) : 0;

      const rows = await db
        .select({
          id: payments.id,
          projectId: payments.projectId,
          projectCode: projects.projectCode,
          projectTitle: projects.title,
          type: payments.type,
          expectedAmount: payments.expectedAmount,
          submittedAmount: payments.submittedAmount,
          status: payments.status,
          verifiedAt: payments.verifiedAt,
          createdAt: payments.createdAt,
          razorpayPaymentId: payments.razorpayPaymentId,
          rejectionReason: payments.rejectionReason,
        })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(condition)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      const formatted = rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        projectCode: r.projectCode,
        projectTitle: r.projectTitle,
        type: r.type,
        amount: r.submittedAmount ?? r.expectedAmount,
        status: r.status,
        verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        razorpayPaymentId: r.razorpayPaymentId,
        truncatedPaymentId: truncatePaymentId(r.razorpayPaymentId),
        rejectionReason: r.rejectionReason,
      }));

      return NextResponse.json({
        success: true,
        role: "CLIENT",
        payments: formatted,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + formatted.length < total,
        },
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/History] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching payment history." },
      { status: 500 }
    );
  }
}
