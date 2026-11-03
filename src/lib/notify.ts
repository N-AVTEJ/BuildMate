import { eq, and, isNull } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import {
  notifications,
  pushSubscriptions,
  notificationPrefs,
} from "@/db/schema";

export type NotificationType =
  | "QUOTATION_RECEIVED"
  | "QUOTATION_ACCEPTED"
  | "QUOTATION_REJECTED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "BUILDER_APPROVED"
  | "DELIVERY_UPLOADED"
  | "DEADLINE_APPROACHING"
  | "PROJECT_OVERDUE"
  | "CHANGE_REQUEST_CREATED"
  | "CHANGE_REQUEST_ACCEPTED"
  | "CHANGE_REQUEST_REJECTED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "DISPUTE_CANCELLED"
  | "TEST_NOTIFICATION"
  | "SYSTEM";

export const FORCED_NOTIFICATION_TYPES = new Set<NotificationType>([
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFIED",
  "PAYMENT_REJECTED",
  "BUILDER_APPROVED",
  "TEST_NOTIFICATION",
]);

/**
 * Sanitizes title to strip any accidental sensitive terms, amounts, URLs, or banned terminology.
 * Invariant: Never use the word "escrow" anywhere in notification text or UI.
 */
export function sanitizeTitle(title: string): string {
  if (!title) return "";
  let sanitized = title.replace(/https?:\/\/[^\s]+/gi, "[link]");
  sanitized = sanitized.replace(/git@[^\s]+/gi, "");
  sanitized = sanitized.replace(
    /[a-zA-Z0-9.\-_]{2,64}@(okhdfcbank|okaxis|okicici|oksbi|upi|ybl|paytm)/gi,
    "[upi handle]"
  );
  sanitized = sanitized.replace(/(?:₹|INR|Rs\.?|\$)\s*[\d,]+(?:\.\d+)?/gi, "[amount]");
  sanitized = sanitized.replace(/escrow/gi, "Platform");
  return sanitized.trim();
}

/**
 * Sanitizes payload body text:
 * - Redacts raw repository URLs, payment proofs, amounts, and credentials.
 * - Strips any instance of the word "escrow" (case-insensitive).
 */
export function sanitizeNotificationText(text: string): string {
  if (!text) return "";

  // 1. Redact raw URLs (no github or storage URLs in notification body)
  let sanitized = text.replace(/https?:\/\/[^\s]+/gi, "[link]");

  // 2. Redact ssh/git references
  sanitized = sanitized.replace(/git@[^\s]+/gi, "");

  // 3. Redact potential UPI VPA handles
  sanitized = sanitized.replace(
    /[a-zA-Z0-9.\-_]{2,64}@(okhdfcbank|okaxis|okicici|oksbi|upi|ybl|paytm)/gi,
    "[upi handle]"
  );

  // 4. Redact currency amounts (₹, INR, Rs., $) to prevent payment amount leakage
  sanitized = sanitized.replace(/(?:₹|INR|Rs\.?|\$)\s*[\d,]+(?:\.\d+)?/gi, "[amount]");

  // 5. Invariant: Never use the word "escrow" anywhere in notification text or UI
  sanitized = sanitized.replace(/escrow/gi, "secure milestone");

  return sanitized.trim();
}

/**
 * Evaluates whether user preferences permit push notifications for this event type.
 * Security & payment notifications are mandatory and cannot be disabled.
 */
export function isPrefAllowed(
  type: NotificationType,
  prefs?: {
    pushEnabled: boolean;
    quotationUpdates: boolean;
    paymentUpdates: boolean;
    deliveryUpdates: boolean;
    deadlineAlerts: boolean;
    changeRequestUpdates: boolean;
    disputeUpdates: boolean;
  } | null
): boolean {
  // Security and payment types are forced on
  if (FORCED_NOTIFICATION_TYPES.has(type)) {
    return true;
  }

  // Default is all enabled if no preference row exists
  if (!prefs) {
    return true;
  }

  // If master push toggle is off
  if (!prefs.pushEnabled) {
    return false;
  }

  switch (type) {
    case "QUOTATION_RECEIVED":
    case "QUOTATION_ACCEPTED":
    case "QUOTATION_REJECTED":
      return prefs.quotationUpdates;
    case "DELIVERY_UPLOADED":
      return prefs.deliveryUpdates;
    case "DEADLINE_APPROACHING":
    case "PROJECT_OVERDUE":
      return prefs.deadlineAlerts;
    case "CHANGE_REQUEST_CREATED":
    case "CHANGE_REQUEST_ACCEPTED":
    case "CHANGE_REQUEST_REJECTED":
      return prefs.changeRequestUpdates;
    case "DISPUTE_OPENED":
    case "DISPUTE_RESOLVED":
    case "DISPUTE_CANCELLED":
      return prefs.disputeUpdates;
    default:
      return true;
  }
}

let vapidConfigured = false;
export function ensureVapidConfig(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@buildmate.com";

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
      return true;
    } catch (err) {
      console.warn("[Push/VAPID] Failed to set VAPID details:", err);
      return false;
    }
  }
  return false;
}

/**
 * Dispatches web push notifications to all active subscriptions of a user.
 * - Handles 404/410 by immediately revoking the stale subscription.
 * - Respects per-type preferences and master toggle.
 * - Never throws.
 */
export async function sendWebPushForUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url?: string | null; icon?: string }
): Promise<{ sent: number; failed: number; revoked: number }> {
  let sent = 0;
  let failed = 0;
  let revoked = 0;

  try {
    // 1. Check user preferences
    const [prefs] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, userId))
      .limit(1);

    if (!isPrefAllowed(type, prefs)) {
      return { sent: 0, failed: 0, revoked: 0 };
    }

    // 2. Fetch active, non-revoked subscriptions
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          isNull(pushSubscriptions.revokedAt)
        )
      );

    if (subs.length === 0) {
      return { sent: 0, failed: 0, revoked: 0 };
    }

    // 3. Ensure VAPID credentials
    if (!ensureVapidConfig()) {
      console.warn("[Push] VAPID keys not configured, skipping web push dispatch.");
      return { sent: 0, failed: 0, revoked: 0 };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/favicon.ico",
      url: payload.url || "/",
      data: {
        url: payload.url || "/",
      },
    });

    const now = new Date();

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
        sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: now })
          .where(eq(pushSubscriptions.id, sub.id))
          .catch(() => {});
      } catch (pushErr: any) {
        failed++;
        const statusCode = pushErr?.statusCode || pushErr?.status;
        if (statusCode === 404 || statusCode === 410) {
          revoked++;
          await db
            .update(pushSubscriptions)
            .set({ revokedAt: now })
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {});
        } else {
          console.warn(`[Push] Failed delivery to ${sub.endpoint.slice(0, 30)}...:`, pushErr?.message || pushErr);
        }
      }
    }
  } catch (err) {
    console.error("[Push] Error during push notification dispatch:", err);
  }

  return { sent, failed, revoked };
}

export interface NotifyOptions {
  title: string;
  body: string;
  url?: string | null;
  projectId?: string | null;
}

/**
 * Universal backend notification dispatcher.
 * 1. Atomically inserts in-app notification row (in-app bell works even if push fails).
 * 2. Asynchronously and non-blockingly triggers web-push delivery outside request path.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  options: NotifyOptions
) {
  const sanitizedTitle = sanitizeTitle(options.title);
  const sanitizedBody = sanitizeNotificationText(options.body);
  const compositeMessage = sanitizedBody
    ? `${sanitizedTitle}: ${sanitizedBody}`
    : sanitizedTitle;

  const now = new Date();

  // 1. Insert in-app notifications row
  const [createdNotification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title: sanitizedTitle,
      body: sanitizedBody,
      message: compositeMessage,
      url: options.url || null,
      projectId: options.projectId || null,
      read: false,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 2. Dispatch push notification asynchronously without blocking caller
  const dispatch = async () => {
    try {
      await sendWebPushForUser(userId, type, {
        title: sanitizedTitle,
        body: sanitizedBody,
        url: options.url || "/",
        icon: "/favicon.ico",
      });
    } catch (dispatchErr) {
      console.error("[Notify/Push] Background dispatch error:", dispatchErr);
    }
  };

  try {
    const nextServer = await import("next/server");
    if (typeof nextServer.after === "function") {
      try {
        nextServer.after(dispatch);
        return createdNotification;
      } catch {
        // Fall through if called outside Next.js request scope
      }
    }
  } catch {
    // Next.js server not available
  }

  // Fire and forget
  void dispatch();
  return createdNotification;
}
