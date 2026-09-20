import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, disputes } from "@/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import { DisputeForm } from "@/components/projects/dispute-form";
import {
  CLIENT_DISPUTE_STATUS_ALLOWLIST,
  BUILDER_DISPUTE_STATUS_ALLOWLIST,
} from "@/lib/projects/dispute-validation";
import { ProjectStatus } from "@/lib/project-status";

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

  // Must be client or builder (or admin)
  const isClient = project.clientId === auth.user.id;
  const isBuilder = project.builderId === auth.user.id;
  const isAdmin = auth.roles.includes("ADMIN");

  if (!isClient && !isBuilder && !isAdmin) {
    notFound();
  }

  // Determine active role for dispute context
  const role = isClient ? ("CLIENT" as const) : ("BUILDER" as const);

  // Check if an OPEN dispute currently exists
  const [activeDispute] = await db
    .select({
      id: disputes.id,
      reason: disputes.reason,
      description: disputes.description,
      raisedBy: disputes.raisedBy,
      createdAt: disputes.createdAt,
    })
    .from(disputes)
    .where(
      and(
        eq(disputes.projectId, project.id),
        eq(disputes.status, "OPEN")
      )
    )
    .limit(1);

  // Check if project status is allowed in the role's allowlist (if no active dispute)
  const allowlist =
    role === "CLIENT"
      ? CLIENT_DISPUTE_STATUS_ALLOWLIST
      : BUILDER_DISPUTE_STATUS_ALLOWLIST;

  const isStatusAllowed = allowlist.includes(project.status as ProjectStatus);

  const currentPortalTitle = isAdmin
    ? "Admin Portal"
    : isBuilder
    ? "Builder Portal"
    : "Client Portal";

  const backLink = isBuilder ? `/builder/projects/${project.id}` : `/projects/${project.id}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={currentPortalTitle}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href={isBuilder ? "/builder/projects" : "/projects"} className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <Link href={backLink} className="hover:text-blue-600 font-mono">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Dispute</span>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
              {project.projectCode}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
              Status: {project.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Project Dispute Mediation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            BuildMate mediation portal for resolving scope disagreements, missing deliverables, or unresponsive communication.
          </p>
        </div>

        {/* If no active dispute and status is not in allowlist, show explanation */}
        {!activeDispute && !isStatusAllowed ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
              ℹ️
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              Dispute Filing Unavailable
            </h2>
            <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
              Disputes can only be opened during active development, delivery review, or settlement phases. This project is currently in{" "}
              <span className="font-semibold text-gray-900 font-mono">{project.status}</span>.
            </p>
            <Link
              href={backLink}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              Return to Project Overview
            </Link>
          </div>
        ) : (
          <DisputeForm
            projectId={project.id}
            role={role}
            activeDispute={activeDispute || null}
            currentUserId={auth.user.id}
          />
        )}
      </main>
    </div>
  );
}
