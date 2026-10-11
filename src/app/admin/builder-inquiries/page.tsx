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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            Administrator privileges are required to view builder inquiries.
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots flex flex-col font-body text-[#171e19] selection:bg-black selection:text-white">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Inquiries"
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Navigation Breadcrumb & Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60 mb-3">
            <Link href="/admin" className="hover:text-black hover:underline">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Builder Inquiries</span>
          </div>

          <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
                  Builder Inquiries
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
                  {inquiries.length} {inquiries.length === 1 ? "Inquiry" : "Inquiries"}
                </span>
              </div>
              <p className="text-sm text-black/70 font-semibold mt-1 max-w-2xl leading-relaxed">
                Applicants requesting invite-only access to the BuildMate engineering network.
                Approve candidates by manually adding the BUILDER role to their user account.
              </p>
            </div>

            <Link
              href="/admin"
              className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-black uppercase tracking-wider text-black bg-[#b7c6c2] hover:bg-[#ffe17c] border-2 border-black rounded-xl shrink-0"
            >
              ← Back to Admin Center
            </Link>
          </div>
        </div>

        {/* Inquiries Table or Empty State */}
        {inquiries.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-black p-12 text-center neo-shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-[#ffe17c] border-2 border-black text-black flex items-center justify-center text-3xl mx-auto mb-4 neo-shadow-sm">
              📬
            </div>
            <h3 className="text-xl font-heading font-black text-black">No Inquiries Yet</h3>
            <p className="mt-2 text-sm text-black/70 font-medium max-w-sm mx-auto leading-relaxed">
              Prospective builders will appear here once they submit the invite-only interest form on <span className="font-mono text-xs font-bold text-black bg-[#ffe17c] px-1.5 py-0.5 border border-black rounded">/builder/apply</span>.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-black text-left text-sm">
                <thead className="bg-black text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Applicant</th>
                    <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Email</th>
                    <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Message / Background</th>
                    <th scope="col" className="px-6 py-4">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10 bg-white">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-[#ffe17c]/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-heading font-black text-black border-r-2 border-black/10">
                        {inquiry.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r-2 border-black/10">
                        <a
                          href={`mailto:${inquiry.email}`}
                          className="text-black font-mono font-bold text-xs underline decoration-2 hover:bg-[#ffe17c] px-1 py-0.5 rounded"
                        >
                          {inquiry.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-black font-medium max-w-md break-words border-r-2 border-black/10">
                        {inquiry.message ? (
                          <span className="text-sm whitespace-pre-wrap leading-relaxed">{inquiry.message}</span>
                        ) : (
                          <span className="text-xs text-black/40 italic">No message provided</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-black/70 font-mono font-bold">
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
