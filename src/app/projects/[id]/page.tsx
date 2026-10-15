import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements, payments } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { reconcilePaymentReminders } from "@/lib/projects/payment-reminders";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";
import { RequirementUploadForm } from "@/components/projects/requirement-upload-form";
import { RazorpayCheckoutButton } from "@/components/payments/razorpay-checkout-button";
import { PortalHeader } from "@/components/navigation/portal-header";

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
  if (!project || project.clientId !== auth.user.id) {
    return (
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 border-2 border-black rounded-xl text-amber-800 flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            🔒
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            You do not have permission to view this project. If you believe this is an error, please verify you are logged into the correct account.
          </p>
          <Link
            href="/projects"
            className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
          >
            ← Back to My Projects
          </Link>
        </div>
      </main>
    );
  }

  // 4. Reconcile Effective Status Server-Side
  const now = new Date();
  const effective = computeEffectiveStatus(project, now);
  if (effective.changed) {
    const updatedStatus = await reconcileProjectStatusInDb(project.id, now);
    project.status = updatedStatus;
  }

  // 4.5 Reconcile On-Demand Payment Reminders (Spec Section 18)
  if (project.status === "AWAITING_ADVANCE") {
    await reconcilePaymentReminders(project, now);
  }

  // 5. Fetch Requirements
  const requirements = await db
    .select()
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, project.id));

  // 6. Fetch Latest Payment Record
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.projectId, project.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Client Portal"
      />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/projects"
            className="neo-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-heading font-black uppercase tracking-wider text-black"
          >
            ← Back to Projects
          </Link>
          <span
            className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${
              project.status === "AVAILABLE"
                ? "bg-emerald-300 text-black"
                : project.status === "EXPIRED_NO_BUILDER"
                ? "bg-rose-300 text-black"
                : project.status === "IN_PROGRESS"
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
                <p className="text-xs font-medium text-black/80">Active development and delivery are locked while BuildMate administrators mediate.</p>
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
              <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Budget Range</span>
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
            <h3 className="font-heading font-black text-xs uppercase tracking-wider text-black mb-2">Scope &amp; Requirements</h3>
            <p className="text-sm text-black/90 font-medium whitespace-pre-wrap leading-relaxed bg-[#fffdf0] p-4 rounded-xl border-2 border-black">
              {project.description}
            </p>
          </div>
        </div>

        {/* Requirements & Attachments Card */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 mb-6">
          <h2 className="font-heading font-black text-xl text-black mb-4">Project Requirements &amp; Reference Files</h2>

          {requirements.length === 0 ? (
            <p className="text-sm text-black/60 font-medium italic">No reference files uploaded yet.</p>
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

          {/* Upload Form - Rendered ONLY if effectively AVAILABLE */}
          {project.status === "AVAILABLE" && (
            <div className="mt-4 pt-4 border-t-2 border-black/10">
              <RequirementUploadForm projectId={project.id} />
            </div>
          )}
        </div>

        {/* Phase 5 Status Cards */}
        {project.status === "QUOTATION_SENT" && (
          <div className="bg-[#ffe17c] border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 neo-shadow-md">
            <div>
              <div className="inline-block px-2.5 py-0.5 bg-black text-[#ffe17c] text-[11px] font-heading font-black uppercase tracking-wider rounded mb-2">
                Action Required
              </div>
              <h3 className="font-heading font-black text-xl text-black">Quotation Received</h3>
              <p className="text-xs text-black/80 font-medium mt-1 max-w-lg">
                The assigned builder has submitted a formal quotation for your review. Inspect the milestone breakdown, budget, and accept or reject the proposal.
              </p>
            </div>
            <Link
              href={`/projects/${project.id}/quotation`}
              className="neo-btn px-5 py-3 bg-black text-white font-heading font-black text-xs uppercase tracking-wider rounded-xl whitespace-nowrap"
            >
              Review Quotation →
            </Link>
          </div>
        )}

        {project.status === "ACCEPTED_PENDING_QUOTE" && (
          <div className="bg-[#b7c6c2]/40 border-2 border-black rounded-2xl p-6 mb-6 flex items-start gap-4 neo-shadow">
            <span className="text-3xl">⏳</span>
            <div>
              <h3 className="font-heading font-black text-lg text-black">Builder Assigned — Preparing Quotation</h3>
              <p className="text-xs text-black/80 font-medium mt-1">
                A builder has acquired your project and is preparing the total quotation and work schedule.
              </p>
            </div>
          </div>
        )}

        {/* Phase 6 Payment Cards */}
        {/* Phase 14: Advance Payment with Razorpay Standard Checkout */}
        {(project.status === "AWAITING_ADVANCE" || project.status === "PAYMENT_REJECTED") && (
          <div className="bg-white border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 neo-shadow-md">
            <RazorpayCheckoutButton
              projectId={project.id}
              projectCode={project.projectCode}
              amount={project.advanceAmount || 0}
              paymentType="ADVANCE"
              advancePaymentDeadline={project.advancePaymentDeadline?.toISOString()}
              rejectionReason={existingPayment?.status === "REJECTED" ? existingPayment.rejectionReason : null}
            />
          </div>
        )}

        {project.status === "IN_PROGRESS" && (
          <div className="bg-emerald-100 border-2 border-black rounded-2xl p-6 mb-6 flex items-start gap-4 neo-shadow">
            <span className="text-3xl">🚀</span>
            <div>
              <h3 className="font-heading font-black text-lg text-black">Development In Progress</h3>
              <p className="text-xs text-black/80 font-medium mt-1">
                Advance payment has been verified via Razorpay and work is actively underway.
              </p>
              {project.developmentStartedAt && (
                <div className="mt-2 text-xs font-bold text-black">
                  Started on: {new Date(project.developmentStartedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 14: Final Payment with Razorpay Standard Checkout */}
        {project.status === "FINAL_PAYMENT_PENDING" && (
          <div className="bg-white border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 neo-shadow-md">
            <RazorpayCheckoutButton
              projectId={project.id}
              projectCode={project.projectCode}
              amount={project.remainingAmount || 0}
              paymentType="FINAL"
              rejectionReason={existingPayment?.status === "REJECTED" && existingPayment.type === "FINAL" ? existingPayment.rejectionReason : null}
            />
          </div>
        )}

        {/* Phase 8: Delivery Unlocked / Completed Banner */}
        {(project.status === "DELIVERY_UNLOCKED" || project.status === "CLIENT_REVIEW" || project.status === "COMPLETED") && (
          <div className="bg-[#ffe17c] border-2 border-black rounded-2xl p-6 sm:p-8 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 neo-shadow-md">
            <div className="flex items-start gap-4">
              <span className="text-3xl">📦</span>
              <div>
                <h3 className="font-heading font-black text-xl text-black">
                  {project.status === "COMPLETED" ? "Project Completed" : "Project Deliverables Ready!"}
                </h3>
                <p className="text-xs text-black/80 font-medium mt-1">
                  Final payment is verified and source code delivery is unlocked.
                </p>
              </div>
            </div>
            <Link
              href={`/projects/${project.id}/delivery`}
              className="neo-btn px-5 py-3 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl text-center whitespace-nowrap"
            >
              Access Deliverables →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
