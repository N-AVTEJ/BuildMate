#!/usr/bin/env node
/**
 * ==============================================================================
 * BuildMate Production Scalability Load Testing Suite
 * ==============================================================================
 *
 * Simulates 100 concurrent virtual users (VUs) executing critical user journeys:
 *  1. POST /api/auth/login        (Session authentication & rate-limit check)
 *  2. GET  /api/projects          (Client project list query with bounded limit)
 *  3. GET  /api/projects/available (Builder feed query with indexed search)
 *  4. GET  /api/projects/:id/delivery (Delivery-unlock gate evaluation)
 *
 * ------------------------------------------------------------------------------
 * SAFETY WARNING & RUN INSTRUCTIONS:
 * ------------------------------------------------------------------------------
 * [!] CRITICAL: DO NOT RUN THIS SCRIPT AGAINST PRODUCTION (buildmate.com).
 *     Heavy load tests create synthetic session cookies, trigger security alerts,
 *     and consume rate-limit quotas. ONLY run this script against:
 *     - Local development/staging server: http://127.0.0.1:3000
 *     - Dedicated cloud staging environment: https://staging.buildmate.dev
 *
 * Usage:
 *   # Run against local server with 100 concurrent users (default):
 *   node scripts/load-test.js
 *
 *   # Run against custom target with custom concurrency:
 *   TARGET_URL=http://localhost:3000 CONCURRENCY=100 ITERATIONS=5 node scripts/load-test.js
 *
 *   # Run via npm script:
 *   npm run test:load
 * ==============================================================================
 */

const { performance } = require("perf_hooks");

// Configuration with environment overrides
const TARGET_URL = (process.env.TARGET_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "100", 10);
const ITERATIONS_PER_USER = parseInt(process.env.ITERATIONS || "5", 10);
const AUTH_EMAIL = process.env.AUTH_EMAIL || "madipadiganavtej@gmail.com";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "Navtej2006";
const FALLBACK_PROJECT_ID = process.env.PROJECT_ID || "efe861b9-9c7a-41b0-8884-8fa0c385af58";

// Track latency samples per endpoint
const latencyBuckets = {
  overall: [],
  login: [],
  projects: [],
  available: [],
  delivery: [],
};

// Counters
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  serverErrors5xx: 0,
  rateLimited429: 0,
  networkErrors: 0,
  dbPoolErrors: 0,
};

function calculatePercentiles(latencies) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];

  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = Number((sum / sorted.length).toFixed(2));
  const min = Number(sorted[0].toFixed(2));
  const max = Number(sorted[sorted.length - 1].toFixed(2));
  const p50 = Number(getP(50).toFixed(2));
  const p90 = Number(getP(90).toFixed(2));
  const p95 = Number(getP(95).toFixed(2));
  const p99 = Number(getP(99).toFixed(2));

  return { min, max, avg, p50, p90, p95, p99 };
}

async function requestTimed(url, options, endpointKey) {
  const start = performance.now();
  stats.totalRequests++;

  try {
    const res = await fetch(url, options);
    const elapsed = performance.now() - start;

    latencyBuckets[endpointKey].push(elapsed);
    latencyBuckets.overall.push(elapsed);

    if (res.status >= 500) {
      stats.serverErrors5xx++;
      const text = await res.text().catch(() => "");
      if (text.includes("connection pool") || text.includes("too many clients") || text.includes("timeout")) {
        stats.dbPoolErrors++;
      }
    } else if (res.status === 429) {
      stats.rateLimited429++;
    } else {
      stats.successfulRequests++;
    }

    return { res, elapsed, ok: res.ok || res.status < 500 };
  } catch (err) {
    const elapsed = performance.now() - start;
    stats.networkErrors++;
    latencyBuckets[endpointKey].push(elapsed);
    latencyBuckets.overall.push(elapsed);
    return { res: null, elapsed, ok: false, error: err };
  }
}

/**
 * Executes the simulated journey for a single virtual user.
 */
async function runVirtualUser(vuIndex, sharedCookie, targetProjectId) {
  for (let iter = 0; iter < ITERATIONS_PER_USER; iter++) {
    // 1. POST /api/auth/login
    // We send unique client IP header simulation so per-IP rate-limiting behaves realistically
    const loginPayload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
    const loginHeaders = {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.${Math.floor(vuIndex / 250)}.${(vuIndex % 250) + 1}`,
    };
    await requestTimed(`${TARGET_URL}/api/auth/login`, {
      method: "POST",
      headers: loginHeaders,
      body: loginPayload,
    }, "login");

    const authHeaders = {
      cookie: sharedCookie,
      "x-forwarded-for": `10.0.${Math.floor(vuIndex / 250)}.${(vuIndex % 250) + 1}`,
    };

    // 2. GET /api/projects (Client Projects List)
    await requestTimed(`${TARGET_URL}/api/projects`, {
      method: "GET",
      headers: authHeaders,
    }, "projects");

    // 3. GET /api/projects/available (Builder Feed)
    await requestTimed(`${TARGET_URL}/api/projects/available`, {
      method: "GET",
      headers: authHeaders,
    }, "available");

    // 4. GET /api/projects/:id/delivery (Delivery Gate Verification)
    await requestTimed(`${TARGET_URL}/api/projects/${targetProjectId}/delivery`, {
      method: "GET",
      headers: authHeaders,
    }, "delivery");
  }
}

async function main() {
  console.log("=".repeat(78));
  console.log("🚀 BuildMate Concurrent Scalability Load Test");
  console.log("=".repeat(78));
  console.log(`Target URL:           ${TARGET_URL}`);
  console.log(`Concurrent VUs:       ${CONCURRENCY}`);
  console.log(`Iterations Per VU:    ${ITERATIONS_PER_USER}`);
  console.log(`Total Planned Req:    ${CONCURRENCY * ITERATIONS_PER_USER * 4}`);
  console.log(`Auth Email:           ${AUTH_EMAIL}`);
  console.log("-".repeat(78));

  // Verify server is reachable
  try {
    const health = await fetch(TARGET_URL);
    if (!health.ok && health.status >= 500) {
      console.error(`[ERROR] Server at ${TARGET_URL} returned status ${health.status}. Aborting.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[ERROR] Unable to reach target at ${TARGET_URL}:`, err.message);
    console.error("Please ensure the Next.js server is running (`npm start` or `npm run dev`).");
    process.exit(1);
  }

  // Obtain an authenticated session cookie for the protected routes
  console.log("[Setup] Authenticating test user session...");
  const authRes = await fetch(`${TARGET_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
  });

  if (!authRes.ok) {
    console.error(`[ERROR] Setup authentication failed with HTTP ${authRes.status}:`, await authRes.text());
    process.exit(1);
  }

  const sharedCookie = authRes.headers.get("set-cookie") || "";
  console.log("[Setup] Session established. Probing project directory...");

  // Discover a real project ID or use fallback
  let targetProjectId = FALLBACK_PROJECT_ID;
  try {
    const projRes = await fetch(`${TARGET_URL}/api/projects`, {
      headers: { cookie: sharedCookie },
    });
    if (projRes.ok) {
      const data = await projRes.json();
      if (data.projects && data.projects.length > 0) {
        targetProjectId = data.projects[0].id;
      }
    }
  } catch {
    // Keep fallback
  }
  console.log(`[Setup] Target Project ID for delivery checks: ${targetProjectId}`);
  console.log("-".repeat(78));
  console.log(`[Benchmark] Launching ${CONCURRENCY} concurrent virtual users...`);

  const wallClockStart = performance.now();

  // Execute 100 concurrent workers simultaneously
  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    runVirtualUser(i, sharedCookie, targetProjectId)
  );

  await Promise.all(workers);

  const wallClockTotalSec = (performance.now() - wallClockStart) / 1000;
  const rps = (stats.totalRequests / wallClockTotalSec).toFixed(1);

  // Compute metrics
  const overallMetrics = calculatePercentiles(latencyBuckets.overall);
  const loginMetrics = calculatePercentiles(latencyBuckets.login);
  const projectsMetrics = calculatePercentiles(latencyBuckets.projects);
  const availableMetrics = calculatePercentiles(latencyBuckets.available);
  const deliveryMetrics = calculatePercentiles(latencyBuckets.delivery);

  console.log("\n" + "=".repeat(78));
  console.log("📊 LOAD TEST EXECUTION RESULTS");
  console.log("=".repeat(78));
  console.log(`Total Elapsed Time:   ${wallClockTotalSec.toFixed(2)} seconds`);
  console.log(`Throughput:           ${rps} requests/second`);
  console.log(`Total Requests:       ${stats.totalRequests}`);
  console.log(`Successful Requests:  ${stats.successfulRequests}`);
  console.log(`Rate Limited (429):   ${stats.rateLimited429}`);
  console.log(`Server Errors (5xx):  ${stats.serverErrors5xx}`);
  console.log(`DB Pool Exhaustion:   ${stats.dbPoolErrors}`);
  console.log(`Network Failures:     ${stats.networkErrors}`);
  console.log(`Error Rate:           ${((stats.serverErrors5xx / stats.totalRequests) * 100).toFixed(2)}%`);
  console.log("-".repeat(78));
  console.log("LATENCY BENCHMARKS (milliseconds):");
  console.log("-".repeat(78));
  console.table({
    "POST /api/auth/login": {
      Reqs: latencyBuckets.login.length,
      Min: loginMetrics.min,
      p50: loginMetrics.p50,
      p90: loginMetrics.p90,
      p95: loginMetrics.p95,
      p99: loginMetrics.p99,
      Max: loginMetrics.max,
    },
    "GET /api/projects": {
      Reqs: latencyBuckets.projects.length,
      Min: projectsMetrics.min,
      p50: projectsMetrics.p50,
      p90: projectsMetrics.p90,
      p95: projectsMetrics.p95,
      p99: projectsMetrics.p99,
      Max: projectsMetrics.max,
    },
    "GET /api/projects/available": {
      Reqs: latencyBuckets.available.length,
      Min: availableMetrics.min,
      p50: availableMetrics.p50,
      p90: availableMetrics.p90,
      p95: availableMetrics.p95,
      p99: availableMetrics.p99,
      Max: availableMetrics.max,
    },
    "GET /api/projects/:id/delivery": {
      Reqs: latencyBuckets.delivery.length,
      Min: deliveryMetrics.min,
      p50: deliveryMetrics.p50,
      p90: deliveryMetrics.p90,
      p95: deliveryMetrics.p95,
      p99: deliveryMetrics.p99,
      Max: deliveryMetrics.max,
    },
    "ALL ENDPOINTS (Combined)": {
      Reqs: latencyBuckets.overall.length,
      Min: overallMetrics.min,
      p50: overallMetrics.p50,
      p90: overallMetrics.p90,
      p95: overallMetrics.p95,
      p99: overallMetrics.p99,
      Max: overallMetrics.max,
    },
  });

  console.log("=".repeat(78));
  if (stats.serverErrors5xx === 0 && stats.dbPoolErrors === 0 && stats.networkErrors === 0) {
    console.log("✅ VERDICT: PASSED. Server and DB pool survived 100 concurrent VUs with 0% server error rate.");
    process.exit(0);
  } else {
    console.error("❌ VERDICT: FAILED. Server encountered errors under load.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal load test runner error:", err);
  process.exit(1);
});
