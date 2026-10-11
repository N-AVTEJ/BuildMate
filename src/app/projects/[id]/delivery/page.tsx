import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, deliverables, payments } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import { DeliveryAcceptButton } from "@/components/projects/delivery-accept-button";

export const dynamic = "force-dynamic";

interface DeliveryPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDeliveryPage({ params }: DeliveryPageProps) {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  if (!projectId) {
    notFound();
  }

  // 1. Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    notFound();
  }

  // 2. Ownership verification: Client owner or Admin
  const isClient = project.clientId === auth.user.id;
  const isAdmin = auth.roles.includes("ADMIN");

  if (!isClient && !isAdmin) {
    notFound();
  }

  // 3. Check Deliverables
  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.projectId, project.id))
    .limit(1);

  // 4. Check FINAL payment
  const [finalPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.projectId, project.id),
        eq(payments.type, "FINAL")
      )
    )
    .limit(1);

  // 5. Evaluate the 7-condition gate server-side
  const isPaymentVerified = finalPayment?.status === "VERIFIED";
  const isStatusUnlocked =
    project.status === "DELIVERY_UNLOCKED" || project.status === "COMPLETED";
  const isDisputeOpen = project.status === "DISPUTE_OPEN";

  const isDeliveryUnlocked =
    !!deliverable &&
    isPaymentVerified &&
    isStatusUnlocked &&
    !isDisputeOpen;

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={isAdmin ? "Admin Portal" : "Client Portal"}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60">
          <Link href="/projects" className="hover:text-black hover:underline">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-black hover:underline">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Delivery</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 mb-6 neo-shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-black text-[#ffe17c] border border-black">
                {project.projectCode}
              </span>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-black mt-3 tracking-tight">
                {project.title} — Deliverables
              </h1>
              <p className="text-sm text-black/70 font-semibold mt-1">
                Verified delivery portal and source code access.
              </p>
            </div>
            <div>
              {isDeliveryUnlocked ? (
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-black neo-shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-black mr-2 animate-pulse" />
                  Delivery Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-black mr-2" />
                  Delivery Locked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LOCKED STATE */}
        {!isDeliveryUnlocked && (
          <div className="bg-white rounded-2xl border-2 border-black p-8 sm:p-12 neo-shadow-lg text-center">
            <div className="w-16 h-16 bg-[#ffe17c] text-black border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black neo-shadow">
              🔒
            </div>
            <h2 className="text-2xl font-heading font-black text-black mb-3">
              Deliverables Are Currently Locked
            </h2>

            {isDisputeOpen ? (
              <p className="text-sm text-rose-700 font-semibold max-w-md mx-auto mb-6">
                An active dispute is currently open for this project. Delivery access is blocked until an administrator resolves the dispute.
              </p>
            ) : !deliverable ? (
              <p className="text-sm text-black/70 font-medium max-w-md mx-auto mb-6">
                The builder has not yet submitted the final project deliverables. Development is still ongoing.
              </p>
            ) : !isPaymentVerified ? (
              <p className="text-sm text-black/80 font-medium max-w-md mx-auto mb-6 leading-relaxed">
                The builder has submitted deliverables. To unlock access to the repository and deliverables, the final payment of{" "}
                <span className="font-heading font-black text-black">
                  ₹{project.remainingAmount || 0}
                </span>{" "}
                must be submitted and verified by BuildMate administration.
              </p>
            ) : (
              <p className="text-sm text-black/70 font-medium max-w-md mx-auto mb-6">
                This project is currently in {project.status} status. Final payment verification is required.
              </p>
            )}

            <div className="flex justify-center gap-4">
              <Link
                href={`/projects/${project.id}`}
                className="neo-btn px-6 py-3 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
              >
                ← Back to Project Overview
              </Link>
            </div>
          </div>
        )}

        {/* UNLOCKED DELIVERABLES VIEW */}
        {isDeliveryUnlocked && deliverable && (
          <div className="space-y-6">
            {/* Repository Card */}
            <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md">
              <h2 className="text-xl font-heading font-black text-black mb-4 pb-3 border-b-2 border-black/10 flex items-center justify-between">
                <span>Source Code Repository</span>
                <span className="text-xs font-heading font-black uppercase px-2.5 py-1 rounded bg-[#ffe17c] text-black border border-black">
                  {deliverable.repoType}
                </span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-heading font-black text-black/60 uppercase tracking-wider mb-1.5">
                    GitHub URL
                  </label>
                  <div className="flex items-center gap-3">
                    <a
                      href={deliverable.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-mono font-bold text-black underline decoration-2 hover:bg-[#ffe17c] break-all px-2 py-1 rounded border border-black/20"
                    >
                      {deliverable.githubUrl}
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-[#fffdf0] rounded-xl p-3.5 border-2 border-black neo-shadow-sm">
                    <span className="text-[11px] text-black/60 block uppercase font-heading font-black tracking-wider">Branch</span>
                    <span className="font-mono text-sm text-black font-black">{deliverable.branch}</span>
                  </div>
                  <div className="bg-[#fffdf0] rounded-xl p-3.5 border-2 border-black neo-shadow-sm">
                    <span className="text-[11px] text-black/60 block uppercase font-heading font-black tracking-wider">Commit Ref / Tag</span>
                    <span className="font-mono text-sm text-black font-black">{deliverable.commitRef}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Implemented Features & Details */}
            <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md">
              <h2 className="text-xl font-heading font-black text-black mb-4 pb-3 border-b-2 border-black/10">
                Implemented Features &amp; Instructions
              </h2>

              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-heading font-black text-black uppercase tracking-wider mb-2">
                    Features Delivered
                  </h3>
                  <div className="bg-[#fffdf0] rounded-xl p-4 text-sm text-black font-medium whitespace-pre-line border-2 border-black leading-relaxed">
                    {deliverable.implementedFeatures}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-heading font-black text-black uppercase tracking-wider mb-2">
                    Setup &amp; Delivery Notes
                  </h3>
                  <div className="bg-[#fffdf0] rounded-xl p-4 text-sm text-black font-medium whitespace-pre-line border-2 border-black leading-relaxed">
                    {deliverable.description}
                  </div>
                </div>

                {/* Optional Links */}
                {(deliverable.deploymentUrl ||
                  deliverable.demoUrl ||
                  deliverable.documentationUrl ||
                  deliverable.pptUrl) && (
                  <div>
                    <h3 className="text-xs font-heading font-black text-black uppercase tracking-wider mb-3">
                      Additional Resources &amp; Links
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliverable.deploymentUrl && (
                        <a
                          href={deliverable.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn flex items-center gap-2 p-3.5 rounded-xl border-2 border-black bg-[#fffdf0] text-sm font-heading font-black text-black"
                        >
                          <span>🚀 Live Deployment</span>
                        </a>
                      )}
                      {deliverable.demoUrl && (
                        <a
                          href={deliverable.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn flex items-center gap-2 p-3.5 rounded-xl border-2 border-black bg-[#fffdf0] text-sm font-heading font-black text-black"
                        >
                          <span>🎥 Demo Link</span>
                        </a>
                      )}
                      {deliverable.documentationUrl && (
                        <a
                          href={deliverable.documentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn flex items-center gap-2 p-3.5 rounded-xl border-2 border-black bg-[#fffdf0] text-sm font-heading font-black text-black"
                        >
                          <span>📄 Documentation</span>
                        </a>
                      )}
                      {deliverable.pptUrl && (
                        <a
                          href={deliverable.pptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn flex items-center gap-2 p-3.5 rounded-xl border-2 border-black bg-[#fffdf0] text-sm font-heading font-black text-black"
                        >
                          <span>📊 Presentation (PPT)</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Client Review Action Card */}
            <div className="bg-[#ffe17c] rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-heading font-black text-black">
                    Client Review &amp; Project Completion
                  </h3>
                  <p className="text-xs text-black/80 font-medium mt-1">
                    Verify the deliverables against your requirements. Mark the project complete or raise an issue.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {project.status === "COMPLETED" ? (
                    <span className="px-5 py-2.5 rounded-xl bg-white text-black font-heading font-black text-xs uppercase tracking-wider border-2 border-black neo-shadow-sm">
                      ✓ Project Completed
                    </span>
                  ) : (
                    <>
                      <Link
                        href={`/projects/${project.id}/dispute/new`}
                        className="neo-btn px-4 py-2.5 border-2 border-black bg-white hover:bg-rose-100 text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl transition"
                      >
                        Raise an Issue
                      </Link>
                      <DeliveryAcceptButton projectId={project.id} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
