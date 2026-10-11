import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements, deliverables } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";
import { BuilderProjectActions } from "@/components/builder/builder-project-actions";
import { QuotationForm } from "@/components/builder/quotation-form";
import { DeliverableSubmissionForm } from "@/components/builder/deliverable-submission-form";

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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            Only accounts with the Builder role can view builder project specifications.
          </p>
          <Link
            href="/"
            className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
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
  const isAccessible =
    project &&
    (project.status === "AVAILABLE" ||
      project.builderId === auth.user.id ||
      auth.roles.includes("ADMIN"));

  if (!project || !isAccessible) {
    return (
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-amber-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            🔒
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            This project is not currently available for discovery or belongs to another builder.
          </p>
          <Link
            href="/builder"
            className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
          >
            ← Back to Available Projects
          </Link>
        </div>
      </main>
    );
  }

  // 5. Reconcile Lazy Status
  const now = new Date();
  const effective = computeEffectiveStatus(project, now);
  if (effective.changed) {
    const updatedStatus = await reconcileProjectStatusInDb(project.id, now);
    project.status = updatedStatus;
  }

  // 6. Fetch Project Requirements / Attachments
  const requirements = await db
    .select()
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, project.id));

  const isAssignedToCurrentBuilder = project.builderId === auth.user.id;

  // 7. Fetch Existing Deliverables if Assigned
  const [existingDeliverable] = isAssignedToCurrentBuilder
    ? await db
        .select()
        .from(deliverables)
        .where(eq(deliverables.projectId, project.id))
        .limit(1)
    : [null];

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Discovery"
      />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/builder"
            className="neo-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-heading font-black uppercase tracking-wider text-black"
          >
            ← Back to Available Projects
          </Link>
          <span
            className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${
              project.status === "AVAILABLE"
                ? "bg-emerald-300 text-black"
                : project.status === "ACCEPTED_PENDING_QUOTE"
                ? "bg-[#ffe17c] text-black"
                : "bg-white text-black"
            }`}
          >
            {project.status}
          </span>
        </div>

        {project.status === "DISPUTE_OPEN" && (
          <div className="mb-6 p-5 bg-rose-200 border-2 border-black rounded-2xl flex items-center justify-between gap-4 neo-shadow">
            <div className="flex items-center gap-3 text-black">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-heading font-black">This project is currently in DISPUTE_OPEN status.</p>
                <p className="text-xs font-medium text-black/80">Active development is locked while BuildMate administrators mediate.</p>
              </div>
            </div>
            <Link
              href={`/projects/${project.id}/dispute/new`}
              className="neo-btn px-4 py-2 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl shrink-0"
            >
              View Dispute
            </Link>
          </div>
        )}

        {/* Project Header Card */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b-2 border-black/10 pb-6 mb-6">
            <div>
              <span className="font-heading font-black text-xs bg-black text-[#ffe17c] px-2.5 py-1 border border-black rounded uppercase tracking-wider inline-block">
                {project.projectCode}
              </span>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-black mt-2 tracking-tight">{project.title}</h1>
              <p className="text-sm text-black/70 font-semibold mt-1">{project.subject}</p>
            </div>

            <div className="flex items-center gap-3">
              {project.status === "AVAILABLE" && project.acceptanceDeadline && (
                <AcceptanceCountdown deadlineIso={project.acceptanceDeadline.toISOString()} />
              )}
              <Link
                href={`/projects/${project.id}/messages`}
                className="neo-btn px-4 py-2 bg-[#b7c6c2] hover:bg-[#ffe17c] text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black flex items-center gap-2"
              >
                <span>💬</span> Messages
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-3.5 bg-[#fffdf0] rounded-xl border-2 border-black neo-shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Client Budget</span>
              <span className="text-base font-heading font-black text-black">
                ₹{project.budgetMin.toLocaleString()} - ₹{project.budgetMax.toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 bg-[#fffdf0] rounded-xl border-2 border-black neo-shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Tech Stack</span>
              <span className="text-base font-heading font-black text-black">{project.techStack}</span>
            </div>
            <div className="p-3.5 bg-[#fffdf0] rounded-xl border-2 border-black neo-shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Requested Completion</span>
              <span className="text-base font-heading font-black text-black">
                {project.requestedCompletionDate
                  ? new Date(project.requestedCompletionDate + "T00:00:00Z").toLocaleDateString(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })
                  : "Not specified"}
              </span>
            </div>
            <div className="p-3.5 bg-[#fffdf0] rounded-xl border-2 border-black neo-shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Official Deadline</span>
              <span className="text-base font-heading font-black text-black">
                {project.developmentDeadline
                  ? new Date(project.developmentDeadline).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                  : "Pending verification"}
              </span>
            </div>
          </div>

          <div>
            <h3 className="font-heading font-black text-xs uppercase tracking-wider text-black mb-2">Scope &amp; Description</h3>
            <p className="text-sm text-black/90 font-medium whitespace-pre-wrap leading-relaxed bg-[#fffdf0] p-4 rounded-xl border-2 border-black">
              {project.description}
            </p>
          </div>
        </div>

        {/* Requirements & Attachments */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 mb-6">
          <h2 className="font-heading font-black text-xl text-black mb-4">Project Requirements &amp; Reference Files</h2>

          {requirements.length === 0 ? (
            <p className="text-sm text-black/60 font-medium italic">No reference files uploaded by the client.</p>
          ) : (
            <div className="divide-y-2 border-2 border-black rounded-xl overflow-hidden mb-4 bg-[#fffdf0]">
              {requirements.map((reqItem) => (
                <div key={reqItem.id} className="p-3.5 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📎</span>
                    <div>
                      <span className="text-sm font-heading font-black text-black block">
                        {reqItem.fileUrl.split("/").pop()}
                      </span>
                      <span className="text-xs font-semibold text-black/60">
                        {reqItem.fileType} • {(reqItem.fileSize / 1024).toFixed(1)} KB •{" "}
                        {new Date(reqItem.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <a
                    href={reqItem.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="neo-btn px-3 py-1 bg-[#ffe17c] text-black text-xs font-heading font-black uppercase rounded-lg border-2 border-black"
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
          <div className="bg-[#ffe17c] rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-block px-2.5 py-0.5 bg-black text-[#ffe17c] text-[11px] font-heading font-black uppercase tracking-wider rounded mb-1">
                Open Project
              </div>
              <h3 className="font-heading font-black text-xl text-black">Acquire this Project</h3>
              <p className="text-xs text-black/80 font-medium mt-1 max-w-lg">
                Accepting this project locks it to your builder account and advances it to quotation preparation.
              </p>
            </div>
            <BuilderProjectActions projectId={project.id} />
          </div>
        )}

        {project.status === "ACCEPTED_PENDING_QUOTE" && isAssignedToCurrentBuilder && (
          <div className="space-y-6 mb-6">
            <div className="bg-[#ffe17c] border-2 border-black rounded-2xl p-6 flex items-center gap-4 neo-shadow">
              <span className="text-3xl">📋</span>
              <div>
                <h3 className="font-heading font-black text-lg text-black">Project Acquired — Submit Quotation</h3>
                <p className="text-xs text-black/80 font-medium mt-0.5">
                  You accepted this project on{" "}
                  {project.builderAcceptedAt
                    ? new Date(project.builderAcceptedAt).toLocaleString()
                    : "recently"}
                  . Enter your total quotation price below to submit it to the client.
                </p>
              </div>
            </div>
            <div className="bg-white border-2 border-black rounded-2xl p-6 sm:p-8 neo-shadow-md">
              <QuotationForm projectId={project.id} />
            </div>
          </div>
        )}

        {project.status === "QUOTATION_SENT" && isAssignedToCurrentBuilder && (
          <div className="bg-[#ffe17c]/60 border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 neo-shadow-md">
            <div className="flex items-start gap-4">
              <span className="text-3xl">⏳</span>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="font-heading font-black text-xl text-black">
                    Quotation Sent — Awaiting Client Review
                  </h3>
                  <p className="text-xs text-black/80 font-medium mt-1">
                    Your quotation has been sent to the client. Scope locking and advance deposit will proceed once accepted.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border-2 border-black neo-shadow-sm text-xs">
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Total Quotation</span>
                    <span className="text-base font-heading font-black text-black">
                      ₹{project.totalPrice ? project.totalPrice.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Required Advance</span>
                    <span className="text-base font-heading font-black text-emerald-700">
                      ₹{project.advanceAmount ? project.advanceAmount.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Remaining Balance</span>
                    <span className="text-base font-heading font-black text-black">
                      ₹{project.remainingAmount ? project.remainingAmount.toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {project.status === "AWAITING_ADVANCE" && isAssignedToCurrentBuilder && (
          <div className="bg-emerald-100 border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 neo-shadow-md">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🔒</span>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="font-heading font-black text-xl text-black">
                    Scope Locked — Awaiting Client Advance Payment
                  </h3>
                  <p className="text-xs text-black/80 font-medium mt-1">
                    The client has accepted your quotation. Scope version 1 is locked. The project will advance to development once the client pays the required advance.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border-2 border-black neo-shadow-sm text-xs">
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Locked Total</span>
                    <span className="text-base font-heading font-black text-black">
                      ₹{project.totalPrice ? project.totalPrice.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Advance Due</span>
                    <span className="text-base font-heading font-black text-emerald-700">
                      ₹{project.advanceAmount ? project.advanceAmount.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-black/60 font-black uppercase tracking-wider block text-[11px]">Remaining Due on Delivery</span>
                    <span className="text-base font-heading font-black text-black">
                      ₹{project.remainingAmount ? project.remainingAmount.toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deliverables Submission Form for Assigned Builder */}
        {isAssignedToCurrentBuilder &&
          (project.status === "IN_PROGRESS" ||
            project.status === "OVERDUE" ||
            project.status === "FINAL_PAYMENT_PENDING" ||
            project.status === "FINAL_PAYMENT_PROOF_SUBMITTED" ||
            project.status === "DELIVERY_UNLOCKED" ||
            project.status === "CLIENT_REVIEW" ||
            project.status === "COMPLETED") && (
            <div className="mt-6 bg-white border-2 border-black rounded-2xl p-6 sm:p-8 neo-shadow-md">
              <DeliverableSubmissionForm
                projectId={project.id}
                projectStatus={project.status}
                initialDeliverable={existingDeliverable}
              />
            </div>
          )}
      </main>
    </div>
  );
}
