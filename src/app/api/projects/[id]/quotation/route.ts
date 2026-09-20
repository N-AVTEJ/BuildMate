import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, quotations, projectStatusHistory } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeAdvanceBreakdown } from "@/lib/projects/pricing";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "QUOTATION_SUBMIT");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const rawTotalPrice = body?.totalPrice;
    const rawDuration = body?.estimatedDurationDays;

    if (
      typeof rawTotalPrice !== "number" ||
      !Number.isInteger(rawTotalPrice) ||
      rawTotalPrice <= 0
    ) {
      return NextResponse.json(
        { error: "totalPrice must be a positive integer." },
        { status: 400 }
      );
    }

    if (
      typeof rawDuration !== "number" ||
      !Number.isInteger(rawDuration) ||
      rawDuration < 1 ||
      rawDuration > 365
    ) {
      return NextResponse.json(
        { error: "estimatedDurationDays is required and must be an integer between 1 and 365." },
        { status: 400 }
      );
    }

    const totalPrice = rawTotalPrice;
    const estimatedDurationDays = rawDuration;
    const { advanceAmount, remainingAmount } = computeAdvanceBreakdown(totalPrice);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // Lock project row
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      authorize(auth, "QUOTATION_SUBMIT", { builderId: project.builderId });

      if (project.status !== "ACCEPTED_PENDING_QUOTE") {
        return {
          type: "CONFLICT" as const,
          message: `Cannot submit quotation when project is in ${project.status} status.`,
        };
      }

      // Insert quotation (PENDING)
      const [quotation] = await tx
        .insert(quotations)
        .values({
          projectId,
          totalPrice,
          advanceAmount,
          remainingAmount,
          estimatedDurationDays,
          status: "PENDING",
        })
        .returning();

      // Update project status & pricing
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: "QUOTATION_SENT",
          totalPrice,
          advanceAmount,
          remainingAmount,
          updatedAt: now,
        })
        .where(eq(projects.id, projectId))
        .returning();

      // Audit status transition
      await tx.insert(projectStatusHistory).values({
        projectId,
        fromStatus: "ACCEPTED_PENDING_QUOTE",
        toStatus: "QUOTATION_SENT",
        changedBy: auth.user.id,
      });

      return {
        type: "SUCCESS" as const,
        quotation,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      quotation: result.quotation,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Quotation/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while submitting quotation." },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        builderId: projects.builderId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    authorize(auth, "QUOTATION_VIEW", {
      clientId: project.clientId,
      builderId: project.builderId,
    });

    const [latestQuotation] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.projectId, projectId))
      .orderBy(desc(quotations.createdAt))
      .limit(1);

    return NextResponse.json({
      quotation: latestQuotation || null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Quotation/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving quotation." },
      { status: 500 }
    );
  }
}
