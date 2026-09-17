import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, deliverables, payments } from "@/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import { DeliveryAcceptButton } from "@/components/projects/delivery-accept-button";

interface DeliveryPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDeliveryPage({ params }: DeliveryPageProps) {
  const auth = await requireAuth();
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
    <div className="min-h-screen bg-gray-50 pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={isAdmin ? "Admin Portal" : "Client Portal"}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/projects" className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-blue-600">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Delivery</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-gray-100 text-gray-700">
                {project.projectCode}
              </span>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">
                {project.title} — Deliverables
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Verified delivery portal and source code access.
              </p>
            </div>
            <div>
              {isDeliveryUnlocked ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-600 mr-2 animate-pulse" />
                  Delivery Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-600 mr-2" />
                  Delivery Locked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LOCKED STATE */}
        {!isDeliveryUnlocked && (
          <div className="bg-white rounded-xl border border-amber-200 p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              🔒
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Deliverables Are Currently Locked
            </h2>

            {isDisputeOpen ? (
              <p className="text-sm text-red-600 max-w-md mx-auto mb-6">
                An active dispute is currently open for this project. Delivery access is blocked until an administrator resolves the dispute.
              </p>
            ) : !deliverable ? (
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                The builder has not yet submitted the final project deliverables. Development is still ongoing.
              </p>
            ) : !isPaymentVerified ? (
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                The builder has submitted deliverables. To unlock access to the repository and deliverables, the final payment of{" "}
                <span className="font-semibold text-gray-900">
                  ₹{project.remainingAmount || 0}
                </span>{" "}
                must be submitted and verified by BuildMate administration.
              </p>
            ) : (
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                This project is currently in {project.status} status. Final payment verification is required.
              </p>
            )}

            <div className="flex justify-center gap-4">
              <Link
                href={`/projects/${project.id}`}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
              >
                Back to Project Overview
              </Link>
            </div>
          </div>
        )}

        {/* UNLOCKED DELIVERABLES VIEW */}
        {isDeliveryUnlocked && deliverable && (
          <div className="space-y-6">
            {/* Repository Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b flex items-center justify-between">
                <span>Source Code Repository</span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {deliverable.repoType}
                </span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    GitHub URL
                  </label>
                  <div className="flex items-center gap-3">
                    <a
                      href={deliverable.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-mono font-semibold text-blue-600 hover:underline break-all"
                    >
                      {deliverable.githubUrl}
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <span className="text-xs text-gray-500 block uppercase font-medium">Branch</span>
                    <span className="font-mono text-sm text-gray-900 font-bold">{deliverable.branch}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <span className="text-xs text-gray-500 block uppercase font-medium">Commit Ref / Tag</span>
                    <span className="font-mono text-sm text-gray-900 font-bold">{deliverable.commitRef}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Implemented Features & Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">
                Implemented Features & Instructions
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-1">
                    Features Delivered
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line border border-gray-100 font-sans leading-relaxed">
                    {deliverable.implementedFeatures}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-1">
                    Setup & Delivery Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line border border-gray-100 font-sans leading-relaxed">
                    {deliverable.description}
                  </div>
                </div>

                {/* Optional Links */}
                {(deliverable.deploymentUrl ||
                  deliverable.demoUrl ||
                  deliverable.documentationUrl ||
                  deliverable.pptUrl) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-2">
                      Additional Resources & Links
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliverable.deploymentUrl && (
                        <a
                          href={deliverable.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-sm text-blue-600 transition"
                        >
                          <span className="font-bold">🚀 Live Deployment</span>
                        </a>
                      )}
                      {deliverable.demoUrl && (
                        <a
                          href={deliverable.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-sm text-blue-600 transition"
                        >
                          <span className="font-bold">🎥 Demo Link</span>
                        </a>
                      )}
                      {deliverable.documentationUrl && (
                        <a
                          href={deliverable.documentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-sm text-blue-600 transition"
                        >
                          <span className="font-bold">📄 Documentation</span>
                        </a>
                      )}
                      {deliverable.pptUrl && (
                        <a
                          href={deliverable.pptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-sm text-blue-600 transition"
                        >
                          <span className="font-bold">📊 Presentation (PPT)</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Client Review Action Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Client Review & Project Completion
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Verify the deliverables against your requirements. Mark the project complete or raise an issue.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {project.status === "COMPLETED" ? (
                    <span className="px-4 py-2 rounded-lg bg-green-100 text-green-800 font-bold text-sm border border-green-200">
                      ✓ Project Completed
                    </span>
                  ) : (
                    <>
                      <Link
                        href={`/projects/${project.id}/dispute/new`}
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition"
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
