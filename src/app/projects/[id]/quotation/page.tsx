import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, quotations } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { QuotationResponseActions } from "@/components/projects/quotation-response-actions";

export default async function ClientQuotationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  // Ownership Enforcement (Consistent 403 defense)
  if (!project || project.clientId !== auth.user.id) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            You do not have permission to view this quotation.
          </p>
          <Link
            href="/projects"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            ← Back to My Projects
          </Link>
        </div>
      </main>
    );
  }

  const [latestQuotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.projectId, id))
    .orderBy(desc(quotations.createdAt))
    .limit(1);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/projects/${project.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
          >
            ← Back to Project Details
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-blue-600 tracking-wider uppercase">
                  Quotation Review
                </span>
                <h1 className="text-xl font-bold text-gray-900 mt-1">
                  {project.title}
                </h1>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 self-start sm:self-auto">
                {project.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-mono">{project.projectCode}</p>
          </div>

          <div className="p-6 space-y-6">
            {!latestQuotation ? (
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                No quotation has been submitted for this project yet.
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-xl p-6">
                  <h2 className="text-sm font-bold text-blue-950 uppercase tracking-wider mb-4">
                    Price & Payment Schedule Breakdown
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-xs">
                      <span className="text-xs text-gray-500 block">Total Quotation</span>
                      <span className="text-xl font-bold text-gray-900 mt-1 block">
                        ₹{latestQuotation.totalPrice.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-gray-400">Total contracted scope</span>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-xs">
                      <span className="text-xs text-gray-500 block">Required Advance</span>
                      <span className="text-xl font-bold text-emerald-600 mt-1 block">
                        ₹{latestQuotation.advanceAmount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-emerald-700">Due before development begins</span>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-xs">
                      <span className="text-xs text-gray-500 block">Remaining Balance</span>
                      <span className="text-xl font-bold text-gray-700 mt-1 block">
                        ₹{latestQuotation.remainingAmount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-gray-400">Due upon verified delivery</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200/80 text-xs text-gray-600 space-y-2">
                  <div className="font-semibold text-gray-800">
                    Important Terms upon Acceptance:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>Accepting this quotation will create an immutable Scope Version 1 snapshot.</li>
                    <li>The project status will advance to <strong className="text-gray-900">Awaiting Advance</strong>.</li>
                    <li>Any future changes to scope or cost will require a formal Change Request.</li>
                  </ul>
                </div>

                {project.status === "QUOTATION_SENT" && latestQuotation.status === "PENDING" && (
                  <div className="pt-2">
                    <QuotationResponseActions projectId={project.id} />
                  </div>
                )}

                {project.status !== "QUOTATION_SENT" && (
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 flex items-center justify-between">
                    <span>
                      Quotation status: <strong className="text-gray-900">{latestQuotation.status}</strong> (Project is {project.status})
                    </span>
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View Project →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
