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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-black p-8 text-center neo-shadow-lg">
          <div className="w-14 h-14 bg-[#ffe17c] text-[#171e19] border-2 border-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="text-2xl font-cabinet font-black text-[#171e19] mb-2 uppercase tracking-wide">
            Access Denied
          </h1>
          <p className="text-sm font-bold text-gray-700 mb-6">
            Administrator privileges are required to access this portal.
          </p>
          <Link
            href="/"
            className="neo-btn inline-block px-5 py-2.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Admin Dashboard"
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-cabinet font-black text-[#171e19] tracking-tight uppercase">
              Administrator Control Center
            </h1>
            <p className="text-sm font-bold text-gray-700 mt-1">
              Global overview of platform activity, project lifecycles, and verification queues.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/builder-inquiries"
              className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition"
            >
              <span>📋 Builder Inquiries</span>
              <span>→</span>
            </Link>
            <Link
              href="/admin/disputes"
              className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 bg-rose-200 text-rose-950 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition"
            >
              <span>⚖️ Dispute Mediation Queue</span>
              <span>→</span>
            </Link>
            <Link
              href="/admin/payments"
              className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition"
            >
              <span>💳 Payment Verification Queue</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 border-2 border-black neo-shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">
              Total Projects
            </span>
            <div className="text-3xl font-cabinet font-black text-[#171e19] mt-1">{allProjects.length}</div>
          </div>
          <div className="bg-emerald-100 p-5 border-2 border-black neo-shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-black text-emerald-950 block">
              Available
            </span>
            <div className="text-3xl font-cabinet font-black text-emerald-900 mt-1">
              {allProjects.filter((p) => p.status === "AVAILABLE").length}
            </div>
          </div>
          <div className="bg-[#ffe17c] p-5 border-2 border-black neo-shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-black text-[#171e19] block">
              Pending Quote
            </span>
            <div className="text-3xl font-cabinet font-black text-[#171e19] mt-1">
              {allProjects.filter((p) => p.status === "ACCEPTED_PENDING_QUOTE").length}
            </div>
          </div>
          <div className="bg-rose-100 p-5 border-2 border-black neo-shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-black text-rose-950 block">
              Expired
            </span>
            <div className="text-3xl font-cabinet font-black text-rose-800 mt-1">
              {allProjects.filter((p) => p.status === "EXPIRED_NO_BUILDER").length}
            </div>
          </div>
        </div>

        {/* Section 1: All Projects (Admin Bypass) */}
        <div className="bg-white border-2 border-black neo-shadow overflow-hidden mb-10">
          <div className="p-6 border-b-2 border-black flex items-center justify-between bg-[#fffdf0]">
            <div>
              <h2 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">All Projects</h2>
              <p className="text-xs font-bold text-gray-600 mt-0.5">
                Full platform project directory with cross-client and cross-builder visibility.
              </p>
            </div>
          </div>

          {allProjects.length === 0 ? (
            <div className="p-8 text-center text-sm font-bold text-gray-600">No projects created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-black text-left text-xs">
                <thead className="bg-[#171e19] text-[#ffe17c] uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Code</th>
                    <th className="px-6 py-3.5">Title</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Builder</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Budget</th>
                    <th className="px-6 py-3.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black bg-white">
                  {allProjects.map((p) => {
                    const client = userMap.get(p.clientId);
                    const builder = p.builderId ? userMap.get(p.builderId) : null;

                    return (
                      <tr key={p.id} className="hover:bg-[#ffe17c]/20 transition">
                        <td className="px-6 py-4 font-mono font-black text-[#171e19]">
                          <span className="bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        </td>
                        <td className="px-6 py-4 font-cabinet font-black text-gray-900 max-w-xs truncate">
                          {p.title}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-700">
                          {client ? client.name || client.email : p.clientId}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-700">
                          {builder ? (
                            builder.name || builder.email
                          ) : (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 text-[11px] font-black border border-black uppercase ${
                              p.status === "AVAILABLE"
                                ? "bg-emerald-200 text-emerald-950"
                                : p.status === "ACCEPTED_PENDING_QUOTE"
                                ? "bg-[#ffe17c] text-[#171e19]"
                                : p.status === "EXPIRED_NO_BUILDER"
                                ? "bg-rose-200 text-rose-950"
                                : "bg-gray-200 text-[#171e19]"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-800 whitespace-nowrap">
                          ₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-600 whitespace-nowrap">
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

        {/* Section 2: Informational Shells */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Verification Shell */}
          <div className="bg-white p-6 border-2 border-black neo-shadow space-y-3">
            <div className="flex items-center gap-2 text-sm font-cabinet font-black text-[#171e19] uppercase tracking-wide">
              <span>💳</span>
              <h3>Payment Verification</h3>
            </div>
            <p className="text-xs font-medium text-gray-700 leading-relaxed">
              Review and approve advance payment proofs and QR transaction receipts.
            </p>
            <div className="p-3 bg-[#ffe17c] border-2 border-black text-xs text-[#171e19] font-black neo-shadow-sm">
              Escrow Review Queue active.
            </div>
          </div>

          {/* Disputes Shell */}
          <div className="bg-white p-6 border-2 border-black neo-shadow space-y-3">
            <div className="flex items-center gap-2 text-sm font-cabinet font-black text-[#171e19] uppercase tracking-wide">
              <span>⚖️</span>
              <h3>Dispute Resolution</h3>
            </div>
            <p className="text-xs font-medium text-gray-700 leading-relaxed">
              Arbitrate milestone disputes, review submitted evidence, and decide settlements.
            </p>
            <div className="p-3 bg-rose-200 border-2 border-black text-xs text-rose-950 font-black neo-shadow-sm">
              Dispute Arbitration Center active.
            </div>
          </div>

          {/* User Management Shell */}
          <div className="bg-white p-6 border-2 border-black neo-shadow space-y-3">
            <div className="flex items-center gap-2 text-sm font-cabinet font-black text-[#171e19] uppercase tracking-wide">
              <span>👥</span>
              <h3>User Directory</h3>
            </div>
            <p className="text-xs font-medium text-gray-700 leading-relaxed">
              Total registered platform accounts: <span className="font-black text-black">{allUsers.length}</span>.
            </p>
            <div className="p-3 bg-[#b7c6c2] border-2 border-black text-xs text-[#171e19] font-black neo-shadow-sm">
              Argon2id Hash Protected Directory.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
