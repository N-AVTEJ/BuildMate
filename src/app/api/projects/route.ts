import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectStatusHistory } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { generateProjectCode } from "@/lib/projects/code";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";

export async function POST(req: Request) {
  try {
    // 1. Centralized Authorization Guard
    const auth = await requireAuth();
    authorize(auth, "PROJECT_CREATE");

    // 2. Parse & Validate Payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { title, subject, description, techStack, budgetMin, budgetMax, integrityAck, requestedCompletionDate } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: "Title is required and must not exceed 200 characters." },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.trim().length === 0 || description.length > 5000) {
      return NextResponse.json(
        { error: "Description is required and must not exceed 5000 characters." },
        { status: 400 }
      );
    }

    if (!techStack || typeof techStack !== "string" || techStack.trim().length === 0) {
      return NextResponse.json({ error: "Tech stack is required." }, { status: 400 });
    }

    const parsedBudgetMin = Number(budgetMin);
    const parsedBudgetMax = Number(budgetMax);

    if (!Number.isInteger(parsedBudgetMin) || parsedBudgetMin < 0) {
      return NextResponse.json(
        { error: "Minimum budget must be a non-negative integer." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(parsedBudgetMax) || parsedBudgetMax < parsedBudgetMin) {
      return NextResponse.json(
        { error: "Maximum budget must be an integer greater than or equal to minimum budget." },
        { status: 400 }
      );
    }

    if (!requestedCompletionDate || typeof requestedCompletionDate !== "string") {
      return NextResponse.json(
        { error: "Requested completion date is required." },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(requestedCompletionDate)) {
      return NextResponse.json(
        { error: "Requested completion date must be a valid calendar date in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(`${requestedCompletionDate}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Requested completion date must be a valid calendar date." },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (requestedCompletionDate <= todayStr) {
      return NextResponse.json(
        { error: "Requested completion date must be in the future." },
        { status: 400 }
      );
    }

    if (integrityAck !== true) {
      return NextResponse.json(
        { error: "You must acknowledge the project integrity statement to submit." },
        { status: 400 }
      );
    }

    // 3. Server-Controlled Lifecycle Values
    const now = new Date();
    const acceptanceDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Strictly 48 hours

    // 4. Database Transaction: Generate Sequence Code + Insert Project + Insert Audit History
    const createdProject = await db.transaction(async (tx) => {
      const projectCode = await generateProjectCode(tx);

      const [newProject] = await tx
        .insert(projects)
        .values({
          projectCode,
          clientId: auth.user.id, // Derived exclusively from session
          builderId: null, // Cannot be set on creation
          title: title.trim(),
          subject: subject.trim(),
          description: description.trim(),
          techStack: techStack.trim(),
          budgetMin: parsedBudgetMin,
          budgetMax: parsedBudgetMax,
          totalPrice: null,
          advanceAmount: null,
          remainingAmount: null,
          status: "AVAILABLE",
          integrityAck: true,
          integrityAckAt: now,
          acceptanceDeadline,
          requestedCompletionDate,
          submittedAt: now,
        })
        .returning();

      // Record initial status transition in project_status_history
      await tx.insert(projectStatusHistory).values({
        projectId: newProject.id,
        fromStatus: null,
        toStatus: "AVAILABLE",
        changedBy: auth.user.id,
      });

      return newProject;
    });

    return NextResponse.json({ project: createdProject }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Create] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the project." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 1. Authenticate Session & Central Authorization
    const auth = await requireAuth();
    authorize(auth, "PROJECT_LIST_OWN");

    // 2. Query Strictly by Authenticated Client's User ID (Ignores any client_id overrides)
    const clientProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.clientId, auth.user.id))
      .orderBy(desc(projects.createdAt));

    // 3. Reconcile Effective Status for Any Expired/Overdue Projects
    const now = new Date();
    const reconciledProjects = await Promise.all(
      clientProjects.map(async (p) => {
        const effective = computeEffectiveStatus(p, now);
        if (effective.changed) {
          const newStatus = await reconcileProjectStatusInDb(p.id, now);
          return { ...p, status: newStatus };
        }
        return p;
      })
    );

    return NextResponse.json({ projects: reconciledProjects });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/List] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching projects." },
      { status: 500 }
    );
  }
}
