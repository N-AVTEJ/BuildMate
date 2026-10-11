import Link from "next/link";
import { redirect } from "next/navigation";
import { inArray, desc } from "drizzle-orm";
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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            Administrator privileges are required to access this portal.
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Payment Verification"
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60 mb-3">
            <Link href="/admin" className="hover:text-black hover:underline">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Payment Queue</span>
          </div>

          <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
                Payment Verification Queue
              </h1>
              <p className="text-sm text-black/70 font-semibold mt-1 max-w-xl leading-relaxed">
                Review submitted payment screenshots and confirm receipt before unlocking project milestones and source code.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/disputes"
                className="neo-btn px-4 py-2 bg-[#b7c6c2] hover:bg-[#ffe17c] text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black"
              >
                Dispute Queue →
              </Link>
              <div className="px-3.5 py-2 bg-white rounded-xl border-2 border-black neo-shadow-sm text-xs font-heading font-black">
                <span className="text-black/60">Pending: </span>
                <span className="text-black">{pendingPayments.length}</span>
              </div>
              {lateCount > 0 && (
                <div className="px-3.5 py-2 bg-amber-200 rounded-xl border-2 border-black neo-shadow-sm text-xs font-heading font-black text-black">
                  <span>Late: </span>
                  <span>{lateCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* R2 Storage Warning Banner */}
        {process.env.NODE_ENV === "production" && !isR2Configured() && (
          <div className="mb-6 bg-amber-200 border-2 border-black rounded-2xl p-5 flex items-start gap-3 neo-shadow">
            <span className="text-2xl font-bold">⚠️</span>
            <div>
              <h3 className="font-heading font-black text-sm text-black">Cloudflare R2 Storage Not Configured</h3>
              <p className="text-xs text-black/80 font-medium mt-0.5 leading-relaxed">
                Payment proof image previews are currently unavailable because production storage credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are not configured. You can still verify payments using transaction references or configure R2 credentials to view screenshots.
              </p>
            </div>
          </div>
        )}

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden">
          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-2">✓</span>
              <h3 className="font-heading font-black text-xl text-black">Queue is clear</h3>
              <p className="text-xs text-black/70 font-semibold mt-1">
                No payment proofs are currently awaiting administrative review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-black text-left text-sm">
                <thead className="bg-black text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-r-2 border-black/20">Project / Client</th>
                    <th className="px-6 py-4 border-r-2 border-black/20">Stage &amp; Amount</th>
                    <th className="px-6 py-4 border-r-2 border-black/20">Reference / Submitted</th>
                    <th className="px-6 py-4 border-r-2 border-black/20">Proof Screenshot</th>
                    <th className="px-6 py-4 border-r-2 border-black/20">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10 bg-white">
                  {pendingPayments.map((payment) => {
                    const project = projectMap.get(payment.projectId);
                    const client = project ? clientMap.get(project.clientId) : null;
                    const proofs = proofsByPayment.get(payment.id) || [];
                    const isLate = payment.status === "LATE_PAYMENT_PROOF";

                    return (
                      <tr
                        key={payment.id}
                        className={`hover:bg-[#ffe17c]/20 transition-colors ${
                          isLate ? "bg-amber-100/50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 border-r-2 border-black/10">
                          <div className="font-mono text-xs font-bold bg-black text-[#ffe17c] px-2 py-0.5 rounded inline-block">
                            {project?.projectCode || "N/A"}
                          </div>
                          <div className="font-heading font-black text-black text-sm mt-1">
                            {project?.title || "Unknown Project"}
                          </div>
                          <div className="text-xs text-black/60 font-semibold mt-0.5">
                            {client ? `${client.name} (${client.email})` : "Unknown Client"}
                          </div>
                        </td>

                        <td className="px-6 py-4 border-r-2 border-black/10">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-heading font-black uppercase border border-black ${
                              payment.type === "ADVANCE"
                                ? "bg-[#ffe17c] text-black"
                                : "bg-emerald-300 text-black"
                            }`}
                          >
                            {payment.type}
                          </span>
                          <div className="text-base font-heading font-black text-black mt-1">
                            ₹{payment.expectedAmount.toLocaleString()}
                          </div>
                        </td>

                        <td className="px-6 py-4 border-r-2 border-black/10">
                          <div className="font-mono text-xs text-black font-black bg-[#fffdf0] px-2 py-1 rounded border border-black inline-block">
                            {payment.transactionReference || "None supplied"}
                          </div>
                          <div className="text-xs text-black/60 font-mono font-semibold mt-1">
                            {payment.submittedAt
                              ? new Date(payment.submittedAt).toLocaleString()
                              : "N/A"}
                          </div>
                        </td>

                        <td className="px-6 py-4 border-r-2 border-black/10">
                          {proofs.length === 0 ? (
                            <span className="text-xs text-black/40 italic">
                              No screenshot attached
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {proofs.map((proofItem, idx) =>
                                proofItem.url ? (
                                  <a
                                    key={proofItem.id}
                                    href={proofItem.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="neo-btn inline-flex items-center gap-1 text-xs font-heading font-black px-2.5 py-1 bg-[#fffdf0] border border-black rounded text-black hover:bg-[#ffe17c]"
                                  >
                                    <span>View Proof {proofs.length > 1 ? `#${idx + 1}` : ""}</span>
                                    <span className="text-[10px] text-black/50">↗</span>
                                  </a>
                                ) : (
                                  <span
                                    key={proofItem.id}
                                    className="inline-flex items-center gap-1 text-[11px] text-black bg-amber-200 border border-black px-2 py-0.5 rounded font-bold"
                                    title={proofItem.error || undefined}
                                  >
                                    ⚠️ Preview Unavailable
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 border-r-2 border-black/10">
                          {isLate ? (
                            <div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-rose-200 text-black border-2 border-black neo-shadow-sm">
                                ⚠️ LATE PROOF
                              </span>
                              {project?.advancePaymentDeadline && (
                                <div className="text-[10px] text-rose-800 font-bold mt-1">
                                  Deadline: {new Date(project.advancePaymentDeadline).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
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
