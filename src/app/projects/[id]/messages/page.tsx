import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { projects, messages, users } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { isProjectParticipant } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";
import { ProjectChat, MessageItem } from "@/components/projects/project-chat";

export const dynamic = "force-dynamic";

interface ProjectMessagesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectMessagesPage({ params }: ProjectMessagesPageProps) {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  if (!projectId) {
    notFound();
  }

  // 1. Fetch project
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

  // 2. Ownership check: Must be client, builder, or admin
  if (!isProjectParticipant(auth.user, auth.roles, project)) {
    notFound();
  }

  // 3. Fetch initial messages
  const rows = await db
    .select({
      id: messages.id,
      projectId: messages.projectId,
      senderId: messages.senderId,
      senderName: users.name,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.projectId, project.id))
    .orderBy(asc(messages.createdAt));

  const initialMessages: MessageItem[] = rows.map((m) => {
    let roleLabel: "CLIENT" | "BUILDER" | "ADMIN" = "CLIENT";
    if (m.senderId === project.builderId) {
      roleLabel = "BUILDER";
    } else if (m.senderId === project.clientId) {
      roleLabel = "CLIENT";
    } else {
      roleLabel = "ADMIN";
    }

    return {
      id: m.id,
      projectId: m.projectId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: roleLabel,
      body: m.body,
      createdAt: m.createdAt,
    };
  });

  const isAdmin = auth.roles.includes("ADMIN");
  const isBuilder = auth.roles.includes("BUILDER") && project.builderId === auth.user.id;
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60">
          <Link href={isBuilder ? "/builder" : "/projects"} className="hover:text-black hover:underline">
            Projects
          </Link>
          <span>/</span>
          <Link href={backLink} className="hover:text-black hover:underline font-mono">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Messages</span>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 mb-6 neo-shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black text-[#ffe17c] border border-black">
                {project.projectCode}
              </span>
              <span className="text-xs font-heading font-black uppercase px-2.5 py-0.5 rounded-full bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
                {project.status}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
              {project.title} — Discussion Thread
            </h1>
            <p className="text-xs text-black/70 font-semibold mt-1">
              Direct project messaging between client, assigned builder, and administrators.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={backLink}
              className="neo-btn px-4 py-2 bg-white hover:bg-[#ffe17c] text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black"
            >
              Project Overview →
            </Link>
          </div>
        </div>

        {/* Chat Thread */}
        <ProjectChat
          projectId={project.id}
          currentUserId={auth.user.id}
          initialMessages={initialMessages}
        />
      </main>
    </div>
  );
}
