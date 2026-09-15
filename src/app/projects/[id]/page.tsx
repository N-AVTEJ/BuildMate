import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";
import { RequirementUploadForm } from "@/components/projects/requirement-upload-form";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  const { id } = await params;

  // 2. Fetch Project by ID
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  // 3. Server-Side Ownership Enforcement (UI 403 Access Denied defense)
  // If project does not exist OR belongs to another user:
  // Render a consistent 403 Access Denied view directly.
  // Never redirect to another page, never reveal project data, and never hint at existence.
  if (!project || project.clientId !== auth.user.id) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            You do not have permission to view this project. If you believe this is an error, please verify you are logged into the correct account.
          </p>
          <Link
            href="/projects"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            ← Back to My Projects
          </Link>
        </div>
      </main>
    );
  }

  // 4. Reconcile Effective Status Server-Side
  const now = new Date();
  const effectiveStatus = computeEffectiveStatus(project, now);
  if (project.status === "AVAILABLE" && effectiveStatus === "EXPIRED_NO_BUILDER") {
    await reconcileProjectStatusInDb(project.id, now);
    project.status = "EXPIRED_NO_BUILDER";
  }

  // 5. Fetch Requirements
  const requirements = await db
    .select()
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, project.id));

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/projects"
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            ← Back to Projects
          </Link>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              project.status === "AVAILABLE"
                ? "bg-emerald-100 text-emerald-800"
                : project.status === "EXPIRED_NO_BUILDER"
                ? "bg-rose-100 text-rose-800"
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
              <span className="text-xs text-gray-500 block">Budget Range</span>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50/50 p-4 rounded-lg border border-gray-100">
              {project.description}
            </p>
          </div>
        </div>

        {/* Requirements & Attachments Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Project Requirements & Reference Files</h2>

          {requirements.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No reference files uploaded yet.</p>
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

          {/* Upload Form - Rendered ONLY if effectively AVAILABLE */}
          {project.status === "AVAILABLE" && (
            <RequirementUploadForm projectId={project.id} />
          )}
        </div>

        {/* Phase 5 Status Cards */}
        {project.status === "QUOTATION_SENT" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-amber-950">Quotation Received</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                The assigned builder has submitted a formal quotation for your review. Inspect the breakdown and accept or reject the proposal.
              </p>
            </div>
            <Link
              href={`/projects/${project.id}/quotation`}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg transition whitespace-nowrap shadow-sm"
            >
              Review Quotation →
            </Link>
          </div>
        )}

        {project.status === "ACCEPTED_PENDING_QUOTE" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 flex items-start gap-4">
            <span className="text-2xl">⏳</span>
            <div>
              <h3 className="text-base font-bold text-blue-900">Builder Assigned — Preparing Quotation</h3>
              <p className="text-xs text-blue-700 mt-0.5">
                A builder has acquired your project and is preparing the total quotation and work schedule.
              </p>
            </div>
          </div>
        )}

        {project.status === "AWAITING_ADVANCE" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6 flex items-start gap-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="text-base font-bold text-emerald-950">Scope Locked — Advance Payment Pending</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Quotation has been accepted and project scope (Version 1) is locked. Advance payment submission and verification will be enabled in Phase 6.
              </p>
              {project.totalPrice && (
                <div className="mt-3 flex gap-4 text-xs font-medium text-emerald-900">
                  <span>Contracted Total: ₹{project.totalPrice.toLocaleString()}</span>
                  <span>•</span>
                  <span>Advance Due: ₹{project.advanceAmount?.toLocaleString()}</span>
                  <span>•</span>
                  <span>Remaining: ₹{project.remainingAmount?.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
