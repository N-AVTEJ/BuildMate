import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { builderApplications } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";
import { BuilderApplicationsTable, BuilderApplicationItem } from "@/components/admin/builder-applications-table";

export const dynamic = "force-dynamic";

export default async function AdminBuilderApplicationsPage() {
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
            Administrator privileges are required to view builder applications.
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

  // 3. Query all builder applications, newest first
  const rows = await db
    .select({
      id: builderApplications.id,
      name: builderApplications.name,
      email: builderApplications.email,
      resumeUrl: builderApplications.resumeUrl,
      githubUrl: builderApplications.githubUrl,
      message: builderApplications.message,
      status: builderApplications.status,
      createdAt: builderApplications.createdAt,
    })
    .from(builderApplications)
    .orderBy(desc(builderApplications.createdAt));

  const applications: BuilderApplicationItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    resumeUrl: r.resumeUrl,
    githubUrl: r.githubUrl,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots flex flex-col font-body text-[#171e19] selection:bg-black selection:text-white">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Applications"
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Navigation Breadcrumb & Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60 mb-3">
            <Link href="/admin" className="hover:text-black hover:underline">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">
              Builder Applications
            </span>
          </div>

          <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
                  Builder Applications Queue
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
                  {pendingCount} {pendingCount === 1 ? "Pending" : "Pending"}
                </span>
              </div>
              <p className="text-sm text-black/70 font-semibold mt-1 max-w-2xl leading-relaxed">
                Review prospective builder candidates, inspect resumes, and approve vetted engineers.
                Approving an application flags it as approved; run{" "}
                <span className="font-mono text-xs font-bold text-black bg-[#ffe17c] px-1 py-0.5 border border-black rounded">
                  npx tsx scripts/provision-builder.ts &lt;email&gt;
                </span>{" "}
                to manually provision their BUILDER role.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-black uppercase tracking-wider text-black bg-[#b7c6c2] hover:bg-[#ffe17c] border-2 border-black rounded-xl shrink-0"
              >
                ← Admin Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Applications Review Table */}
        <BuilderApplicationsTable initialApplications={applications} />
      </main>
    </div>
  );
}
