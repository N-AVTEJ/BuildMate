import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash Redis credentials are configured
const isUpstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    !process.env.UPSTASH_REDIS_REST_URL.includes("placeholder")
);

const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Safe IP extraction strategy based on trusted-proxy deployment model.
 * 
 * Deployment Assumptions:
 * 1. In development (NODE_ENV !== "production"), we strictly use "127.0.0.1"
 *    to avoid trusting spoofable client headers.
 * 2. In production, we prioritize platform-managed headers (e.g. x-real-ip, cf-connecting-ip)
 *    that are guaranteed to be stripped and rewritten by the edge proxy network (Vercel, Cloudflare, Nginx).
 * 3. If x-forwarded-for is consulted, the upstream reverse proxy MUST be configured to strip
 *    incoming client-provided X-Forwarded-For headers so the leading IP cannot be forged.
 */
export function getClientIp(req: Request): string {
  if (process.env.NODE_ENV !== "production") {
    return "127.0.0.1";
  }

  // 1. Platform-enforced edge headers
  const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (realIp) {
    return realIp.trim();
  }

  // 2. Fallback to X-Forwarded-For under trusted-proxy deployment model
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[0];
    }
  }

  return "127.0.0.1";
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

// Fallback in-memory store if Upstash credentials are not configured (e.g., local tests)
const fallbackStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Reusable rateLimit helper.
 * Reusable across auth endpoints (register, login, resend) as well as future
 * sensitive endpoints (payment-proof, issue, change-password).
 *
 * @param key Unique rate limiting identifier (e.g., `register:${ip}` or `login:${ip}:${email}`)
 * @param limit Maximum allowed requests in the sliding window
 * @param window Duration string formatted as `${number} ${'s' | 'm' | 'h' | 'd'}` (e.g. "1 h", "15 m")
 */
export async function rateLimit(
  key: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`
): Promise<RateLimitResult> {
  if (redis) {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: true,
      prefix: "buildmate:ratelimit",
    });
    const res = await ratelimit.limit(key);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    };
  }

  // Graceful fallback for local development / test environments without Redis
  const now = Date.now();
  const [amountStr, unit] = window.split(" ");
  const amount = parseInt(amountStr, 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const windowMs = amount * (multipliers[unit] || 60000);

  const entry = fallbackStore.get(key);
  if (!entry || now > entry.resetAt) {
    fallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset: entry.resetAt,
  };
}
