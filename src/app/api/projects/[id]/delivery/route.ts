import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, deliverables, payments } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";

/**
 * THE DELIVERY-UNLOCK ENDPOINT
 *
 * Spec Section 28 / 33 / 50:
 * The single most critical route in the application — the payment-to-delivery gate.
 *
 * DELIVERY SECURITY INVARIANT:
 * No client, builder, or other non-authorized actor may receive any
 * deliverable content, GitHub URL, deployment URL, documentation URL,
 * PPT URL, screenshot reference, or signed deliverable URL unless:
 *
 * 1. A valid authenticated session exists.
 * 2. The requester is the project client or ADMIN.
 * 3. The project has a deliverable row.
 * 4. A FINAL payment row exists for that exact project.
 * 5. The FINAL payment status is strictly VERIFIED.
 * 6. The project status is DELIVERY_UNLOCKED (or COMPLETED).
 * 7. The project is not DISPUTE_OPEN.
 *
 * All seven conditions are evaluated server-side on every request.
 * No caching of delivery flags, client state, or project status alone can bypass.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Condition 1: A valid authenticated session exists
    const auth = await requireAuth();

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Fetch project fresh from database
    const [project] = await db
      .select({
        id: projects.id,
        projectCode: projects.projectCode,
        title: projects.title,
        clientId: projects.clientId,
        builderId: projects.builderId,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Condition 2: The requester is the project client or ADMIN
    authorize(auth, "PROJECT_VIEW_DELIVERY", { clientId: project.clientId });

    // Condition 3: The project has a deliverable row
    const [deliverable] = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.projectId, project.id))
      .limit(1);

    if (!deliverable) {
      return NextResponse.json(
        { error: "No deliverables found for this project.", locked: true },
        { status: 404 }
      );
    }

    // Condition 4: A FINAL payment row exists for that exact project
    // Condition 5: The FINAL payment status is strictly VERIFIED
    // (Defense-in-depth: Re-query payments table fresh; never trust project.status alone)
    const [finalPayment] = await db
      .select({
        id: payments.id,
        status: payments.status,
        type: payments.type,
      })
      .from(payments)
      .where(
        and(
          eq(payments.projectId, project.id),
          eq(payments.type, "FINAL")
        )
      )
      .limit(1);

    if (!finalPayment || finalPayment.status !== "VERIFIED") {
      return NextResponse.json(
        {
          error: "Delivery locked. Final payment has not been verified.",
          locked: true,
        },
        { status: 403 }
      );
    }

    // Condition 6: The project is not DISPUTE_OPEN
    if (project.status === "DISPUTE_OPEN") {
      return NextResponse.json(
        {
          error:
            "Delivery locked due to an active dispute on this project. An administrator must resolve the dispute before delivery can proceed.",
          locked: true,
          inDispute: true,
        },
        { status: 403 }
      );
    }

    // Condition 7: The project status is DELIVERY_UNLOCKED or COMPLETED
    if (
      project.status !== "DELIVERY_UNLOCKED" &&
      project.status !== "COMPLETED"
    ) {
      return NextResponse.json(
        {
          error: `Delivery locked. Project is not in an unlocked delivery status (current: ${project.status}).`,
          locked: true,
        },
        { status: 403 }
      );
    }

    // All seven conditions passed!
    // Construct safe delivery payload (plain text GitHub URL, no server-side fetch/execution)
    return NextResponse.json({
      success: true,
      deliverable: {
        id: deliverable.id,
        githubUrl: deliverable.githubUrl,
        repoType: deliverable.repoType,
        branch: deliverable.branch,
        commitRef: deliverable.commitRef,
        description: deliverable.description,
        implementedFeatures: deliverable.implementedFeatures,
        documentationUrl: deliverable.documentationUrl,
        pptUrl: deliverable.pptUrl,
        demoUrl: deliverable.demoUrl,
        deploymentUrl: deliverable.deploymentUrl,
        screenshots: deliverable.screenshots,
        submittedAt: deliverable.submittedAt,
      },
      project: {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        status: project.status,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Delivery/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching delivery details." },
      { status: 500 }
    );
  }
}
