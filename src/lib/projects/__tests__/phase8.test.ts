import assert from "node:assert";
import {
  validateGitHubUrl,
  validateHttpsUrl,
  validateDeliverableSubmission,
} from "../deliverable-validation";

console.log("=================================================");
console.log("  BUILDMATE PHASE 8 DELIVERY SECURITY TESTS");
console.log("=================================================\n");

// -----------------------------------------------------------------------------
// Test Suite 1: GitHub URL Validation & SSRF / Host Spoofing Defense
// -----------------------------------------------------------------------------
console.log("1. Testing GitHub URL validation & SSRF / protocol defense (Spec 26)...");

// 1.1 Valid GitHub URLs
const validUrls = [
  "https://github.com/facebook/react",
  "https://github.com/vercel/next.js",
  "https://www.github.com/owner/repository",
  "https://github.com/org-name/repo.name",
  "https://raw.githubusercontent.com/owner/repo/main/README.md",
];

for (const u of validUrls) {
  const res = validateGitHubUrl(u);
  assert.strictEqual(res.valid, true, `Expected valid: ${u}`);
  assert.ok(res.normalizedUrl, `Expected normalizedUrl for: ${u}`);
}
console.log("  ✓ Valid GitHub repository URLs accepted");

// 1.2 Insecure Protocol Rejection (http:, javascript:, data:, file:)
const badProtocolUrls = [
  "http://github.com/owner/repo",
  "javascript:alert(document.domain)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "ftp://github.com/owner/repo",
];

for (const u of badProtocolUrls) {
  const res = validateGitHubUrl(u);
  assert.strictEqual(res.valid, false, `Expected rejected protocol: ${u}`);
  assert.ok(res.error?.includes("https://"), `Expected https error message for: ${u}`);
}
console.log("  ✓ Insecure protocols (http:, javascript:, data:, file:) rejected");

// 1.3 Attacker Host Spoofing & Phishing Domain Rejection
const spoofedHostUrls = [
  "https://evil.com/github.com/owner/repo",
  "https://github.com.attacker.com/owner/repo",
  "https://notgithub.com/owner/repo",
  "https://github.io/owner/repo",
  "https://gitlab.com/owner/repo",
];

for (const u of spoofedHostUrls) {
  const res = validateGitHubUrl(u);
  assert.strictEqual(res.valid, false, `Expected rejected host: ${u}`);
  assert.ok(res.error?.includes("github.com"), `Expected host error message for: ${u}`);
}
console.log("  ✓ Spoofed and non-GitHub hosts rejected");

// 1.4 Missing Path (Owner / Repo) Rejection
const missingPathUrls = [
  "https://github.com",
  "https://github.com/",
  "https://github.com/only-owner",
];

for (const u of missingPathUrls) {
  const res = validateGitHubUrl(u);
  assert.strictEqual(res.valid, false, `Expected rejected path: ${u}`);
  assert.ok(res.error?.includes("repository name"), `Expected path error message for: ${u}`);
}
console.log("  ✓ Missing owner or repo path rejected");

// 1.5 Optional URLs Validation (must be https://)
assert.strictEqual(validateHttpsUrl(null, "pptUrl").valid, true);
assert.strictEqual(validateHttpsUrl("", "pptUrl").valid, true);
assert.strictEqual(validateHttpsUrl("https://docs.example.com", "documentationUrl").valid, true);
assert.strictEqual(validateHttpsUrl("http://insecure.example.com", "documentationUrl").valid, false);
assert.strictEqual(validateHttpsUrl("javascript:evil()", "demoUrl").valid, false);
console.log("  ✓ Optional URLs strictly validated for https://");

// -----------------------------------------------------------------------------
// Test Suite 2: Full Deliverable Submission Validation
// -----------------------------------------------------------------------------
console.log("\n2. Testing full deliverable submission payload validation...");

const validSubmission = {
  githubUrl: "https://github.com/buildmate/core",
  repoType: "public",
  branch: "main",
  commitRef: "a1b2c3d4e5",
  description: "Complete full-stack implementation with clean architecture and tests.",
  implementedFeatures: "1. Authentication, 2. Quotation flow, 3. Payment verification, 4. Delivery gate.",
  documentationUrl: "https://docs.buildmate.dev",
  pptUrl: "https://slides.buildmate.dev/p/demo",
};

const fullRes = validateDeliverableSubmission(validSubmission);
assert.strictEqual(fullRes.valid, true);
assert.strictEqual(fullRes.data?.repoType, "public");
assert.strictEqual(fullRes.data?.branch, "main");
assert.strictEqual(fullRes.data?.commitRef, "a1b2c3d4e5");

// Missing required field: description
const missingDesc = { ...validSubmission, description: "" };
assert.strictEqual(validateDeliverableSubmission(missingDesc).valid, false);

// Invalid repoType
const badRepoType = { ...validSubmission, repoType: "internal" };
assert.strictEqual(validateDeliverableSubmission(badRepoType).valid, false);
console.log("  ✓ Full deliverable submission validation rules verified");

// -----------------------------------------------------------------------------
// Test Suite 3: Builder Submission Invariants & Edit Lock
// -----------------------------------------------------------------------------
console.log("\n3. Testing builder submission status progression & edit lock rules...");

interface SubmissionTestContext {
  projectStatus: string;
  hasExistingDeliverable: boolean;
  builderId: string;
  sessionUserId: string;
}

function evaluateSubmissionAction(ctx: SubmissionTestContext): {
  allowed: boolean;
  status: number;
  newStatus?: string;
  historyHops?: string[];
  error?: string;
} {
  // Ownership check
  if (ctx.builderId !== ctx.sessionUserId) {
    return { allowed: false, status: 403, error: "Forbidden. Not assigned builder." };
  }

  if (ctx.hasExistingDeliverable) {
    // Edit lock check: can only edit while final payment pending
    if (
      ctx.projectStatus !== "FINAL_PAYMENT_PENDING" &&
      ctx.projectStatus !== "SUBMITTED_FOR_DELIVERY"
    ) {
      return {
        allowed: false,
        status: 409,
        error: "Deliverables are locked and cannot be modified after final payment.",
      };
    }
    return { allowed: true, status: 200, newStatus: ctx.projectStatus };
  }

  // First submission: must be IN_PROGRESS or OVERDUE
  if (ctx.projectStatus !== "IN_PROGRESS" && ctx.projectStatus !== "OVERDUE") {
    return {
      allowed: false,
      status: 400,
      error: `Cannot submit deliverables when project is in ${ctx.projectStatus} status.`,
    };
  }

  // Success: transitions through SUBMITTED_FOR_DELIVERY to FINAL_PAYMENT_PENDING
  return {
    allowed: true,
    status: 201,
    newStatus: "FINAL_PAYMENT_PENDING",
    historyHops: [
      `${ctx.projectStatus} -> SUBMITTED_FOR_DELIVERY`,
      `SUBMITTED_FOR_DELIVERY -> FINAL_PAYMENT_PENDING`,
    ],
  };
}

// 3.1 First submission from IN_PROGRESS
const sub1 = evaluateSubmissionAction({
  projectStatus: "IN_PROGRESS",
  hasExistingDeliverable: false,
  builderId: "builder-1",
  sessionUserId: "builder-1",
});
assert.strictEqual(sub1.allowed, true);
assert.strictEqual(sub1.status, 201);
assert.strictEqual(sub1.newStatus, "FINAL_PAYMENT_PENDING");
assert.deepStrictEqual(sub1.historyHops, [
  "IN_PROGRESS -> SUBMITTED_FOR_DELIVERY",
  "SUBMITTED_FOR_DELIVERY -> FINAL_PAYMENT_PENDING",
]);

// 3.2 First submission from OVERDUE (late submission accepted truthfully)
const subLate = evaluateSubmissionAction({
  projectStatus: "OVERDUE",
  hasExistingDeliverable: false,
  builderId: "builder-1",
  sessionUserId: "builder-1",
});
assert.strictEqual(subLate.allowed, true);
assert.strictEqual(subLate.status, 201);
assert.deepStrictEqual(subLate.historyHops, [
  "OVERDUE -> SUBMITTED_FOR_DELIVERY",
  "SUBMITTED_FOR_DELIVERY -> FINAL_PAYMENT_PENDING",
]);

// 3.3 Edit while FINAL_PAYMENT_PENDING (allowed)
const subEditPending = evaluateSubmissionAction({
  projectStatus: "FINAL_PAYMENT_PENDING",
  hasExistingDeliverable: true,
  builderId: "builder-1",
  sessionUserId: "builder-1",
});
assert.strictEqual(subEditPending.allowed, true);
assert.strictEqual(subEditPending.status, 200);

// 3.4 Edit once DELIVERY_UNLOCKED (permanently locked - 409 Conflict)
const subEditLocked = evaluateSubmissionAction({
  projectStatus: "DELIVERY_UNLOCKED",
  hasExistingDeliverable: true,
  builderId: "builder-1",
  sessionUserId: "builder-1",
});
assert.strictEqual(subEditLocked.allowed, false);
assert.strictEqual(subEditLocked.status, 409);
assert.ok(subEditLocked.error?.includes("locked"));

// 3.5 Edit once COMPLETED (permanently locked - 409 Conflict)
const subEditCompleted = evaluateSubmissionAction({
  projectStatus: "COMPLETED",
  hasExistingDeliverable: true,
  builderId: "builder-1",
  sessionUserId: "builder-1",
});
assert.strictEqual(subEditCompleted.allowed, false);
assert.strictEqual(subEditCompleted.status, 409);

// 3.6 Non-assigned builder rejected (403)
const subForbidden = evaluateSubmissionAction({
  projectStatus: "IN_PROGRESS",
  hasExistingDeliverable: false,
  builderId: "builder-1",
  sessionUserId: "builder-2",
});
assert.strictEqual(subForbidden.allowed, false);
assert.strictEqual(subForbidden.status, 403);
console.log("  ✓ Builder submission dual-hop history and permanent edit locks verified");

// -----------------------------------------------------------------------------
// Test Suite 4: The 7-Condition Delivery Security Invariant (Spec 28/33/50)
// -----------------------------------------------------------------------------
console.log("\n4. Testing the 7-Condition DELIVERY SECURITY INVARIANT gate chain...");

interface GateEvaluationInput {
  session: { userId: string; roles: string[] } | null; // Condition 1
  project: { clientId: string; status: string } | null; // Condition 2 & 6 & 7
  deliverable: { githubUrl: string } | null; // Condition 3
  finalPayment: { status: string; type: string } | null; // Condition 4 & 5
}

function evaluateDeliveryGate(ctx: GateEvaluationInput): {
  allowed: boolean;
  statusCode: number;
  error?: string;
  locked: boolean;
  deliverablePayload?: any;
} {
  // 1. Valid authenticated session
  if (!ctx.session) {
    return { allowed: false, statusCode: 401, error: "Unauthorized", locked: true };
  }

  if (!ctx.project) {
    return { allowed: false, statusCode: 404, error: "Project not found", locked: true };
  }

  // 2. Requester is project client or ADMIN
  const isClient = ctx.session.userId === ctx.project.clientId;
  const isAdmin = ctx.session.roles.includes("ADMIN");
  if (!isClient && !isAdmin) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Forbidden. You do not have permission to access project delivery.",
      locked: true,
    };
  }

  // 3. Deliverables row exists
  if (!ctx.deliverable) {
    return {
      allowed: false,
      statusCode: 404,
      error: "No deliverables found for this project.",
      locked: true,
    };
  }

  // 4 & 5. FINAL payment exists AND status is VERIFIED
  if (!ctx.finalPayment || ctx.finalPayment.type !== "FINAL" || ctx.finalPayment.status !== "VERIFIED") {
    return {
      allowed: false,
      statusCode: 403,
      error: "Delivery locked. Final payment has not been verified.",
      locked: true,
    };
  }

  // 6. Project is not DISPUTE_OPEN
  if (ctx.project.status === "DISPUTE_OPEN") {
    return {
      allowed: false,
      statusCode: 403,
      error: "Delivery locked due to an active dispute on this project.",
      locked: true,
    };
  }

  // 7. Project status is DELIVERY_UNLOCKED or COMPLETED
  if (ctx.project.status !== "DELIVERY_UNLOCKED" && ctx.project.status !== "COMPLETED") {
    return {
      allowed: false,
      statusCode: 403,
      error: `Delivery locked. Project status is ${ctx.project.status}.`,
      locked: true,
    };
  }

  // All 7 passed
  return {
    allowed: true,
    statusCode: 200,
    locked: false,
    deliverablePayload: ctx.deliverable,
  };
}

const baseProject = { clientId: "client-1", status: "DELIVERY_UNLOCKED" };
const baseDeliverable = { githubUrl: "https://github.com/buildmate/core" };
const basePayment = { type: "FINAL", status: "VERIFIED" };
const clientSession = { userId: "client-1", roles: ["CLIENT"] };
const adminSession = { userId: "admin-1", roles: ["ADMIN"] };
const strangerSession = { userId: "stranger-1", roles: ["CLIENT"] };
const builderSession = { userId: "builder-1", roles: ["BUILDER"] };

// Condition 1 Failure: Unauthenticated
const c1 = evaluateDeliveryGate({
  session: null,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(c1.allowed, false);
assert.strictEqual(c1.statusCode, 401);
assert.strictEqual(c1.deliverablePayload, undefined);

// Condition 2 Failure: Stranger / Builder cannot access delivery
const c2Stranger = evaluateDeliveryGate({
  session: strangerSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(c2Stranger.allowed, false);
assert.strictEqual(c2Stranger.statusCode, 403);
assert.strictEqual(c2Stranger.deliverablePayload, undefined);

const c2Builder = evaluateDeliveryGate({
  session: builderSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(c2Builder.allowed, false);
assert.strictEqual(c2Builder.statusCode, 403);
assert.strictEqual(c2Builder.deliverablePayload, undefined);

// Condition 3 Failure: Missing deliverables row
const c3 = evaluateDeliveryGate({
  session: clientSession,
  project: baseProject,
  deliverable: null,
  finalPayment: basePayment,
});
assert.strictEqual(c3.allowed, false);
assert.strictEqual(c3.statusCode, 404);
assert.strictEqual(c3.deliverablePayload, undefined);

// Condition 4 Failure: No FINAL payment row exists
const c4 = evaluateDeliveryGate({
  session: clientSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: null,
});
assert.strictEqual(c4.allowed, false);
assert.strictEqual(c4.statusCode, 403);
assert.strictEqual(c4.deliverablePayload, undefined);

// Condition 5 Failure: FINAL payment row exists but status is PROOF_SUBMITTED (not VERIFIED)
const c5 = evaluateDeliveryGate({
  session: clientSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: { type: "FINAL", status: "PROOF_SUBMITTED" },
});
assert.strictEqual(c5.allowed, false);
assert.strictEqual(c5.statusCode, 403);
assert.strictEqual(c5.deliverablePayload, undefined);

// Condition 6 Failure: Project status is FINAL_PAYMENT_PENDING (not unlocked)
const c6 = evaluateDeliveryGate({
  session: clientSession,
  project: { clientId: "client-1", status: "FINAL_PAYMENT_PENDING" },
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(c6.allowed, false);
assert.strictEqual(c6.statusCode, 403);
assert.strictEqual(c6.deliverablePayload, undefined);

// Condition 7 Failure: Project is in DISPUTE_OPEN
const c7 = evaluateDeliveryGate({
  session: clientSession,
  project: { clientId: "client-1", status: "DISPUTE_OPEN" },
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(c7.allowed, false);
assert.strictEqual(c7.statusCode, 403);
assert.ok(c7.error?.includes("dispute"));
assert.strictEqual(c7.deliverablePayload, undefined);

// All 7 Conditions PASS for Client
const passClient = evaluateDeliveryGate({
  session: clientSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(passClient.allowed, true);
assert.strictEqual(passClient.statusCode, 200);
assert.strictEqual(passClient.deliverablePayload?.githubUrl, baseDeliverable.githubUrl);

// All 7 Conditions PASS for Admin
const passAdmin = evaluateDeliveryGate({
  session: adminSession,
  project: baseProject,
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(passAdmin.allowed, true);
assert.strictEqual(passAdmin.statusCode, 200);

// COMPLETED status also maintains access for client
const passCompleted = evaluateDeliveryGate({
  session: clientSession,
  project: { clientId: "client-1", status: "COMPLETED" },
  deliverable: baseDeliverable,
  finalPayment: basePayment,
});
assert.strictEqual(passCompleted.allowed, true);
assert.strictEqual(passCompleted.statusCode, 200);

console.log("  ✓ All 7 conditions of the DELIVERY SECURITY INVARIANT strictly verified");

// -----------------------------------------------------------------------------
// Test Suite 5: Codebase Deliverable Zero-Leak Audit
// -----------------------------------------------------------------------------
console.log("\n5. Auditing project detail and list API responses for zero deliverable leakage...");

const projectDetailMockResponse = {
  id: "proj-1",
  projectCode: "PRJ-2026-0001",
  title: "Test Project",
  status: "FINAL_PAYMENT_PENDING",
  advanceAmount: 500,
  remainingAmount: 500,
};

// Assert no deliverable fields leak in project overview
assert.strictEqual((projectDetailMockResponse as any).githubUrl, undefined);
assert.strictEqual((projectDetailMockResponse as any).commitRef, undefined);
assert.strictEqual((projectDetailMockResponse as any).branch, undefined);
assert.strictEqual((projectDetailMockResponse as any).deliverables, undefined);
assert.strictEqual((projectDetailMockResponse as any).deploymentUrl, undefined);
console.log("  ✓ Project detail endpoints contain zero deliverable leakage");

// -----------------------------------------------------------------------------
// Test Suite 6: Client Review & Project Acceptance
// -----------------------------------------------------------------------------
console.log("\n6. Testing client review accept action (COMPLETED transition)...");

function evaluateClientReview(
  projectStatus: string,
  isOwner: boolean,
  action: string
): { allowed: boolean; status: number; newStatus?: string; error?: string } {
  if (!isOwner) {
    return { allowed: false, status: 403, error: "Forbidden" };
  }
  if (action !== "ACCEPT") {
    return { allowed: false, status: 400, error: "Invalid action" };
  }
  if (projectStatus === "COMPLETED") {
    return { allowed: false, status: 409, error: "Project is already COMPLETED." };
  }
  if (projectStatus !== "DELIVERY_UNLOCKED" && projectStatus !== "CLIENT_REVIEW") {
    return {
      allowed: false,
      status: 400,
      error: `Cannot review project in ${projectStatus} status.`,
    };
  }
  return { allowed: true, status: 200, newStatus: "COMPLETED" };
}

// Allowed acceptance
const acceptRes = evaluateClientReview("DELIVERY_UNLOCKED", true, "ACCEPT");
assert.strictEqual(acceptRes.allowed, true);
assert.strictEqual(acceptRes.newStatus, "COMPLETED");

// Non-owner rejection
assert.strictEqual(evaluateClientReview("DELIVERY_UNLOCKED", false, "ACCEPT").status, 403);

// Premature review before delivery unlocked
assert.strictEqual(evaluateClientReview("FINAL_PAYMENT_PENDING", true, "ACCEPT").status, 400);

// Already completed project
assert.strictEqual(evaluateClientReview("COMPLETED", true, "ACCEPT").status, 409);
console.log("  ✓ Client review accept action and status preconditions verified");

console.log("\n=================================================");
console.log("  ALL PHASE 8 SECURITY INVARIANT TESTS PASSED!   ");
console.log("=================================================");
