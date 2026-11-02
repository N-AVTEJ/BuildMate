/**
 * Server-Side Error Tracking & Observability
 *
 * Provides structured JSON error logging for serverless runtimes (Vercel, AWS Lambda),
 * native Sentry DSN ingestion via HTTP store API without heavyweight dependencies,
 * and optional webhook dispatch (Slack/Discord/PagerDuty) for critical production alerts.
 */

export type ErrorLogLevel = "warn" | "error" | "fatal";

export interface ErrorLogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface StructuredErrorLog {
  timestamp: string;
  level: ErrorLogLevel;
  service: string;
  environment: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    digest?: string;
    cause?: unknown;
  };
  context?: ErrorLogContext;
}

/**
 * Check if the error is a Next.js control flow redirect (should not be logged as an exception).
 */
export function isRedirectError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      return true;
    }
    if (err.message === "NEXT_REDIRECT") {
      return true;
    }
  }
  return false;
}

/**
 * Parses Sentry DSN into store API endpoint and auth headers.
 * DSN format: https://<key>@<host>/<projectId>
 */
function parseSentryDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!key || !projectId) return null;

    const storeUrl = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    return {
      storeUrl,
      authHeader: `Sentry sentry_version=7, sentry_client=buildmate/1.0, sentry_key=${key}`,
    };
  } catch {
    return null;
  }
}

/**
 * Dispatches an event payload directly to Sentry HTTP Store API without SDK overhead.
 */
async function sendToSentry(entry: StructuredErrorLog, dsn: string): Promise<void> {
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return;

  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date(entry.timestamp).toISOString(),
    platform: "node",
    level: entry.level === "fatal" ? "fatal" : entry.level === "warn" ? "warning" : "error",
    logger: "buildmate.server",
    environment: entry.environment,
    exception: {
      values: [
        {
          type: entry.error.name,
          value: entry.error.message,
          stacktrace: entry.error.stack ? { frames: [] } : undefined,
        },
      ],
    },
    tags: {
      service: entry.service,
      ...(entry.context?.tags || {}),
      ...(entry.context?.method ? { method: entry.context.method } : {}),
      ...(entry.context?.path ? { path: entry.context.path } : {}),
    },
    user: entry.context?.userId ? { id: entry.context.userId } : undefined,
    extra: {
      digest: entry.error.digest,
      cause: entry.error.cause,
      ...(entry.context?.metadata || {}),
    },
  };

  try {
    const res = await fetch(parsed.storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": parsed.authHeader,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[ErrorTracker] Sentry store API returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[ErrorTracker] Failed to dispatch Sentry event:", err);
  }
}

/**
 * Dispatches a structured alert to a configured webhook (Slack, Discord, PagerDuty).
 */
async function sendWebhookAlert(entry: StructuredErrorLog, webhookUrl: string): Promise<void> {
  const payload = {
    text: `🚨 *[${entry.environment.toUpperCase()}] ${entry.service} Error: ${entry.error.name}*\n> ${entry.error.message}\n*Path:* \`${entry.context?.path || "N/A"}\` | *User:* \`${entry.context?.userId || "Anonymous"}\``,
    level: entry.level,
    error: entry.error,
    context: entry.context,
    timestamp: entry.timestamp,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[ErrorTracker] Alert webhook returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[ErrorTracker] Failed to dispatch alert webhook:", err);
  }
}

/**
 * Captures and logs a server-side error with full structured metadata.
 */
export function captureServerError(
  error: unknown,
  context?: ErrorLogContext,
  level: ErrorLogLevel = "error"
): StructuredErrorLog | null {
  if (isRedirectError(error)) {
    return null;
  }

  const errObj =
    error instanceof Error
      ? error
      : typeof error === "object" && error !== null
      ? new Error(String((error as Record<string, unknown>).message || JSON.stringify(error)))
      : new Error(String(error));

  const digest = typeof (error as Record<string, unknown>)?.digest === "string"
    ? ((error as Record<string, unknown>).digest as string)
    : undefined;

  const entry: StructuredErrorLog = {
    timestamp: new Date().toISOString(),
    level,
    service: "buildmate",
    environment: process.env.NODE_ENV || "development",
    error: {
      name: errObj.name || "Error",
      message: errObj.message || "Unknown error",
      stack: errObj.stack,
      digest,
      cause: (errObj as Error & { cause?: unknown }).cause,
    },
    context: context ? { ...context } : undefined,
  };

  // 1. Output structured JSON log to stdout/stderr for cloud log drains
  console.error("[StructuredError]", JSON.stringify(entry));

  // 2. Dispatch to Sentry if SENTRY_DSN is configured
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    sendToSentry(entry, sentryDsn).catch((dispatchErr) => {
      console.warn("[ErrorTracker] Background Sentry dispatch failed:", dispatchErr);
    });
  }

  // 3. Dispatch to Alert Webhook if configured
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    sendWebhookAlert(entry, webhookUrl).catch((alertErr) => {
      console.warn("[ErrorTracker] Background alert dispatch failed:", alertErr);
    });
  }

  return entry;
}

/**
 * Helper to log an error from a Next.js API Route handler.
 */
export function logRouteError(
  req: Request,
  error: unknown,
  additionalContext?: Record<string, unknown>
): StructuredErrorLog | null {
  let path = "unknown";
  try {
    const url = new URL(req.url);
    path = url.pathname;
  } catch {
    path = req.url || "unknown";
  }

  return captureServerError(error, {
    path,
    method: req.method,
    metadata: {
      ...additionalContext,
      requestId: req.headers.get("x-request-id") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    },
  });
}

/**
 * Higher-order utility to wrap async operations with automatic error tracking.
 */
export async function withErrorTracking<T>(
  operationName: string,
  fn: () => Promise<T>,
  context?: ErrorLogContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureServerError(error, {
      ...context,
      metadata: {
        ...(context?.metadata || {}),
        operation: operationName,
      },
    });
    throw error;
  }
}
