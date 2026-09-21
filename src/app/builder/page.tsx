import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";
import { BuilderProjectActions } from "@/components/builder/builder-project-actions";

export default async function BuilderDiscoveryPage() {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Centralized Authorization: BUILDER Role Verification
  const isAuthorized = can(auth, "PROJECT_LIST_AVAILABLE").allowed;
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Only accounts with the Builder role can access the builder discovery portal.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
          >
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  // 3. Query Candidate Available Projects
  const candidateProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, "AVAILABLE"))
    .orderBy(desc(projects.submittedAt));

  // 4. Reconcile Lazy Expiry Server-Side
  const now = new Date();
  const availableProjects: Array<(typeof candidateProjects)[0] & { requirementCount: number }> = [];

  for (const proj of candidateProjects) {
    const effective = computeEffectiveStatus(proj, now);

    if (effective.changed) {
      await reconcileProjectStatusInDb(proj.id, now);
      continue;
    }

    if (effective.status === "AVAILABLE") {
      const [reqs] = await db
        .select({ count: count() })
        .from(projectRequirements)
        .where(eq(projectRequirements.projectId, proj.id));

      availableProjects.push({
        ...proj,
        status: "AVAILABLE",
        requirementCount: reqs ? Number(reqs.count) : 0,
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Discovery"
      />

      <main className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Available Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse and acquire newly submitted projects looking for vetted builders.
          </p>
        </div>

        {availableProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-1">No available projects</h3>
            <p className="text-sm text-gray-500">
              There are currently no new projects awaiting builder discovery. Please check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {availableProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-gray-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider">
                      {project.projectCode}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">
                      <Link
                        href={`/builder/projects/${project.id}`}
                        className="hover:text-blue-600 transition"
                      >
                        {project.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{project.subject}</p>
                  </div>

                  {project.acceptanceDeadline && (
                    <AcceptanceCountdown deadlineIso={project.acceptanceDeadline.toISOString()} />
                  )}
                </div>

                <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">
                  {project.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <span className="text-gray-400 block">Budget Range:</span>
                    <span className="font-semibold text-gray-900">
                      ${project.budgetMin.toLocaleString()} - ${project.budgetMax.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-gray-200" />
                  <div>
                    <span className="text-gray-400 block">Tech Stack:</span>
                    <span className="font-semibold text-gray-900">{project.techStack}</span>
                  </div>
                  <div className="h-6 w-px bg-gray-200" />
                  <div>
                    <span className="text-gray-400 block">Submitted:</span>
                    <span className="font-semibold text-gray-900">
                      {new Date(project.submittedAt || project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-100">
                  <Link
                    href={`/builder/projects/${project.id}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    View Project Details & Requirements →
                  </Link>

                  <BuilderProjectActions projectId={project.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
