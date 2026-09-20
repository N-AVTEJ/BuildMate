import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { projects, messages, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { isProjectParticipant } from "@/lib/authorization";
import { PortalHeader } from "@/components/navigation/portal-header";
import { ProjectChat, MessageItem } from "@/components/projects/project-chat";

interface ProjectMessagesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectMessagesPage({ params }: ProjectMessagesPageProps) {
  const auth = await requireAuth();
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
    <div className="min-h-screen bg-gray-50 pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={currentPortalTitle}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href={isBuilder ? "/builder/projects" : "/projects"} className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <Link href={backLink} className="hover:text-blue-600 font-mono">
            {project.projectCode}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Messages</span>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {project.projectCode}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {project.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {project.title} — Discussion Thread
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Direct project messaging between client, assigned builder, and administrators.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={backLink}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition"
            >
              Project Overview
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
