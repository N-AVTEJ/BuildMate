import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";

const subscribeSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint URL."),
  keys: z.object({
    p256dh: z.string().min(1, "Missing p256dh key."),
    auth: z.string().min(1, "Missing auth secret."),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // 1. Server authentication
    const auth = await requireAuth();

    // 2. Rate limiting: 10 / hour / user
    const rl = await rateLimit(`push:sub:${auth.user.id}`, 10, "1 h");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many subscription attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 3. Payload validation with zod
    const body = await req.json().catch(() => ({}));
    const parseResult = subscribeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid subscription payload." },
        { status: 400 }
      );
    }

    const { endpoint, keys, userAgent: bodyUserAgent } = parseResult.data;
    const userAgent = bodyUserAgent || req.headers.get("user-agent") || null;
    const now = new Date();

    // 4. Upsert by endpoint — strictly bind to authenticated session user (backend authority)
    const [existing] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: auth.user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
          revokedAt: null,
          lastUsedAt: now,
        })
        .where(eq(pushSubscriptions.id, existing.id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: auth.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        createdAt: now,
        lastUsedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription registered successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Push/Subscribe] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to register push subscription." },
      { status: 500 }
    );
  }
}
