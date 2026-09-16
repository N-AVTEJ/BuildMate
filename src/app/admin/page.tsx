import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, users } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";

export default async function AdminDashboardPage() {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Centralized Authorization: ADMIN Role Verification
  const isAuthorized = can(auth, "ADMIN_VIEW_DASHBOARD").allowed;
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

  // 3. Admin All-Projects Query (Centralized Admin Ownership Bypass)
  // Secure projection: NO password hashes, session tokens, or verification tokens
  const allProjects = await db
    .select({
      id: projects.id,
      projectCode: projects.projectCode,
      title: projects.title,
      status: projects.status,
      budgetMin: projects.budgetMin,
      budgetMax: projects.budgetMax,
      createdAt: projects.createdAt,
      submittedAt: projects.submittedAt,
      acceptanceDeadline: projects.acceptanceDeadline,
      builderAcceptedAt: projects.builderAcceptedAt,
      clientId: projects.clientId,
      builderId: projects.builderId,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt));

  // Fetch sanitized users map for client & builder names
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Admin Dashboard"
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Administrator Control Center
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Global overview of platform activity, project lifecycles, and verification queues.
            </p>
          </div>
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            <span>💳 Payment Verification Queue</span>
            <span>→</span>
          </Link>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              Total Projects
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{allProjects.length}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-emerald-600 uppercase tracking-wider font-semibold">
              Available
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {allProjects.filter((p) => p.status === "AVAILABLE").length}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-blue-600 uppercase tracking-wider font-semibold">
              Pending Quote
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {allProjects.filter((p) => p.status === "ACCEPTED_PENDING_QUOTE").length}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-rose-600 uppercase tracking-wider font-semibold">
              Expired
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {allProjects.filter((p) => p.status === "EXPIRED_NO_BUILDER").length}
            </div>
          </div>
        </div>

        {/* Section 1: All Projects (Admin Bypass) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-10">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">All Projects</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Full platform project directory with cross-client and cross-builder visibility.
              </p>
            </div>
          </div>

          {allProjects.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No projects created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Builder</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Budget</th>
                    <th className="px-6 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {allProjects.map((p) => {
                    const client = userMap.get(p.clientId);
                    const builder = p.builderId ? userMap.get(p.builderId) : null;

                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-mono font-bold text-blue-600">
                          {p.projectCode}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">
                          {p.title}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {client ? client.name || client.email : p.clientId}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {builder ? (
                            builder.name || builder.email
                          ) : (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "ACCEPTED_PENDING_QUOTE"
                                ? "bg-blue-100 text-blue-800"
                                : p.status === "EXPIRED_NO_BUILDER"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700">
                          ${p.budgetMin.toLocaleString()} - ${p.budgetMax.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Placeholder Shells for Future Phases */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Verification Shell (Phase 6) */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-90">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
              <span>💳</span>
              <h3>Payment Verification</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Review and approve advance payment proofs and QR transaction receipts.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
              Queue will be activated in Phase 6 (Payments & Escrow).
            </div>
          </div>

          {/* Disputes Shell (Phase 9) */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-90">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
              <span>⚖️</span>
              <h3>Dispute Resolution</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Arbitrate milestone disputes, review submitted evidence, and decide settlements.
            </p>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 font-medium">
              Arbitration center will be activated in Phase 9 (Disputes).
            </div>
          </div>

          {/* User Management Shell */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-90">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
              <span>👥</span>
              <h3>User Directory</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Total registered users: <span className="font-bold text-gray-900">{allUsers.length}</span>.
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">
              Detailed user role assignment and account controls interface.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
