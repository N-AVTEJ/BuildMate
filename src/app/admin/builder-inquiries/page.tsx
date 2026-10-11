import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { builderInquiries } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";

export default async function AdminBuilderInquiriesPage() {
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
            Administrator privileges are required to view builder inquiries.
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

  // 3. Query all builder inquiries, newest first
  const inquiries = await db
    .select({
      id: builderInquiries.id,
      name: builderInquiries.name,
      email: builderInquiries.email,
      message: builderInquiries.message,
      createdAt: builderInquiries.createdAt,
    })
    .from(builderInquiries)
    .orderBy(desc(builderInquiries.createdAt));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Inquiries"
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Navigation Breadcrumb & Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-blue-600 transition">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900">Builder Inquiries</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Builder Inquiries
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {inquiries.length} {inquiries.length === 1 ? "Inquiry" : "Inquiries"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Applicants requesting invite-only access to the BuildMate engineering network.
                Approve candidates by manually adding the BUILDER role to their user account.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-xs transition"
            >
              ← Back to Admin Center
            </Link>
          </div>
        </div>

        {/* Inquiries Table or Empty State */}
        {inquiries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xl mx-auto mb-4">
              📬
            </div>
            <h3 className="text-base font-semibold text-gray-900">No Inquiries Yet</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
              Prospective builders will appear here once they submit the invite-only interest form on <span className="font-mono text-xs text-gray-700">/builder/apply</span>.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4">Applicant</th>
                    <th scope="col" className="px-6 py-4">Email</th>
                    <th scope="col" className="px-6 py-4">Message / Background</th>
                    <th scope="col" className="px-6 py-4">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {inquiry.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`mailto:${inquiry.email}`}
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {inquiry.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-gray-700 max-w-md break-words">
                        {inquiry.message ? (
                          <span className="text-sm whitespace-pre-wrap">{inquiry.message}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No message provided</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {new Date(inquiry.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
