import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";
import { BuilderProjectActions } from "@/components/builder/builder-project-actions";

export default async function BuilderProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Builder Role Authorization Check
  if (!auth.roles.includes("BUILDER")) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Only accounts with the Builder role can view builder project specifications.
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

  const { id: projectId } = await params;

  // 3. Fetch Project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  // 4. Server-Side Access Control (UI 403 Access Denied)
  // Accessible only if: project is AVAILABLE, or belongs to this builder (ACCEPTED_PENDING_QUOTE or active)
  const isAccessible =
    project &&
    (project.status === "AVAILABLE" ||
      project.builderId === auth.user.id ||
      auth.roles.includes("ADMIN"));

  if (!project || !isAccessible) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            This project is not currently available for discovery or belongs to another builder.
          </p>
          <Link
            href="/builder"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            ← Back to Available Projects
          </Link>
        </div>
      </main>
    );
  }

  // 5. Reconcile Lazy Expiry
  const now = new Date();
  const effectiveStatus = computeEffectiveStatus(project, now);
  if (project.status === "AVAILABLE" && effectiveStatus === "EXPIRED_NO_BUILDER") {
    await reconcileProjectStatusInDb(project.id, now);
    project.status = "EXPIRED_NO_BUILDER";
  }

  // 6. Fetch Project Requirements / Attachments
  const requirements = await db
    .select()
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, project.id));

  const isAssignedToCurrentBuilder = project.builderId === auth.user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Discovery"
      />

      <main className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/builder"
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            ← Back to Available Projects
          </Link>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              project.status === "AVAILABLE"
                ? "bg-emerald-100 text-emerald-800"
                : project.status === "ACCEPTED_PENDING_QUOTE"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {project.status}
          </span>
        </div>

        {/* Project Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div>
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider">
                {project.projectCode}
              </span>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{project.title}</h1>
              <p className="text-sm text-gray-500 mt-1">{project.subject}</p>
            </div>

            {project.status === "AVAILABLE" && project.acceptanceDeadline && (
              <AcceptanceCountdown deadlineIso={project.acceptanceDeadline.toISOString()} />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 block">Client Budget</span>
              <span className="text-base font-semibold text-gray-900">
                ${project.budgetMin.toLocaleString()} - ${project.budgetMax.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 block">Tech Stack</span>
              <span className="text-base font-semibold text-gray-900">{project.techStack}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 block">Submitted At</span>
              <span className="text-base font-semibold text-gray-900">
                {new Date(project.submittedAt || project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Scope & Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50/50 p-4 rounded-lg border border-gray-100">
              {project.description}
            </p>
          </div>
        </div>

        {/* Requirements & Attachments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Project Requirements & Reference Files</h2>

          {requirements.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No reference files uploaded by the client.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {requirements.map((reqItem) => (
                <div key={reqItem.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📎</span>
                    <div>
                      <span className="text-sm font-medium text-gray-800 block">
                        {reqItem.fileUrl.split("/").pop()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {reqItem.fileType} • {(reqItem.fileSize / 1024).toFixed(1)} KB •{" "}
                        {new Date(reqItem.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <a
                    href={reqItem.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Builder Status Banner or Action Card */}
        {project.status === "AVAILABLE" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Acquire this Project</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Accepting this project locks it to your builder account and advances it to quotation preparation.
              </p>
            </div>
            <BuilderProjectActions projectId={project.id} />
          </div>
        )}

        {project.status === "ACCEPTED_PENDING_QUOTE" && isAssignedToCurrentBuilder && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-base font-bold text-blue-900">
                  Project Acquired — Awaiting Quotation (Phase 5)
                </h3>
                <p className="text-xs text-blue-700 mt-1">
                  You accepted this project on{" "}
                  {project.builderAcceptedAt
                    ? new Date(project.builderAcceptedAt).toLocaleString()
                    : "recently"}
                  . Quotation price entry and submission will be available in Phase 5.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
