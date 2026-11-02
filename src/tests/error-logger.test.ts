import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  captureServerError,
  logRouteError,
  withErrorTracking,
  isRedirectError,
} from "@/lib/observability/error-logger";

describe("Observability & Structured Error Logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("captures and logs standard Error instances with structured format", () => {
    const error = new Error("Database query timeout");
    const result = captureServerError(error, {
      path: "/api/projects",
      method: "GET",
      userId: "user_123",
      statusCode: 504,
    });

    expect(result).not.toBeNull();
    expect(result?.level).toBe("error");
    expect(result?.service).toBe("buildmate");
    expect(result?.error.message).toBe("Database query timeout");
    expect(result?.error.name).toBe("Error");
    expect(result?.error.stack).toBeDefined();
    expect(result?.context?.path).toBe("/api/projects");
    expect(result?.context?.userId).toBe("user_123");
    expect(result?.timestamp).toBeDefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = consoleErrorSpy.mock.calls[0][0];
    const loggedJson = consoleErrorSpy.mock.calls[0][1];
    expect(loggedMessage).toBe("[StructuredError]");
    const parsed = JSON.parse(loggedJson);
    expect(parsed.error.message).toBe("Database query timeout");
  });

  it("handles string or non-Error inputs gracefully", () => {
    const result = captureServerError("Plain string error message");

    expect(result).not.toBeNull();
    expect(result?.error.message).toBe("Plain string error message");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores Next.js NEXT_REDIRECT navigation signals", () => {
    const redirectErr = { digest: "NEXT_REDIRECT;replace;/dashboard;307;" };
    expect(isRedirectError(redirectErr)).toBe(true);

    const result = captureServerError(redirectErr);
    expect(result).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("logRouteError extracts path and method from Request", () => {
    const req = new Request("http://localhost:3000/api/projects/123/messages", {
      method: "POST",
      headers: {
        "x-request-id": "req_xyz_789",
        "user-agent": "Vitest/1.0",
      },
    });

    const result = logRouteError(req, new Error("Failed to insert message"));
    expect(result).not.toBeNull();
    expect(result?.context?.path).toBe("/api/projects/123/messages");
    expect(result?.context?.method).toBe("POST");
    expect(result?.context?.metadata?.requestId).toBe("req_xyz_789");
    expect(result?.context?.metadata?.userAgent).toBe("Vitest/1.0");
  });

  it("withErrorTracking returns value on success without logging", async () => {
    const action = vi.fn().mockResolvedValue("all good");
    const res = await withErrorTracking("testOperation", action);

    expect(res).toBe("all good");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("withErrorTracking logs and rethrows error on failure", async () => {
    const action = vi.fn().mockRejectedValue(new Error("Worker failure"));

    await expect(
      withErrorTracking("criticalJob", action, { path: "/worker/cron" })
    ).rejects.toThrow("Worker failure");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][1]);
    expect(parsed.error.message).toBe("Worker failure");
    expect(parsed.context.metadata.operation).toBe("criticalJob");
    expect(parsed.context.path).toBe("/worker/cron");
  });
});
