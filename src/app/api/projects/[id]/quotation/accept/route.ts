import { NextResponse } from "next/server";
import { eq, desc, max } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  quotations,
  scopeVersions,
  projectRequirements,
  projectStatusHistory,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "QUOTATION_ACCEPT");

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

      // 2. Ownership check
      if (project.clientId !== auth.user.id) {
        return { type: "FORBIDDEN" as const };
      }

      // 3. Status precondition check
      if (project.status !== "QUOTATION_SENT") {
        return {
          type: "CONFLICT" as const,
          message: `Cannot accept quotation when project is in ${project.status} status.`,
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
          message: "No pending quotation found to accept.",
        };
      }

      // 5. Fetch requirements for snapshot
      const requirementsList = await tx
        .select()
        .from(projectRequirements)
        .where(eq(projectRequirements.projectId, projectId));

      // 6. Concurrency-safe scope version calculation
      const [maxVersionRow] = await tx
        .select({ maxVersion: max(scopeVersions.versionNumber) })
        .from(scopeVersions)
        .where(eq(scopeVersions.projectId, projectId));

      const nextVersion = (Number(maxVersionRow?.maxVersion) || 0) + 1;

      const projectSnapshot = {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        subject: project.subject,
        description: project.description,
        techStack: project.techStack,
        budgetMin: project.budgetMin,
        budgetMax: project.budgetMax,
        totalPrice: project.totalPrice,
        advanceAmount: project.advanceAmount,
        remainingAmount: project.remainingAmount,
        acceptanceDeadline: project.acceptanceDeadline,
        builderAcceptedAt: project.builderAcceptedAt,
        capturedAt: now.toISOString(),
      };

      // 7. Insert scope version
      const [newScopeVersion] = await tx
        .insert(scopeVersions)
        .values({
          projectId,
          versionNumber: nextVersion,
          projectSnapshot,
          requirementsSnapshot: requirementsList,
          quotationSnapshot: quotation,
        })
        .returning();

      // 8. Update quotation status to ACCEPTED
      await tx
        .update(quotations)
        .set({
          status: "ACCEPTED",
          updatedAt: now,
        })
        .where(eq(quotations.id, quotation.id));

      // 9. Update project status directly to AWAITING_ADVANCE (single hop, no CLIENT_ACCEPTED)
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: "AWAITING_ADVANCE",
          advancePaymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updatedAt: now,
        })
        .where(eq(projects.id, projectId))
        .returning();

      // 10. Audit history: exactly one entry QUOTATION_SENT -> AWAITING_ADVANCE
      await tx.insert(projectStatusHistory).values({
        projectId,
        fromStatus: "QUOTATION_SENT",
        toStatus: "AWAITING_ADVANCE",
        changedBy: auth.user.id,
      });

      return {
        type: "SUCCESS" as const,
        scopeVersion: newScopeVersion,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden. You are not the client owner of this project." },
        { status: 403 }
      );
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      scopeVersion: result.scopeVersion,
      project: result.project,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Check if unique constraint violation on scope_versions (race condition safety net)
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Conflict: Scope version already created concurrently." },
        { status: 409 }
      );
    }
    console.error("[Projects/Quotation/Accept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while accepting quotation." },
      { status: 500 }
    );
  }
}
