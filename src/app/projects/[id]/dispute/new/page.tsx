import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, disputes } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import { DisputeForm } from "@/components/projects/dispute-form";
import {
  CLIENT_DISPUTE_STATUS_ALLOWLIST,
  BUILDER_DISPUTE_STATUS_ALLOWLIST,
} from "@/lib/projects/dispute-validation";
import { ProjectStatus } from "@/lib/project-status";

export const dynamic = "force-dynamic";

interface DisputeNewPageProps {
  params: Promise<{ id: string }>;
}

export default async function DisputeNewPage({ params }: DisputeNewPageProps) {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

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
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={currentPortalTitle}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6 flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60">
          <Link href={isBuilder ? "/builder" : "/projects"} className="hover:text-black hover:underline">
            Projects
          </Link>
          <span>/</span>
          <Link href={backLink} className="hover:text-black hover:underline font-mono">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Dispute</span>
        </div>

        <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 mb-6 neo-shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black text-[#ffe17c] border border-black">
              {project.projectCode}
            </span>
            <span className="text-xs font-heading font-black uppercase px-2.5 py-0.5 rounded-full bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
              Status: {project.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
            Project Dispute Mediation
          </h1>
          <p className="text-xs text-black/70 font-semibold mt-1">
            BuildMate mediation portal for resolving scope disagreements, missing deliverables, or unresponsive communication.
          </p>
        </div>

        {/* If no active dispute and status is not in allowlist, show explanation */}
        {!activeDispute && !isStatusAllowed ? (
          <div className="bg-white rounded-2xl border-2 border-black p-8 sm:p-12 neo-shadow-lg text-center">
            <div className="w-14 h-14 bg-[#ffe17c] text-black border-2 border-black rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl font-black neo-shadow-sm">
              ℹ️
            </div>
            <h2 className="text-xl font-heading font-black text-black mb-2">
              Dispute Filing Unavailable
            </h2>
            <p className="text-sm text-black/70 font-medium max-w-md mx-auto mb-6">
              Disputes can only be opened during active development, delivery review, or settlement phases. This project is currently in{" "}
              <span className="font-heading font-black text-black font-mono">{project.status}</span>.
            </p>
            <Link
              href={backLink}
              className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
            >
              ← Return to Project Overview
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
