import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  deliverables,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { validateDeliverableSubmission } from "@/lib/projects/deliverable-validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "PROJECT_SUBMIT_DELIVERABLE");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const validation = validateDeliverableSubmission(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const deliverableData = validation.data;
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Lock and re-read project row FOR UPDATE
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // 2. Assigned builder verification via centralized authorization
      authorize(auth, "PROJECT_SUBMIT_DELIVERABLE", { builderId: project.builderId });

      // 3. Check if a deliverable row already exists
      const [existingDeliverable] = await tx
        .select()
        .from(deliverables)
        .where(eq(deliverables.projectId, project.id))
        .limit(1);

      if (existingDeliverable) {
        // Edit lock check: deliverables can only be edited while final payment is pending
        if (
          project.status !== "FINAL_PAYMENT_PENDING" &&
          project.status !== "SUBMITTED_FOR_DELIVERY"
        ) {
          return {
            type: "CONFLICT" as const,
            message:
              "Deliverables are locked and cannot be modified after final payment has been processed.",
          };
        }

        // Update existing deliverable
        const [updatedDeliverable] = await tx
          .update(deliverables)
          .set({
            githubUrl: deliverableData.githubUrl,
            repoType: deliverableData.repoType,
            branch: deliverableData.branch,
            commitRef: deliverableData.commitRef,
            description: deliverableData.description,
            implementedFeatures: deliverableData.implementedFeatures,
            documentationUrl: deliverableData.documentationUrl,
            pptUrl: deliverableData.pptUrl,
            demoUrl: deliverableData.demoUrl,
            deploymentUrl: deliverableData.deploymentUrl,
            screenshots: deliverableData.screenshots,
            updatedAt: now,
          })
          .where(eq(deliverables.id, existingDeliverable.id))
          .returning();

        return {
          type: "SUCCESS" as const,
          deliverable: updatedDeliverable,
          updated: true,
        };
      }

      // 4. Initial submission: Project status check
      // Allowed statuses: IN_PROGRESS or OVERDUE (late submissions accepted, keeping history truthful)
      if (
        project.status !== "IN_PROGRESS" &&
        project.status !== "OVERDUE"
      ) {
        return {
          type: "BAD_REQUEST" as const,
          message: `Cannot submit deliverables when project is in ${project.status} status. Active development required.`,
        };
      }

      const initialStatus = project.status;

      // 5. Insert deliverables row
      const [newDeliverable] = await tx
        .insert(deliverables)
        .values({
          projectId: project.id,
          githubUrl: deliverableData.githubUrl,
          repoType: deliverableData.repoType,
          branch: deliverableData.branch,
          commitRef: deliverableData.commitRef,
          description: deliverableData.description,
          implementedFeatures: deliverableData.implementedFeatures,
          documentationUrl: deliverableData.documentationUrl,
          pptUrl: deliverableData.pptUrl,
          demoUrl: deliverableData.demoUrl,
          deploymentUrl: deliverableData.deploymentUrl,
          screenshots: deliverableData.screenshots,
          submittedAt: now,
        })
        .returning();

      // 6. Project status transition: set to FINAL_PAYMENT_PENDING
      await tx
        .update(projects)
        .set({
          status: "FINAL_PAYMENT_PENDING",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id));

      // 7. Dual-hop status history:
      // Hop 1: fromStatus -> SUBMITTED_FOR_DELIVERY
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: initialStatus,
        toStatus: "SUBMITTED_FOR_DELIVERY",
        changedBy: auth.user.id,
      });

      // Hop 2: SUBMITTED_FOR_DELIVERY -> FINAL_PAYMENT_PENDING
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: "SUBMITTED_FOR_DELIVERY",
        toStatus: "FINAL_PAYMENT_PENDING",
        changedBy: auth.user.id,
      });

      // 8. Notify client
      await tx.insert(notifications).values({
        userId: project.clientId,
        message: `Builder has submitted deliverables for "${project.title}". Please review and complete final payment to unlock delivery.`,
      });

      return {
        type: "SUCCESS" as const,
        deliverable: newDeliverable,
        updated: false,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    if (result.type === "BAD_REQUEST") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        deliverable: result.deliverable,
        updated: result.updated,
      },
      { status: result.updated ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Submit/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while submitting project deliverables." },
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
        builderId: projects.builderId,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Only assigned builder or admin can access submission drafting endpoint
    const isAdmin = auth.roles.includes("ADMIN");
    const isAssignedBuilder = project.builderId === auth.user.id;

    if (!isAdmin && !isAssignedBuilder) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [deliverable] = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.projectId, project.id))
      .limit(1);

    return NextResponse.json({
      deliverable: deliverable || null,
      isLocked:
        project.status !== "FINAL_PAYMENT_PENDING" &&
        project.status !== "SUBMITTED_FOR_DELIVERY" &&
        project.status !== "IN_PROGRESS" &&
        project.status !== "OVERDUE",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Submit/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving deliverable submission." },
      { status: 500 }
    );
  }
}
