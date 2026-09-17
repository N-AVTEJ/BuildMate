import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";

interface DisputeNewPageProps {
  params: Promise<{ id: string }>;
}

export default async function DisputeNewPage({ params }: DisputeNewPageProps) {
  const auth = await requireAuth();
  const { id: projectId } = await params;

  if (!projectId) {
    notFound();
  }

  const [project] = await db
    .select({
      id: projects.id,
      projectCode: projects.projectCode,
      title: projects.title,
      clientId: projects.clientId,
      builderId: projects.builderId,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    notFound();
  }

  // Must be client or admin
  const isClient = project.clientId === auth.user.id;
  const isAdmin = auth.roles.includes("ADMIN");

  if (!isClient && !isAdmin) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={isAdmin ? "Admin Portal" : "Client Portal"}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/projects" className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-blue-600">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Dispute</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-xl font-bold text-gray-900">
              Raise an Issue / Open Dispute
            </h1>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            If the delivered code does not meet your accepted project scope, or if critical features are missing, opening a formal dispute alerts BuildMate administration for mediation.
          </p>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-6">
            <p className="font-semibold mb-1">
              Project: {project.title} ({project.projectCode})
            </p>
            <p className="text-xs">
              Phase 9 will introduce dedicated dispute resolution workflows and mediation tooling.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href={`/projects/${project.id}/delivery`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition text-gray-700"
            >
              Back to Delivery
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
