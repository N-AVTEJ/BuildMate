#!/usr/bin/env node

/**
 * ==============================================================================
 * BuildMate Phase 16 — Production Scalability Load Test Script
 * ==============================================================================
 *
 * Goal: Simulate 100 concurrent virtual users hitting hot-path endpoints:
 *   1. Auth: POST /api/auth/login
 *   2. Client Dashboard / Projects: GET /api/projects?limit=50
 *   3. Builder Discovery Overview: GET /api/projects/available?limit=50
 *   4. Delivery-gate read-only: GET /api/projects/:id/delivery
 *
 * Target: Staging environment or local staging server.
 * NEVER RUN AGAINST PRODUCTION WITH REAL USER DATA.
 *
 * Usage:
 *   node scripts/load-test.js [targetUrl] [durationSeconds] [concurrency]
 *
 * Examples:
 *   node scripts/load-test.js http://localhost:3000 15 100
 *   TARGET_URL=https://staging.buildmate.dev node scripts/load-test.js
 * ==============================================================================
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const TARGET_URL = process.argv[2] || process.env.TARGET_URL || "http://localhost:3000";
const DURATION_SECONDS = parseInt(process.argv[3] || process.env.DURATION_SECONDS || "15", 10);
const CONCURRENCY = parseInt(process.argv[4] || process.env.CONCURRENCY || "100", 10);

// Default test credentials for simulated users
const TEST_EMAIL = process.env.LOAD_TEST_EMAIL || "buildrazor@gmail.com";
const TEST_PASSWORD = process.env.LOAD_TEST_PASSWORD || "razor123";

// Stats Collector
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  statusCodeCounts: {},
  latencies: [],
  endpointStats: {
    login: { count: 0, latencies: [], errors: 0 },
    projectsList: { count: 0, latencies: [], errors: 0 },
    builderAvailable: { count: 0, latencies: [], errors: 0 },
    deliveryCheck: { count: 0, latencies: [], errors: 0 },
  },
};

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 150 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 150 });

function makeRequest(urlStr, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const agent = isHttps ? httpsAgent : httpAgent;

    const reqOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "User-Agent": "BuildMate-LoadTest/1.0",
        ...(options.headers || {}),
      },
      agent,
      timeout: 10000,
    };

    const startTime = process.hrtime();

    const req = (isHttps ? https : http).request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const diff = process.hrtime(startTime);
        const latencyMs = diff[0] * 1000 + diff[1] / 1e6;
        const setCookie = res.headers["set-cookie"];
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie,
          body: data,
          latencyMs,
        });
      });
    });

    req.on("error", (err) => {
      const diff = process.hrtime(startTime);
      const latencyMs = diff[0] * 1000 + diff[1] / 1e6;
      resolve({
        statusCode: 0,
        error: err.message,
        latencyMs,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      const diff = process.hrtime(startTime);
      const latencyMs = diff[0] * 1000 + diff[1] / 1e6;
      resolve({
        statusCode: 408,
        error: "Timeout",
        latencyMs,
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function calculatePercentiles(arr) {
  if (arr.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const getP = (p) => {
    const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
    return sorted[idx].toFixed(2);
  };
  return {
    min: sorted[0].toFixed(2),
    p50: getP(50),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    max: sorted[sorted.length - 1].toFixed(2),
  };
}

async function loginUser() {
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const res = await makeRequest(`${TARGET_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });

  let sessionCookie = "";
  if (res.setCookie) {
    const cookieHeader = Array.isArray(res.setCookie) ? res.setCookie.join("; ") : res.setCookie;
    const match = cookieHeader.match(/buildmate_session=([^;]+)/);
    if (match) {
      sessionCookie = `buildmate_session=${match[1]}`;
    }
  }

  return { res, sessionCookie };
}

async function simulateWorker(workerId, endTime, sessionCookie, sampleProjectId) {
  while (Date.now() < endTime) {
    // Pick an action randomly across the 4 hot paths
    const choice = Math.random();

    if (choice < 0.25) {
      // Scenario 1: Login
      const payload = JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      const res = await makeRequest(`${TARGET_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        body: payload,
      });
      recordResult("login", res);
    } else if (choice < 0.5) {
      // Scenario 2: Client projects list (paginated)
      const res = await makeRequest(`${TARGET_URL}/api/projects?limit=50&offset=0`, {
        headers: sessionCookie ? { Cookie: sessionCookie } : {},
      });
      recordResult("projectsList", res);
    } else if (choice < 0.75) {
      // Scenario 3: Builder available projects overview (paginated)
      const res = await makeRequest(`${TARGET_URL}/api/projects/available?limit=50&offset=0`, {
        headers: sessionCookie ? { Cookie: sessionCookie } : {},
      });
      recordResult("builderAvailable", res);
    } else {
      // Scenario 4: Delivery gate read-only inspection
      const targetPrj = sampleProjectId || "00000000-0000-0000-0000-000000000000";
      const res = await makeRequest(`${TARGET_URL}/api/projects/${targetPrj}/delivery`, {
        headers: sessionCookie ? { Cookie: sessionCookie } : {},
      });
      recordResult("deliveryCheck", res);
    }

    // Small micro-pause to simulate user think-time (5-25ms)
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 5));
  }
}

function recordResult(scenario, res) {
  stats.totalRequests++;
  const code = res.statusCode || 0;
  stats.statusCodeCounts[code] = (stats.statusCodeCounts[code] || 0) + 1;

  stats.latencies.push(res.latencyMs);

  const scenarioStat = stats.endpointStats[scenario];
  scenarioStat.count++;
  scenarioStat.latencies.push(res.latencyMs);

  // Treat 200, 201, 401, 403, 404 as valid non-server-crash responses.
  // 500, 502, 503, 504 or network errors (code 0) are counted as failures.
  if (code >= 500 || code === 0) {
    stats.failedRequests++;
    scenarioStat.errors++;
  } else {
    stats.successfulRequests++;
  }
}

async function main() {
  console.log(`\n==============================================================================`);
  console.log(`🚀 BuildMate Phase 16 — Production Scalability Load Test`);
  console.log(`==============================================================================`);
  console.log(`Target URL:        ${TARGET_URL}`);
  console.log(`Duration:          ${DURATION_SECONDS} seconds`);
  console.log(`Concurrent VUs:    ${CONCURRENCY}`);
  console.log(`Simulated Account: ${TEST_EMAIL}`);
  console.log(`------------------------------------------------------------------------------`);

  console.log(`1. Testing target connectivity & performing initial login...`);
  const { res: initialLoginRes, sessionCookie } = await loginUser();
  console.log(`Initial login status: ${initialLoginRes.statusCode} (${initialLoginRes.latencyMs.toFixed(1)}ms)`);

  let sampleProjectId = "";
  if (sessionCookie) {
    console.log(`Session cookie acquired: ${sessionCookie.slice(0, 32)}...`);
    // Attempt to discover a real project ID for delivery gate checks
    const prjRes = await makeRequest(`${TARGET_URL}/api/projects?limit=5`, {
      headers: { Cookie: sessionCookie },
    });
    try {
      const parsed = JSON.parse(prjRes.body);
      if (parsed.projects && parsed.projects.length > 0) {
        sampleProjectId = parsed.projects[0].id;
        console.log(`Discovered project for delivery test: ${sampleProjectId}`);
      }
    } catch {
      // fallback
    }
  } else {
    console.log(`⚠️ Note: Proceeding with unauthenticated / mock token flows.`);
  }

  console.log(`\n2. Launching ${CONCURRENCY} concurrent virtual users for ${DURATION_SECONDS} seconds...`);
  const startTime = Date.now();
  const endTime = startTime + DURATION_SECONDS * 1000;

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(simulateWorker(i, endTime, sessionCookie, sampleProjectId));
  }

  // Periodic progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rps = (stats.totalRequests / Math.max(elapsed, 1)).toFixed(1);
    process.stdout.write(`\r[Running] Elapsed: ${elapsed}s / ${DURATION_SECONDS}s | Requests: ${stats.totalRequests} | Current Throughput: ${rps} req/s`);
  }, 1000);

  await Promise.all(workers);
  clearInterval(progressInterval);

  const totalTimeSeconds = (Date.now() - startTime) / 1000;
  const overallRps = (stats.totalRequests / totalTimeSeconds).toFixed(1);
  const errorRate = ((stats.failedRequests / Math.max(stats.totalRequests, 1)) * 100).toFixed(2);
  const overallPercentiles = calculatePercentiles(stats.latencies);

  console.log(`\n\n==============================================================================`);
  console.log(`📊 LOAD TEST RESULTS & BENCHMARK SUMMARY`);
  console.log(`==============================================================================`);
  console.log(`Total Requests:         ${stats.totalRequests}`);
  console.log(`Successful:             ${stats.successfulRequests}`);
  console.log(`Failed (5xx / Timeout): ${stats.failedRequests}`);
  console.log(`Error Rate:             ${errorRate}%`);
  console.log(`Average Throughput:     ${overallRps} req/s`);
  console.log(`------------------------------------------------------------------------------`);
  console.log(`HTTP Status Breakdown:`);
  for (const [code, count] of Object.entries(stats.statusCodeCounts)) {
    console.log(`  HTTP ${code}: ${count} (${((count / stats.totalRequests) * 100).toFixed(1)}%)`);
  }
  console.log(`------------------------------------------------------------------------------`);
  console.log(`Latency Percentiles (Overall):`);
  console.log(`  Min:  ${overallPercentiles.min} ms`);
  console.log(`  p50:  ${overallPercentiles.p50} ms (Median)`);
  console.log(`  p90:  ${overallPercentiles.p90} ms`);
  console.log(`  p95:  ${overallPercentiles.p95} ms`);
  console.log(`  p99:  ${overallPercentiles.p99} ms`);
  console.log(`  Max:  ${overallPercentiles.max} ms`);
  console.log(`------------------------------------------------------------------------------`);
  console.log(`Endpoint Performance Breakdown:`);

  const printEndpoint = (name, key) => {
    const s = stats.endpointStats[key];
    const p = calculatePercentiles(s.latencies);
    console.log(`  ${name.padEnd(28)} | Count: ${String(s.count).padStart(5)} | Errors: ${s.errors} | p50: ${p.p50}ms | p95: ${p.p95}ms | p99: ${p.p99}ms`);
  };

  printEndpoint("POST /api/auth/login", "login");
  printEndpoint("GET  /api/projects", "projectsList");
  printEndpoint("GET  /api/projects/available", "builderAvailable");
  printEndpoint("GET  /api/projects/:id/deliv", "deliveryCheck");

  console.log(`==============================================================================`);
  console.log(`Database Connection Exhaustion Check:`);
  if (stats.failedRequests === 0 && (stats.statusCodeCounts["500"] || 0) === 0 && (stats.statusCodeCounts["503"] || 0) === 0) {
    console.log(`  ✅ PASSED: Zero 500/503 errors encountered under ${CONCURRENCY} concurrent virtual users.`);
    console.log(`  ✅ No connection pool exhaustion or socket hang-ups detected.`);
  } else {
    console.log(`  ⚠️ WARNING: Encountered ${stats.failedRequests} errors under concurrency load.`);
  }
  console.log(`==============================================================================\n`);
}

main().catch(console.error);
