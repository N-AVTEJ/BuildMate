import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, quotations, projectStatusHistory } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "QUOTATION_REJECT");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Lock project row
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // 2. Ownership check via centralized authorization
      authorize(auth, "QUOTATION_REJECT", { clientId: project.clientId });

      // 3. Status precondition check
      if (project.status !== "QUOTATION_SENT") {
        return {
          type: "CONFLICT" as const,
          message: `Cannot reject quotation when project is in ${project.status} status.`,
        };
      }

      // 4. Fetch latest PENDING quotation
      const [quotation] = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.projectId, projectId))
        .orderBy(desc(quotations.createdAt))
        .limit(1);

      if (!quotation || quotation.status !== "PENDING") {
        return {
          type: "CONFLICT" as const,
          message: "No pending quotation found to reject.",
        };
      }

      // 5. Update quotation status to REJECTED
      await tx
        .update(quotations)
        .set({
          status: "REJECTED",
          updatedAt: now,
        })
        .where(eq(quotations.id, quotation.id));

      // 6. Reset project status to ACCEPTED_PENDING_QUOTE and null pricing fields
      // NOTE: builderId is NOT cleared. The builder remains assigned.
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: "ACCEPTED_PENDING_QUOTE",
          totalPrice: null,
          advanceAmount: null,
          remainingAmount: null,
          updatedAt: now,
        })
        .where(eq(projects.id, projectId))
        .returning();

      // 7. Audit status transition
      await tx.insert(projectStatusHistory).values({
        projectId,
        fromStatus: "QUOTATION_SENT",
        toStatus: "ACCEPTED_PENDING_QUOTE",
        changedBy: auth.user.id,
      });

      return {
        type: "SUCCESS" as const,
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
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Quotation/Reject] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while rejecting quotation." },
      { status: 500 }
    );
  }
}
