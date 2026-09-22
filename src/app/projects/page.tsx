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
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Only accounts with the Client role can access this project portal.
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
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Client Portal"
      />

      <main className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your submitted projects and monitor builder discovery status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition"
            >
              📊 Client Dashboard
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition"
            >
              + New Project
            </Link>
          </div>
        </div>

        {reconciled.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">No projects yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              You haven&apos;t submitted any projects. Submit your first project to start finding vetted builders.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Project Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Requested Completion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Budget Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {reconciled.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-blue-600">
                        {project.projectCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {project.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            project.status === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : project.status === "EXPIRED_NO_BUILDER"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700 font-medium">
                        {project.requestedCompletionDate || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ₹{project.budgetMin.toLocaleString()} - ₹{project.budgetMax.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(project.submittedAt || project.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-blue-600 hover:text-blue-900"
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
