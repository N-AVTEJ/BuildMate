import { NextResponse } from "next/server";
import { eq, desc, asc, count } from "drizzle-orm";
import { db } from "@/db";
import { projects, messages, users, notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { isProjectParticipant } from "@/lib/authorization";
import { sanitizeMessageBody } from "@/lib/projects/dispute-validation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Ownership check: Session user must be client, builder, or admin
    if (!isProjectParticipant(auth.user, auth.roles, project)) {
      return NextResponse.json(
        { error: "Forbidden. You are not a participant on this project." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    // Get total count
    const [countResult] = await db
      .select({ value: count() })
      .from(messages)
      .where(eq(messages.projectId, project.id));

    const total = countResult?.value || 0;

    // Fetch messages joined with sender details
    const rows = await db
      .select({
        id: messages.id,
        projectId: messages.projectId,
        senderId: messages.senderId,
        senderName: users.name,
        senderEmail: users.email,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.projectId, project.id))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Augment messages with sender role label
    const formattedMessages = rows.map((m) => {
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

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Messages/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching messages." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Ownership check: Session user must be client, builder, or admin
    if (!isProjectParticipant(auth.user, auth.roles, project)) {
      return NextResponse.json(
        { error: "Forbidden. You are not a participant on this project." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const sanitization = sanitizeMessageBody(body?.body);

    if (!sanitization.valid || !sanitization.sanitized) {
      return NextResponse.json(
        { error: sanitization.error || "Invalid message body." },
        { status: 400 }
      );
    }

    const sanitizedBody = sanitization.sanitized;
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Insert message
      const [newMessage] = await tx
        .insert(messages)
        .values({
          projectId: project.id,
          senderId: auth.user.id,
          body: sanitizedBody,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 2. Insert notification for recipient participant
      const senderName = auth.user.name || "A participant";
      const isSenderClient = auth.user.id === project.clientId;
      const isSenderBuilder = auth.user.id === project.builderId;

      if (isSenderClient) {
        // Client sent message -> Notify builder if assigned
        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `New message from ${senderName} on "${project.title}": "${sanitizedBody.slice(0, 80)}${sanitizedBody.length > 80 ? "..." : ""}"`,
          });
        }
      } else if (isSenderBuilder) {
        // Builder sent message -> Notify client
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `New message from builder on "${project.title}": "${sanitizedBody.slice(0, 80)}${sanitizedBody.length > 80 ? "..." : ""}"`,
        });
      } else {
        // Admin sent message -> Notify both client and builder
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `New message from BuildMate Administrator on "${project.title}": "${sanitizedBody.slice(0, 80)}${sanitizedBody.length > 80 ? "..." : ""}"`,
        });

        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `New message from BuildMate Administrator on "${project.title}": "${sanitizedBody.slice(0, 80)}${sanitizedBody.length > 80 ? "..." : ""}"`,
          });
        }
      }

      return newMessage;
    });

    return NextResponse.json(
      {
        success: true,
        message: {
          id: result.id,
          projectId: result.projectId,
          senderId: result.senderId,
          senderName: auth.user.name,
          body: result.body,
          createdAt: result.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Messages/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while sending message." },
      { status: 500 }
    );
  }
}
