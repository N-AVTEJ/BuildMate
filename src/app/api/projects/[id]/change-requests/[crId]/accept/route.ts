import { NextResponse } from "next/server";
import { eq, and, desc, max } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  changeRequests,
  quotations,
  scopeVersions,
  projectRequirements,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeAdvanceBreakdown } from "@/lib/projects/pricing";

const CR_ELIGIBLE_STATUSES = [
  "AWAITING_ADVANCE",
  "ADVANCE_PROOF_SUBMITTED",
  "ADVANCE_VERIFICATION",
  "ADVANCE_VERIFIED",
  "IN_PROGRESS",
] as const;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; crId: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "CHANGE_REQUEST_RESPOND");

    const { id: projectId, crId } = await params;
    if (!projectId || !crId) {
      return NextResponse.json({ error: "Project or Change Request not found." }, { status: 404 });
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

      // 2. Client ownership check
      if (project.clientId !== auth.user.id) {
        return { type: "FORBIDDEN" as const };
      }

      // 3. Status eligibility check
      if (!CR_ELIGIBLE_STATUSES.includes(project.status as any)) {
        return {
          type: "CONFLICT" as const,
          message: `Cannot respond to change request when project is in ${project.status} status.`,
        };
      }

      // 4. Fetch Change Request
      const [cr] = await tx
        .select()
        .from(changeRequests)
        .where(
          and(
            eq(changeRequests.id, crId),
            eq(changeRequests.projectId, projectId)
          )
        )
        .limit(1);

      if (!cr) {
        return { type: "CR_NOT_FOUND" as const };
      }

      if (cr.status !== "PENDING") {
        return {
          type: "CONFLICT" as const,
          message: `Change request is already ${cr.status}.`,
        };
      }

      // 5. Server-side price recalculation
      // WARN-2 guard: totalPrice must not be null at this point.
      // Status eligibility prevents this in practice, but we enforce it explicitly.
      if (project.totalPrice === null) {
        return {
          type: "CONFLICT" as const,
          message: "Project total price is not set. Cannot apply change request.",
        };
      }
      const currentTotal = project.totalPrice;
      const newTotalPrice = currentTotal + cr.additionalCost;
      const { advanceAmount: newAdvance, remainingAmount: newRemaining } =
        computeAdvanceBreakdown(newTotalPrice);

      // 6. Concurrency-safe scope version creation
      const [maxVersionRow] = await tx
        .select({ maxVersion: max(scopeVersions.versionNumber) })
        .from(scopeVersions)
        .where(eq(scopeVersions.projectId, projectId));

      const nextVersion = (Number(maxVersionRow?.maxVersion) || 0) + 1;

      const requirementsList = await tx
        .select()
        .from(projectRequirements)
        .where(eq(projectRequirements.projectId, projectId));

      const [acceptedQuotation] = await tx
        .select()
        .from(quotations)
        .where(
          and(
            eq(quotations.projectId, projectId),
            eq(quotations.status, "ACCEPTED")
          )
        )
        .orderBy(desc(quotations.createdAt))
        .limit(1);

      const projectSnapshot = {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        subject: project.subject,
        description: project.description,
        techStack: project.techStack,
        budgetMin: project.budgetMin,
        budgetMax: project.budgetMax,
        totalPrice: newTotalPrice,
        advanceAmount: newAdvance,
        remainingAmount: newRemaining,
        acceptanceDeadline: project.acceptanceDeadline,
        builderAcceptedAt: project.builderAcceptedAt,
        changeRequestId: cr.id,
        capturedAt: now.toISOString(),
      };

      const [newScopeVersion] = await tx
        .insert(scopeVersions)
        .values({
          projectId,
          versionNumber: nextVersion,
          projectSnapshot,
          requirementsSnapshot: requirementsList,
          quotationSnapshot: acceptedQuotation || {},
        })
        .returning();

      // 7. Update change request to ACCEPTED
      const [updatedCR] = await tx
        .update(changeRequests)
        .set({
          status: "ACCEPTED",
          updatedAt: now,
        })
        .where(eq(changeRequests.id, cr.id))
        .returning();

      // 8. Update project prices and optionally extend development deadline
      const projectUpdatePayload: Record<string, any> = {
        totalPrice: newTotalPrice,
        advanceAmount: newAdvance,
        remainingAmount: newRemaining,
        updatedAt: now,
      };

      if (project.developmentDeadline && cr.additionalTimeDays > 0) {
        const extendedDeadline = new Date(project.developmentDeadline);
        extendedDeadline.setDate(
          extendedDeadline.getDate() + cr.additionalTimeDays
        );
        projectUpdatePayload.developmentDeadline = extendedDeadline;
      }

      const [updatedProject] = await tx
        .update(projects)
        .set(projectUpdatePayload)
        .where(eq(projects.id, projectId))
        .returning();

      return {
        type: "SUCCESS" as const,
        scopeVersion: newScopeVersion,
        changeRequest: updatedCR,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND" || result.type === "CR_NOT_FOUND") {
      return NextResponse.json({ error: "Project or Change Request not found." }, { status: 404 });
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
      changeRequest: result.changeRequest,
      project: result.project,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Conflict: Scope version already created concurrently." },
        { status: 409 }
      );
    }
    console.error("[Projects/ChangeRequests/Accept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while accepting change request." },
      { status: 500 }
    );
  }
}
