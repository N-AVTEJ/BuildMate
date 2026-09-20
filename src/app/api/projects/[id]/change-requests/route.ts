import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, changeRequests, notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize, isProjectParticipant } from "@/lib/authorization";

const CR_ELIGIBLE_STATUSES = [
  "AWAITING_ADVANCE",
  "ADVANCE_PROOF_SUBMITTED",
  "ADVANCE_VERIFICATION",
  "ADVANCE_VERIFIED",
  "IN_PROGRESS",
] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "CHANGE_REQUEST_SUBMIT");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { description, additionalCost, additionalTimeDays } = body;

    // Validation
    if (typeof description !== "string" || !description.trim() || description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be a non-empty string up to 2000 characters." },
        { status: 400 }
      );
    }

    if (
      typeof additionalCost !== "number" ||
      !Number.isInteger(additionalCost) ||
      additionalCost < 0
    ) {
      return NextResponse.json(
        { error: "additionalCost must be a non-negative integer." },
        { status: 400 }
      );
    }

    if (
      typeof additionalTimeDays !== "number" ||
      !Number.isInteger(additionalTimeDays) ||
      additionalTimeDays < 1
    ) {
      return NextResponse.json(
        { error: "additionalTimeDays must be a positive integer (at least 1 day)." },
        { status: 400 }
      );
    }

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

      // 2. Builder assignment check via centralized authorization
      authorize(auth, "CHANGE_REQUEST_SUBMIT", { builderId: project.builderId });

      // 3. Status eligibility check
      if (!CR_ELIGIBLE_STATUSES.includes(project.status as any)) {
        return {
          type: "CONFLICT" as const,
          message: `Change requests cannot be submitted when project is in ${project.status} status.`,
        };
      }

      // 4. Pending CR check (only one PENDING CR allowed at a time)
      const [existingPending] = await tx
        .select({ id: changeRequests.id })
        .from(changeRequests)
        .where(
          and(
            eq(changeRequests.projectId, projectId),
            eq(changeRequests.status, "PENDING")
          )
        )
        .limit(1);

      if (existingPending) {
        return {
          type: "CONFLICT" as const,
          message: "A change request is already pending client review.",
        };
      }

      // 5. Insert change request
      const [newChangeRequest] = await tx
        .insert(changeRequests)
        .values({
          projectId,
          description: description.trim(),
          additionalCost,
          additionalTimeDays,
          status: "PENDING",
        })
        .returning();

      // 6. Insert Client Notification in the SAME transaction
      await tx.insert(notifications).values({
        userId: project.clientId,
        message: `New change request submitted for project "${project.title}" (ID: ${project.id}): Change Request ${newChangeRequest.id} - additional cost ₹${newChangeRequest.additionalCost}, +${newChangeRequest.additionalTimeDays} days. Description: ${newChangeRequest.description.slice(0, 100)}`,
        read: false,
      });

      return {
        type: "SUCCESS" as const,
        changeRequest: newChangeRequest,
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
      changeRequest: result.changeRequest,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/ChangeRequests/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while creating change request." },
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

    if (!isProjectParticipant(auth.user, auth.roles, project)) {
      return NextResponse.json(
        { error: "Forbidden. You do not have permission to view change requests for this project." },
        { status: 403 }
      );
    }

    const crList = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.projectId, projectId))
      .orderBy(desc(changeRequests.createdAt));

    return NextResponse.json({
      changeRequests: crList,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/ChangeRequests/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving change requests." },
      { status: 500 }
    );
  }
}
