import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, count } from "drizzle-orm";
import { db } from "@/db";
import { payments, projects } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";
import {
  PaymentHistoryTable,
  PaymentHistoryRow,
} from "@/components/payments/payment-history-table";

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

  // Fetch total count of payments across all projects
  const [totalCountResult] = await db
    .select({ total: count() })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id));

  const totalPayments = totalCountResult ? Number(totalCountResult.total) : 0;

  // Fetch initial paginated payments for SSR
  const initialPayments = await db
    .select({
      id: payments.id,
      projectId: payments.projectId,
      projectCode: projects.projectCode,
      projectTitle: projects.title,
      type: payments.type,
      expectedAmount: payments.expectedAmount,
      submittedAmount: payments.submittedAmount,
      transactionReference: payments.transactionReference,
      status: payments.status,
      submittedAt: payments.submittedAt,
      verifiedAt: payments.verifiedAt,
      createdAt: payments.createdAt,
      razorpayPaymentId: payments.razorpayPaymentId,
      rejectionReason: payments.rejectionReason,
    })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .orderBy(desc(payments.createdAt))
    .limit(20);

  const formattedInitialPayments: PaymentHistoryRow[] = initialPayments.map((p) => ({
    id: p.id,
    projectId: p.projectId,
    projectCode: p.projectCode,
    projectTitle: p.projectTitle,
    type: p.type,
    amount: p.submittedAmount ?? p.expectedAmount,
    status: p.status,
    transactionReference: p.transactionReference || p.razorpayPaymentId || null,
    submittedAt: p.submittedAt ? p.submittedAt.toISOString() : p.createdAt.toISOString(),
    verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    razorpayPaymentId: p.razorpayPaymentId,
    rejectionReason: p.rejectionReason,
  }));

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19]">
      <PortalHeader user={auth.user} roles={auth.roles} currentPortalTitle="Admin Portal" />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header Block */}
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffe17c] border border-black rounded-lg text-xs font-heading font-black tracking-wider uppercase mb-2">
                Automated Gateway • System-Wide Payment Audit
              </div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-black">
                Payment Records & Gateway Audit
              </h1>
              <p className="text-sm text-black/70 font-semibold mt-1 max-w-xl leading-relaxed">
                All client transactions across all projects system-wide. Filter by status, sort by date, and paginate through historical records.
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
                <span className="text-black">{totalPayments}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Paginated Payment History Table */}
        <PaymentHistoryTable
          initialPayments={formattedInitialPayments}
          role="ADMIN"
          totalCount={totalPayments}
          pageSize={20}
          baseProjectHrefPrefix="/projects"
        />
      </main>
    </div>
  );
}
