import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 1. Fetch Project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    // 2. IDOR Defense & Central Authorization
    // Central authorization allows OWNER, ASSIGNED BUILDER, AVAILABLE BUILDER, or ADMIN.
    // Return identical 404 if project does not exist OR user is unauthorized (preventing existence probing).
    if (!project || !can(auth, "PROJECT_VIEW_OWN", { clientId: project.clientId, builderId: project.builderId, status: project.status }).allowed) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 3. Reconcile Effective Status if Expired
    const now = new Date();
    const effectiveStatus = computeEffectiveStatus(project, now);
    if (project.status === "AVAILABLE" && effectiveStatus === "EXPIRED_NO_BUILDER") {
      await reconcileProjectStatusInDb(project.id, now);
      project.status = "EXPIRED_NO_BUILDER";
    }

    // 4. Fetch Associated Requirements
    const requirements = await db
      .select()
      .from(projectRequirements)
      .where(eq(projectRequirements.projectId, project.id));

    return NextResponse.json({ project, requirements });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Detail] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching project details." },
      { status: 500 }
    );
  }
}
