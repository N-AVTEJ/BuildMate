import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectBuilderRejections } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Session
    const auth = await requireAuth();

    // 2. Central Authorization: BUILDER role
    authorize(auth, "PROJECT_REJECT");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 3. Fetch Project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 4. Effective Status Verification
    const now = new Date();
    const effective = computeEffectiveStatus(project, now);

    if (effective.changed) {
      await reconcileProjectStatusInDb(project.id, now);
      return NextResponse.json(
        { error: "The acceptance deadline for this project has expired." },
        { status: 400 }
      );
    }

    if (effectiveStatus !== "AVAILABLE") {
      return NextResponse.json(
        { error: "Project is not available for builder rejection." },
        { status: 400 }
      );
    }

    // 5. Auditable Rejection: Insert into project_builder_rejections
    // Note: Project remains AVAILABLE so other builders can discover and accept it
    await db.insert(projectBuilderRejections).values({
      projectId: project.id,
      builderId: auth.user.id,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: "Project rejected successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Reject] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while rejecting the project." },
      { status: 500 }
    );
  }
}
