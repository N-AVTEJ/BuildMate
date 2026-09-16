import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";

export async function GET() {
  try {
    // 1. Authenticate Session
    const auth = await requireAuth();

    // 2. Centralized Authorization: BUILDER or ADMIN
    authorize(auth, "PROJECT_LIST_AVAILABLE");

    // 3. Query Candidate Available Projects
    const candidateProjects = await db
      .select({
        id: projects.id,
        projectCode: projects.projectCode,
        title: projects.title,
        subject: projects.subject,
        description: projects.description,
        techStack: projects.techStack,
        budgetMin: projects.budgetMin,
        budgetMax: projects.budgetMax,
        status: projects.status,
        acceptanceDeadline: projects.acceptanceDeadline,
        submittedAt: projects.submittedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.status, "AVAILABLE"))
      .orderBy(desc(projects.submittedAt));

    // 4. Reconcile Lazy Expiry and Filter Authoritative Effective Status
    const now = new Date();
    const availableProjects: Array<(typeof candidateProjects)[0] & { requirements: any[] }> = [];

    for (const proj of candidateProjects) {
      const effective = computeEffectiveStatus(proj, now);

      if (effective.changed) {
        // Transactionally reconcile in DB
        await reconcileProjectStatusInDb(proj.id, now);
        // Excluded from available results
        continue;
      }

      if (effective.status === "AVAILABLE") {
        // Fetch requirement reference files for this available project
        const requirements = await db
          .select({
            id: projectRequirements.id,
            fileUrl: projectRequirements.fileUrl,
            fileType: projectRequirements.fileType,
            fileSize: projectRequirements.fileSize,
            uploadedAt: projectRequirements.uploadedAt,
          })
          .from(projectRequirements)
          .where(eq(projectRequirements.projectId, proj.id));

        availableProjects.push({
          ...proj,
          status: "AVAILABLE",
          requirements,
        });
      }
    }

    return NextResponse.json({ projects: availableProjects });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Available] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching available projects." },
      { status: 500 }
    );
  }
}
