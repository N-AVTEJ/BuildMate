import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, quotations } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { QuotationResponseActions } from "@/components/projects/quotation-response-actions";
import { PortalHeader } from "@/components/navigation/portal-header";

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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-amber-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            🔒
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            You do not have permission to view this quotation.
          </p>
          <Link
            href="/projects"
            className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Quotation Review"
      />

      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/projects/${project.id}`}
            className="neo-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-heading font-black uppercase tracking-wider text-black"
          >
            ← Back to Project Details
          </Link>
        </div>

        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden mb-6">
          <div className="p-6 sm:p-8 border-b-2 border-black/10 bg-[#ffe17c]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-heading font-black text-[11px] uppercase tracking-wider bg-black text-[#ffe17c] px-2.5 py-1 border border-black rounded inline-block">
                  Quotation Review
                </span>
                <h1 className="font-heading font-black text-2xl sm:text-3xl text-black mt-2 tracking-tight">
                  {project.title}
                </h1>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black bg-white self-start sm:self-auto neo-shadow-sm">
                {project.status}
              </span>
            </div>
            <p className="text-xs text-black/70 mt-1 font-mono font-bold">{project.projectCode}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {!latestQuotation ? (
              <div className="p-5 bg-[#fffdf0] rounded-xl border-2 border-black text-sm text-black/80 font-medium">
                No quotation has been submitted for this project yet.
              </div>
            ) : (
              <>
                <div className="bg-[#b7c6c2]/40 border-2 border-black rounded-2xl p-6 neo-shadow">
                  <h2 className="font-heading font-black text-xs uppercase tracking-wider text-black mb-4">
                    Price &amp; Payment Schedule Breakdown
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border-2 border-black neo-shadow-sm">
                      <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Total Quotation</span>
                      <span className="text-2xl font-heading font-black text-black mt-1 block">
                        ₹{latestQuotation.totalPrice.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-black/60 font-semibold">Total contracted scope</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-black neo-shadow-sm">
                      <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Required Advance</span>
                      <span className="text-2xl font-heading font-black text-emerald-700 mt-1 block">
                        ₹{latestQuotation.advanceAmount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-emerald-800 font-bold">Due before dev begins</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-black neo-shadow-sm">
                      <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block">Remaining Balance</span>
                      <span className="text-2xl font-heading font-black text-black mt-1 block">
                        ₹{latestQuotation.remainingAmount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-black/60 font-semibold">Due upon verified delivery</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#fffdf0] p-5 rounded-xl border-2 border-black text-xs text-black/80 space-y-2">
                  <div className="font-heading font-black text-black uppercase tracking-wider">
                    Important Terms upon Acceptance:
                  </div>
                  <ul className="list-disc list-inside space-y-1 font-medium">
                    <li>Accepting this quotation will create an immutable Scope Version 1 snapshot.</li>
                    <li>The project status will advance to <strong className="text-black font-black">Awaiting Advance</strong>.</li>
                    <li>Any future changes to scope or cost will require a formal Change Request.</li>
                  </ul>
                </div>

                {project.status === "QUOTATION_SENT" && latestQuotation.status === "PENDING" && (
                  <div className="pt-2">
                    <QuotationResponseActions projectId={project.id} />
                  </div>
                )}

                {project.status !== "QUOTATION_SENT" && (
                  <div className="p-4 bg-[#fffdf0] rounded-xl border-2 border-black text-sm text-black flex items-center justify-between">
                    <span className="font-medium">
                      Quotation status: <strong className="font-heading font-black">{latestQuotation.status}</strong> (Project is {project.status})
                    </span>
                    <Link
                      href={`/projects/${project.id}`}
                      className="neo-btn px-3 py-1 bg-black text-white text-xs font-heading font-black uppercase rounded-lg"
                    >
                      View Project →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
