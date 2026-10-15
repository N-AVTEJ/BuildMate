import Link from "next/link";
import { redirect } from "next/navigation";
import { inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { payments, projects, users } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";

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

  // Fetch all payments for audit and record keeping
  const allPayments = await db
    .select({
      id: payments.id,
      projectId: payments.projectId,
      type: payments.type,
      expectedAmount: payments.expectedAmount,
      razorpayOrderId: payments.razorpayOrderId,
      razorpayPaymentId: payments.razorpayPaymentId,
      status: payments.status,
      verifiedAt: payments.verifiedAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .orderBy(desc(payments.createdAt));

  // Fetch associated projects
  const projectIds = Array.from(new Set(allPayments.map((p) => p.projectId)));
  const projectsList =
    projectIds.length > 0
      ? await db
          .select({
            id: projects.id,
            projectCode: projects.projectCode,
            title: projects.title,
            clientId: projects.clientId,
            status: projects.status,
          })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];

  const projectMap = new Map(projectsList.map((p) => [p.id, p]));

  // Fetch client users
  const clientIds = Array.from(new Set(projectsList.map((p) => p.clientId)));
  const clientsList =
    clientIds.length > 0
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

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19]">
      <PortalHeader role="ADMIN" currentPath="/admin/payments" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header Block */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffe17c] border border-black rounded-lg text-xs font-heading font-black tracking-wider uppercase mb-2">
                Automated Gateway • Read-Only Audit Log
              </div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-black">
                Payment Records & Gateway Audit
              </h1>
              <p className="text-sm text-black/70 font-semibold mt-1 max-w-xl leading-relaxed">
                All client transactions are securely processed and verified via Razorpay Standard Checkout. This log is read-only for support and audit.
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
                <span className="text-black/60">Total Payments: </span>
                <span className="text-black">{allPayments.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden">
          {allPayments.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-2">💳</span>
              <h3 className="font-heading font-black text-xl text-black">No payments recorded</h3>
              <p className="text-xs text-black/70 font-semibold mt-1">
                No orders or payments have been created yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fffdf0] border-b-2 border-black text-[11px] font-heading font-black uppercase tracking-wider text-black">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Razorpay Order ID</th>
                    <th className="py-3 px-4">Razorpay Payment ID</th>
                    <th className="py-3 px-4">Verified At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 text-xs font-medium">
                  {allPayments.map((p) => {
                    const project = projectMap.get(p.projectId);
                    const client = project ? clientMap.get(project.clientId) : null;

                    const statusColor =
                      p.status === "VERIFIED"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                        : p.status === "ORDER_CREATED"
                        ? "bg-blue-100 text-blue-800 border-blue-400"
                        : p.status === "REJECTED"
                        ? "bg-rose-100 text-rose-800 border-rose-400"
                        : "bg-amber-100 text-amber-800 border-amber-400";

                    return (
                      <tr key={p.id} className="hover:bg-[#fffdf0]/60 transition">
                        <td className="py-3.5 px-4 font-semibold text-black">
                          {project ? (
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-mono text-black hover:underline"
                            >
                              {project.projectCode}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                          <div className="text-[11px] text-black/60 truncate max-w-[180px]">
                            {project?.title || "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-black">{client?.name || "Client"}</div>
                          <div className="text-[11px] text-black/60">{client?.email || "-"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-heading font-bold text-[11px] px-2 py-0.5 rounded bg-black/5 border border-black/20">
                            {p.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-heading font-black text-sm text-black">
                          ₹{p.expectedAmount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-heading font-black uppercase border ${statusColor}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-black/80">
                          {p.razorpayOrderId || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-black/80">
                          {p.razorpayPaymentId || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-black/70 text-[11px]">
                          {p.verifiedAt
                            ? new Date(p.verifiedAt).toLocaleString()
                            : "—"}
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
