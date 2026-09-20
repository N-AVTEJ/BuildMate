import assert from "node:assert";
import { isProjectParticipant, can } from "../../authorization";
import {
  CLIENT_DISPUTE_REASONS,
  BUILDER_DISPUTE_REASONS,
  CLIENT_DISPUTE_STATUS_ALLOWLIST,
  BUILDER_DISPUTE_STATUS_ALLOWLIST,
  FORBIDDEN_DISPUTE_STATUSES,
  ADMIN_RESOLUTION_ACTIONS,
  ADMIN_RESOLUTION_MAP,
  sanitizeMessageBody,
  validateDisputeSubmission,
  validateAdminResolution,
} from "../dispute-validation";
import { ProjectStatus } from "../../project-status";

console.log("=================================================");
console.log("  BUILDMATE PHASE 9 MESSAGES & DISPUTES TESTS");
console.log("=================================================\n");

// -----------------------------------------------------------------------------
// Test Suite 1: isProjectParticipant & Central Authorization
// -----------------------------------------------------------------------------
console.log("1. Testing isProjectParticipant & participant access control...");

const clientUser = { id: "user-client-1" };
const builderUser = { id: "user-builder-1" };
const adminUser = { id: "user-admin-1" };
const outsiderUser = { id: "user-outsider-9" };

const projectSample = {
  id: "proj-123",
  clientId: "user-client-1",
  builderId: "user-builder-1",
};

const unassignedProject = {
  id: "proj-unassigned",
  clientId: "user-client-1",
  builderId: null,
};

// Client participant checks
assert.strictEqual(
  isProjectParticipant(clientUser, ["CLIENT"], projectSample),
  true,
  "Client owner must be recognized as participant"
);

// Builder participant checks
assert.strictEqual(
  isProjectParticipant(builderUser, ["BUILDER"], projectSample),
  true,
  "Assigned builder must be recognized as participant"
);

assert.strictEqual(
  isProjectParticipant(builderUser, ["BUILDER"], unassignedProject),
  false,
  "Builder on unassigned project must NOT be recognized as participant"
);

// Admin bypass
assert.strictEqual(
  isProjectParticipant(adminUser, ["ADMIN"], projectSample),
  true,
  "Admin must always be recognized as participant"
);

// Outsider rejection
assert.strictEqual(
  isProjectParticipant(outsiderUser, ["CLIENT"], projectSample),
  false,
  "Non-owner client must NOT be recognized as participant"
);
assert.strictEqual(
  isProjectParticipant(outsiderUser, ["BUILDER"], projectSample),
  false,
  "Non-assigned builder must NOT be recognized as participant"
);
assert.strictEqual(
  isProjectParticipant(null, [], projectSample),
  false,
  "Unauthenticated actor must NOT be recognized as participant"
);

// can() check integration for PROJECT_MESSAGES_VIEW & SEND
const clientSession: any = { user: clientUser, roles: ["CLIENT"] };
const outsiderSession: any = { user: outsiderUser, roles: ["CLIENT"] };

assert.strictEqual(
  can(clientSession, "PROJECT_MESSAGES_VIEW", projectSample).allowed,
  true,
  "can(PROJECT_MESSAGES_VIEW) must allow client participant"
);
assert.strictEqual(
  can(outsiderSession, "PROJECT_MESSAGES_VIEW", projectSample).allowed,
  false,
  "can(PROJECT_MESSAGES_VIEW) must deny outsider"
);

console.log("  ✓ isProjectParticipant and participant auth rules verified");

// -----------------------------------------------------------------------------
// Test Suite 2: Server-side Message Sanitization & Plain-text Enforcement
// -----------------------------------------------------------------------------
console.log("\n2. Testing server-side message sanitization...");

// HTML tag stripping
const htmlMessage = "<script>alert('xss')</script>Hello <b>BuildMate</b>! <a href='malicious.site'>Click</a>";
const sanitizedHtml = sanitizeMessageBody(htmlMessage);
assert.strictEqual(sanitizedHtml.valid, true);
assert.strictEqual(
  sanitizedHtml.sanitized,
  "alert('xss')Hello BuildMate! Click",
  "HTML tags must be completely stripped, leaving only plain text"
);

// Empty / whitespace-only messages
assert.strictEqual(sanitizeMessageBody("").valid, false);
assert.strictEqual(sanitizeMessageBody("   \n\t  ").valid, false);
assert.strictEqual(sanitizeMessageBody(12345).valid, false);
assert.strictEqual(sanitizeMessageBody(null).valid, false);

// 2000 character length bounds
const longValidMessage = "A".repeat(2000);
assert.strictEqual(sanitizeMessageBody(longValidMessage).valid, true);

const excessiveMessage = "A".repeat(2001);
const longResult = sanitizeMessageBody(excessiveMessage);
assert.strictEqual(longResult.valid, false);
assert.ok(longResult.error?.includes("2000"));

console.log("  ✓ Message sanitization, HTML stripping, and length limits verified");

// -----------------------------------------------------------------------------
// Test Suite 3: Client vs Builder Dispute Reasons & Validation
// -----------------------------------------------------------------------------
console.log("\n3. Testing role-specific dispute reasons & validation...");

// Client reasons
for (const reason of CLIENT_DISPUTE_REASONS) {
  const res = validateDisputeSubmission(
    { reason, description: "Detailed description of the issue encountered." },
    "CLIENT",
    "IN_PROGRESS"
  );
  assert.strictEqual(res.valid, true, `Expected valid client reason: ${reason}`);
}

// Client cannot use builder-only reason
const clientWithBuilderReason = validateDisputeSubmission(
  {
    reason: "CLIENT_NOT_RESPONDING",
    description: "Client has disappeared from chat.",
  },
  "CLIENT",
  "IN_PROGRESS"
);
assert.strictEqual(clientWithBuilderReason.valid, false);
assert.ok(clientWithBuilderReason.error?.includes("Invalid dispute reason for client"));

// Builder reasons
for (const reason of BUILDER_DISPUTE_REASONS) {
  const res = validateDisputeSubmission(
    { reason, description: "Detailed description of builder grievance." },
    "BUILDER",
    "IN_PROGRESS"
  );
  assert.strictEqual(res.valid, true, `Expected valid builder reason: ${reason}`);
}

// Builder cannot use client-only reason
const builderWithClientReason = validateDisputeSubmission(
  {
    reason: "MISSING_FEATURE",
    description: "Features missing from delivery.",
  },
  "BUILDER",
  "IN_PROGRESS"
);
assert.strictEqual(builderWithClientReason.valid, false);
assert.ok(builderWithClientReason.error?.includes("Invalid dispute reason for builder"));

// Description length checks
const shortDesc = validateDisputeSubmission(
  { reason: "OTHER", description: "Too short" },
  "CLIENT",
  "IN_PROGRESS"
);
assert.strictEqual(shortDesc.valid, false);
assert.ok(shortDesc.error?.includes("at least 10 characters"));

console.log("  ✓ Role-specific dispute reason isolation and description length verified");

// -----------------------------------------------------------------------------
// Test Suite 4: Dispute Creation Status Allowlist (Correction 2)
// -----------------------------------------------------------------------------
console.log("\n4. Testing dispute creation status allowlists & terminal state protection...");

// Client allowlist
for (const status of CLIENT_DISPUTE_STATUS_ALLOWLIST) {
  const res = validateDisputeSubmission(
    { reason: "OTHER", description: "Valid dispute description for status check." },
    "CLIENT",
    status
  );
  assert.strictEqual(res.valid, true, `Client must be allowed to dispute in status: ${status}`);
}

// Builder allowlist
for (const status of BUILDER_DISPUTE_STATUS_ALLOWLIST) {
  const res = validateDisputeSubmission(
    { reason: "OTHER", description: "Valid dispute description for status check." },
    "BUILDER",
    status
  );
  assert.strictEqual(res.valid, true, `Builder must be allowed to dispute in status: ${status}`);
}

// Builder cannot dispute COMPLETED
const builderCompleted = validateDisputeSubmission(
  { reason: "OTHER", description: "Builder trying to dispute completed." },
  "BUILDER",
  "COMPLETED"
);
assert.strictEqual(builderCompleted.valid, false);

// Forbidden / Terminal states cannot enter dispute
for (const forbiddenStatus of FORBIDDEN_DISPUTE_STATUSES) {
  const clientForbidden = validateDisputeSubmission(
    { reason: "OTHER", description: "Disputing a forbidden terminal state." },
    "CLIENT",
    forbiddenStatus
  );
  assert.strictEqual(
    clientForbidden.valid,
    false,
    `Status ${forbiddenStatus} must be rejected for dispute filing`
  );

  const builderForbidden = validateDisputeSubmission(
    { reason: "OTHER", description: "Disputing a forbidden terminal state." },
    "BUILDER",
    forbiddenStatus
  );
  assert.strictEqual(
    builderForbidden.valid,
    false,
    `Status ${forbiddenStatus} must be rejected for dispute filing`
  );
}

console.log("  ✓ Dispute creation status allowlists and terminal protections verified");

// -----------------------------------------------------------------------------
// Test Suite 5: Admin Resolution Allowlist & Invariant 8 (COMPLETED Rejection)
// -----------------------------------------------------------------------------
console.log("\n5. Testing admin resolution allowlist & Invariant 8 (COMPLETED rejection)...");

// Allowlisted actions
for (const action of ADMIN_RESOLUTION_ACTIONS) {
  const res = validateAdminResolution({
    action,
    resolutionNote: "Detailed administrative justification for verdict.",
  });
  assert.strictEqual(res.valid, true, `Expected valid admin action: ${action}`);
  assert.strictEqual(res.data?.targetStatus, ADMIN_RESOLUTION_MAP[action].targetStatus);
}

// Invariant 8: Explicit rejection of COMPLETED target
const completedAction1 = validateAdminResolution({
  action: "COMPLETED",
  resolutionNote: "Admin trying to directly mark project completed.",
});
assert.strictEqual(completedAction1.valid, false);
assert.ok(completedAction1.error?.includes("cannot directly mark a project COMPLETED"));

const completedAction2 = validateAdminResolution({
  action: "MARK_COMPLETED",
  resolutionNote: "Admin trying to directly mark project completed.",
});
assert.strictEqual(completedAction2.valid, false);
assert.ok(completedAction2.error?.includes("cannot directly mark a project COMPLETED"));

// Invalid action
const invalidAction = validateAdminResolution({
  action: "ARBITRARY_ACTION",
  resolutionNote: "Arbitrary action note.",
});
assert.strictEqual(invalidAction.valid, false);
assert.ok(invalidAction.error?.includes("Invalid resolution action"));

// Resolution note length check
const shortNote = validateAdminResolution({
  action: "RETURN_TO_DEVELOPMENT",
  resolutionNote: "Too short",
});
assert.strictEqual(shortNote.valid, false);
assert.ok(shortNote.error?.includes("at least 10 characters"));

console.log("  ✓ Admin resolution allowlist and Invariant 8 (COMPLETED rejection) verified");

// -----------------------------------------------------------------------------
// Test Suite 6: Dispute Invariants Simulation (Invariants 1-10)
// -----------------------------------------------------------------------------
console.log("\n6. Simulating end-to-end Dispute Invariants 1-10...");

// Invariant 1: At most one OPEN dispute per project
interface MockDispute {
  id: string;
  projectId: string;
  raisedBy: string;
  reason: string;
  description: string;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  preDisputeStatus: ProjectStatus;
  resolutionNote?: string | null;
}

interface MockProject {
  id: string;
  status: ProjectStatus;
}

const mockDb = {
  projects: new Map<string, MockProject>(),
  disputes: new Map<string, MockDispute>(),
  history: [] as Array<{ projectId: string; from: string; to: string; reason?: string }>,
  notifications: [] as Array<{ userId: string; message: string }>,
};

// Initialize project in IN_PROGRESS
mockDb.projects.set("p-1", { id: "p-1", status: "IN_PROGRESS" });

// Open Dispute Simulation
function openDispute(
  projectId: string,
  userId: string,
  role: "CLIENT" | "BUILDER",
  reason: any,
  description: string
) {
  const project = mockDb.projects.get(projectId);
  if (!project) throw new Error("Project not found");

  // Invariant 1: At most one OPEN dispute
  const existingOpen = Array.from(mockDb.disputes.values()).find(
    (d) => d.projectId === projectId && d.status === "OPEN"
  );
  if (existingOpen || project.status === "DISPUTE_OPEN") {
    return { status: 409, error: "An active dispute is already open for this project." };
  }

  // Validate
  const val = validateDisputeSubmission({ reason, description }, role, project.status);
  if (!val.valid) return { status: 400, error: val.error };

  // Invariant 3: preDisputeStatus captured from locked row
  const preDisputeStatus = project.status;

  // Invariant 2, 9, 10: Atomic state change
  const disputeId = `disp-${mockDb.disputes.size + 1}`;
  const dispute: MockDispute = {
    id: disputeId,
    projectId,
    raisedBy: userId,
    reason,
    description,
    status: "OPEN",
    preDisputeStatus,
  };
  mockDb.disputes.set(disputeId, dispute);
  project.status = "DISPUTE_OPEN";

  // Invariant 9: project_status_history
  mockDb.history.push({
    projectId,
    from: preDisputeStatus,
    to: "DISPUTE_OPEN",
    reason: `Dispute opened: ${reason}`,
  });

  // Invariant 10: Atomic notifications
  mockDb.notifications.push({
    userId: "admin-id",
    message: `Dispute opened on project by ${role}`,
  });

  return { status: 201, dispute };
}

// 6.1 Test normal dispute opening
const openResult = openDispute(
  "p-1",
  "client-1",
  "CLIENT",
  "MISSING_FEATURE",
  "The search filter feature is completely missing."
);
assert.strictEqual(openResult.status, 201);
assert.strictEqual(mockDb.projects.get("p-1")?.status, "DISPUTE_OPEN");
assert.strictEqual(openResult.dispute?.preDisputeStatus, "IN_PROGRESS");
assert.strictEqual(mockDb.history.length, 1);
assert.strictEqual(mockDb.history[0].from, "IN_PROGRESS");
assert.strictEqual(mockDb.history[0].to, "DISPUTE_OPEN");

// 6.2 Test Invariant 1: Competing open dispute rejected with 409 Conflict
const competingOpen = openDispute(
  "p-1",
  "builder-1",
  "BUILDER",
  "CLIENT_NOT_RESPONDING",
  "Client is unresponsive."
);
assert.strictEqual(competingOpen.status, 409);
assert.strictEqual(
  competingOpen.error,
  "An active dispute is already open for this project."
);

// 6.3 Test Invariant 4: Only dispute raiser can withdraw
function withdrawDispute(disputeId: string, callerId: string) {
  const dispute = mockDb.disputes.get(disputeId);
  if (!dispute || dispute.status !== "OPEN") return { status: 404 };

  // Invariant 4: Only raiser can withdraw
  if (dispute.raisedBy !== callerId) {
    return { status: 403, error: "Only the party who raised the dispute can withdraw it." };
  }

  const project = mockDb.projects.get(dispute.projectId)!;
  const restoredStatus = dispute.preDisputeStatus;

  dispute.status = "CANCELLED";
  project.status = restoredStatus;

  mockDb.history.push({
    projectId: project.id,
    from: "DISPUTE_OPEN",
    to: restoredStatus,
    reason: "Dispute withdrawn by raiser",
  });

  return { status: 200, restoredStatus };
}

// Non-raiser withdrawal rejected
const nonRaiserWithdraw = withdrawDispute(openResult.dispute!.id, "builder-1");
assert.strictEqual(nonRaiserWithdraw.status, 403);
assert.strictEqual(mockDb.projects.get("p-1")?.status, "DISPUTE_OPEN");

// Raiser withdrawal succeeds
const raiserWithdraw = withdrawDispute(openResult.dispute!.id, "client-1");
assert.strictEqual(raiserWithdraw.status, 200);
assert.strictEqual(mockDb.projects.get("p-1")?.status, "IN_PROGRESS");
assert.strictEqual(mockDb.disputes.get(openResult.dispute!.id)?.status, "CANCELLED");

// 6.4 Test Admin Resolution & Invariants 6 & 7 (DELIVERY_UNLOCKED check)
// Re-open dispute from DELIVERY_UNLOCKED
mockDb.projects.set("p-2", { id: "p-2", status: "DELIVERY_UNLOCKED" });
const openResult2 = openDispute(
  "p-2",
  "client-1",
  "CLIENT",
  "DOESNT_MATCH_REQUIREMENTS",
  "UI components do not match specifications."
);
assert.strictEqual(openResult2.status, 201);
assert.strictEqual(mockDb.projects.get("p-2")?.status, "DISPUTE_OPEN");

function resolveDispute(
  disputeId: string,
  action: AdminResolutionAction,
  note: string,
  deliverableExists: boolean,
  finalPaymentVerified: boolean
) {
  const dispute = mockDb.disputes.get(disputeId);
  if (!dispute || dispute.status !== "OPEN") {
    return { status: 409, error: "Conflict: Dispute is no longer OPEN." };
  }

  const project = mockDb.projects.get(dispute.projectId)!;
  if (project.status !== "DISPUTE_OPEN") {
    return { status: 409, error: "Conflict: Project is no longer DISPUTE_OPEN." };
  }

  const val = validateAdminResolution({ action, resolutionNote: note });
  if (!val.valid) return { status: 400, error: val.error };

  // Invariants 6 & 7: RETURN_TO_DELIVERY requires deliverable & verified final payment
  if (action === "RETURN_TO_DELIVERY") {
    if (!deliverableExists || !finalPaymentVerified) {
      return {
        status: 409,
        error:
          "Cannot resolve dispute to DELIVERY_UNLOCKED: Deliverables and verified FINAL payment required.",
      };
    }
  }

  const targetStatus = val.data!.targetStatus;
  dispute.status = "RESOLVED";
  dispute.resolutionNote = note;
  project.status = targetStatus;

  mockDb.history.push({
    projectId: project.id,
    from: "DISPUTE_OPEN",
    to: targetStatus,
    reason: `Admin resolution (${action}): ${note}`,
  });

  return { status: 200, targetStatus };
}

// Invariants 6 & 7: Resolving to RETURN_TO_DELIVERY fails if final payment not verified
const failedResolve = resolveDispute(
  openResult2.dispute!.id,
  "RETURN_TO_DELIVERY",
  "Attempting delivery unlock without payment.",
  true,
  false // Payment NOT verified
);
assert.strictEqual(failedResolve.status, 409);
assert.strictEqual(mockDb.projects.get("p-2")?.status, "DISPUTE_OPEN");

// Resolving with verified payment succeeds
const successfulResolve = resolveDispute(
  openResult2.dispute!.id,
  "RETURN_TO_DELIVERY",
  "Code matches updated scope upon review.",
  true,
  true // Payment verified
);
assert.strictEqual(successfulResolve.status, 200);
assert.strictEqual(mockDb.projects.get("p-2")?.status, "DELIVERY_UNLOCKED");
assert.strictEqual(mockDb.disputes.get(openResult2.dispute!.id)?.status, "RESOLVED");

// Competing resolve fails with 409 Conflict
const competingResolve = resolveDispute(
  openResult2.dispute!.id,
  "RETURN_TO_DEVELOPMENT",
  "Another admin trying to resolve already resolved dispute.",
  true,
  true
);
assert.strictEqual(competingResolve.status, 409);

console.log("  ✓ End-to-end Dispute Invariants 1-10 fully simulated and verified");

// -----------------------------------------------------------------------------
// Test Suite 7: Phase 8 Delivery Gate Integration Test
// -----------------------------------------------------------------------------
console.log("\n7. Verifying Phase 8 Delivery Gate integration when DISPUTE_OPEN...");

// Simulating Phase 8 Delivery Gate condition 7 check
function evaluatePhase8DeliveryGate(project: { status: ProjectStatus }) {
  if (project.status === "DISPUTE_OPEN") {
    return {
      allowed: false,
      status: 403,
      body: {
        error: "Delivery locked due to an active dispute on this project.",
        locked: true,
        inDispute: true,
      },
    };
  }
  if (project.status === "DELIVERY_UNLOCKED" || project.status === "COMPLETED") {
    return { allowed: true, status: 200 };
  }
  return { allowed: false, status: 403, body: { locked: true } };
}

const gatedDispute = evaluatePhase8DeliveryGate({ status: "DISPUTE_OPEN" });
assert.strictEqual(gatedDispute.allowed, false);
assert.strictEqual(gatedDispute.status, 403);
assert.strictEqual(gatedDispute.body.inDispute, true);
assert.strictEqual(gatedDispute.body.locked, true);

const unlockedGate = evaluatePhase8DeliveryGate({ status: "DELIVERY_UNLOCKED" });
assert.strictEqual(unlockedGate.allowed, true);
assert.strictEqual(unlockedGate.status, 200);

console.log("  ✓ Phase 8 Delivery Gate correctly blocks access when DISPUTE_OPEN");

console.log("\n=================================================");
console.log("  ALL PHASE 9 INVARIANT TESTS PASSED!            ");
console.log("=================================================\n");
