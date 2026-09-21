import Link from "next/link";
import { redirect } from "next/navigation";
import { inArray, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, projects, users, paymentProofs } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";
import { getDownloadUrl, isR2Configured, StorageConfigurationError } from "@/lib/storage";
import { PaymentActions } from "@/components/admin/payment-actions";

export default async function AdminPaymentsPage() {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // Central authorization check: ADMIN role
  const isAuthorized = can(auth, "ADMIN_PAYMENT_LIST").allowed;
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Administrator privileges are required to access this portal.
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

  // Fetch all pending payments requiring review
  const pendingPayments = await db
    .select({
      id: payments.id,
      projectId: payments.projectId,
      type: payments.type,
      expectedAmount: payments.expectedAmount,
      transactionReference: payments.transactionReference,
      status: payments.status,
      submittedAt: payments.submittedAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(inArray(payments.status, ["PROOF_SUBMITTED", "LATE_PAYMENT_PROOF"]))
    .orderBy(desc(payments.submittedAt));

  // Fetch associated projects
  const projectIds = Array.from(new Set(pendingPayments.map((p) => p.projectId)));
  const projectsList = projectIds.length > 0
    ? await db
        .select({
          id: projects.id,
          projectCode: projects.projectCode,
          title: projects.title,
          clientId: projects.clientId,
          advancePaymentDeadline: projects.advancePaymentDeadline,
          status: projects.status,
        })
        .from(projects)
        .where(inArray(projects.id, projectIds))
    : [];

  const projectMap = new Map(projectsList.map((p) => [p.id, p]));

  // Fetch client users
  const clientIds = Array.from(new Set(projectsList.map((p) => p.clientId)));
  const clientsList = clientIds.length > 0
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, clientIds))
    : [];

  const clientMap = new Map(clientsList.map((u) => [u.id, u]));

  // Fetch payment proofs for all pending payments
  const paymentIds = pendingPayments.map((p) => p.id);
  const proofsList = paymentIds.length > 0
    ? await db
        .select()
        .from(paymentProofs)
        .where(inArray(paymentProofs.paymentId, paymentIds))
        .orderBy(desc(paymentProofs.uploadedAt))
    : [];

  // Group proofs by paymentId and generate fresh short-lived signed download URLs
  const proofsByPayment = new Map<
    string,
    Array<{ id: string; url: string | null; error?: string | null; uploadedAt: Date }>
  >();
  for (const proof of proofsList) {
    let signedUrl: string | null = null;
    let proofError: string | null = null;
    try {
      signedUrl = await getDownloadUrl(proof.fileUrl, 60);
    } catch (err: unknown) {
      proofError =
        err instanceof StorageConfigurationError
          ? "Preview unavailable: Cloudflare R2 storage is not configured."
          : "Preview unavailable.";
    }
    const existing = proofsByPayment.get(proof.paymentId) || [];
    existing.push({
      id: proof.id,
      url: signedUrl,
      error: proofError,
      uploadedAt: proof.uploadedAt,
    });
    proofsByPayment.set(proof.paymentId, existing);
  }

  const lateCount = pendingPayments.filter((p) => p.status === "LATE_PAYMENT_PROOF").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Payment Verification"
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
              Payment Verification Queue
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review submitted payment screenshots and confirm receipt before unlocking project stages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/disputes"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Dispute Queue
            </Link>
            <div className="px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm text-xs font-semibold">
              <span className="text-gray-500">Pending Review: </span>
              <span className="text-gray-900 font-bold">{pendingPayments.length}</span>
            </div>
            {lateCount > 0 && (
              <div className="px-4 py-2 bg-amber-50 rounded-lg border border-amber-200 text-xs font-semibold text-amber-900">
                <span>Late Proofs: </span>
                <span className="font-bold text-amber-700">{lateCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-3xl block mb-2">✓</span>
              <h3 className="text-base font-bold text-gray-900">Queue is clear</h3>
              <p className="text-xs text-gray-500 mt-1">
                No payment proofs are currently awaiting administrative review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Project / Client</th>
                    <th className="px-6 py-3">Stage & Amount</th>
                    <th className="px-6 py-3">Reference / Submitted</th>
                    <th className="px-6 py-3">Proof Screenshot</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingPayments.map((payment) => {
                    const project = projectMap.get(payment.projectId);
                    const client = project ? clientMap.get(project.clientId) : null;
                    const proofs = proofsByPayment.get(payment.id) || [];
                    const isLate = payment.status === "LATE_PAYMENT_PROOF";

                    return (
                      <tr
                        key={payment.id}
                        className={`hover:bg-gray-50/80 transition ${
                          isLate ? "bg-amber-50/30" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-blue-600">
                            {project?.projectCode || "N/A"}
                          </div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {project?.title || "Unknown Project"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {client ? `${client.name} (${client.email})` : "Unknown Client"}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              payment.type === "ADVANCE"
                                ? "bg-indigo-50 text-indigo-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {payment.type}
                          </span>
                          <div className="text-base font-bold text-gray-900 mt-1">
                            ₹{payment.expectedAmount.toLocaleString()}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-mono text-xs text-gray-800 font-medium">
                            {payment.transactionReference || "None supplied"}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {payment.submittedAt
                              ? new Date(payment.submittedAt).toLocaleString()
                              : "N/A"}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {proofs.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">
                              No screenshot attached
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {proofs.map((proofItem, idx) =>
                                proofItem.url ? (
                                  <a
                                    key={proofItem.id}
                                    href={proofItem.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                                  >
                                    <span>View Proof {proofs.length > 1 ? `#${idx + 1}` : ""}</span>
                                    <span className="text-[10px] text-gray-400">↗ (60s TTL)</span>
                                  </a>
                                ) : (
                                  <span
                                    key={proofItem.id}
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium"
                                    title={proofItem.error || undefined}
                                  >
                                    ⚠️ Preview Unavailable (R2 Unconfigured)
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isLate ? (
                            <div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                ⚠️ LATE PROOF
                              </span>
                              {project?.advancePaymentDeadline && (
                                <div className="text-[10px] text-amber-700 mt-0.5">
                                  Deadline was:{" "}
                                  {new Date(project.advancePaymentDeadline).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              PROOF_SUBMITTED
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <PaymentActions
                            paymentId={payment.id}
                            projectCode={project?.projectCode || "Project"}
                            expectedAmount={payment.expectedAmount}
                            isLate={isLate}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
