import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";

export default async function ProjectsPage() {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Client Role Verification
  const isClient = auth.roles.includes("CLIENT");
  if (!isClient) {
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
            Only accounts with the Client role can access this project portal.
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

  // 3. Query Client's Projects (Strictly isolated by session user ID, ignoring any query overrides)
  const clientProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.clientId, auth.user.id))
    .orderBy(desc(projects.createdAt));

  // 4. Reconcile Effective Status for Expired/Overdue Projects
  const now = new Date();
  const reconciled = await Promise.all(
    clientProjects.map(async (p) => {
      const effective = computeEffectiveStatus(p, now);
      if (effective.changed) {
        const newStatus = await reconcileProjectStatusInDb(p.id, now);
        return { ...p, status: newStatus };
      }
      return { ...p, status: effective.status };
    })
  );

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Client Portal"
      />

      <main className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard" className="neo-btn px-3 py-1 bg-white text-[#171e19] hover:bg-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-cabinet font-black text-[#171e19] tracking-tight uppercase">My Projects</h1>
            <p className="text-sm font-bold text-gray-700 mt-1">
              Manage your submitted projects and monitor builder discovery status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="neo-btn inline-flex items-center justify-center px-4 py-2.5 bg-white text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm hover:bg-[#ffe17c] transition"
            >
              📊 Client Dashboard
            </Link>
            <Link
              href="/projects/new"
              className="neo-btn inline-flex items-center justify-center px-5 py-2.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow transition"
            >
              + New Project
            </Link>
          </div>
        </div>

        {reconciled.length === 0 ? (
          <div className="bg-white border-2 border-black neo-shadow p-12 text-center">
            <h3 className="text-xl font-cabinet font-black text-[#171e19] uppercase mb-1">No projects yet</h3>
            <p className="text-sm font-bold text-gray-600 mb-6">
              You haven&apos;t submitted any projects. Submit your first project to start finding vetted builders.
            </p>
            <Link
              href="/projects/new"
              className="neo-btn inline-flex items-center px-5 py-2.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="bg-white border-2 border-black neo-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-black">
                <thead className="bg-[#171e19] text-[#ffe17c] uppercase font-black text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5 text-left">
                      Project Code
                    </th>
                    <th className="px-6 py-3.5 text-left">
                      Title
                    </th>
                    <th className="px-6 py-3.5 text-left">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-left">
                      Requested Completion
                    </th>
                    <th className="px-6 py-3.5 text-left">
                      Budget Range
                    </th>
                    <th className="px-6 py-3.5 text-left">
                      Submitted
                    </th>
                    <th className="px-6 py-3.5 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black bg-white">
                  {reconciled.map((project) => (
                    <tr key={project.id} className="hover:bg-[#ffe17c]/20 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-black text-[#171e19]">
                        <span className="bg-[#ffe17c] border border-black px-1.5 py-0.5">{project.projectCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-cabinet font-black text-gray-900">
                        {project.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-black border border-black uppercase ${
                            project.status === "AVAILABLE"
                              ? "bg-emerald-200 text-emerald-950"
                              : project.status === "EXPIRED_NO_BUILDER"
                              ? "bg-rose-200 text-rose-950"
                              : "bg-gray-200 text-[#171e19]"
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black font-bold">
                        {project.requestedCompletionDate || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">
                        ₹{project.budgetMin.toLocaleString()} - ₹{project.budgetMax.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {new Date(project.submittedAt || project.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/projects/${project.id}`}
                          className="neo-btn px-3 py-1 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm inline-block"
                        >
                          View Details →
                        </Link>
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
