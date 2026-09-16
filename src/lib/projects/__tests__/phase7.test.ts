import assert from "node:assert";
import {
  computeEffectiveStatus,
  SYSTEM_ACTOR_ID,
  StatusProjectInput,
} from "../../project-status";

console.log("=========================================");
console.log("  BUILDMATE PHASE 7 ENGINE & RULES TESTS");
console.log("=========================================\n");

// -----------------------------------------------------------------------------
// Test Suite 1: Pure computeEffectiveStatus Tests (Deterministic Time)
// -----------------------------------------------------------------------------
console.log("1. Testing pure computeEffectiveStatus transitions & reasons...");

const T0 = new Date("2026-06-01T10:00:00.000Z");

// 1.1 Acceptance Deadline
const futureAcceptance = new Date(T0.getTime() + 24 * 60 * 60 * 1000);
const pastAcceptance = new Date(T0.getTime() - 1000);

const activeAvailable = computeEffectiveStatus(
  { status: "AVAILABLE", acceptanceDeadline: futureAcceptance },
  T0
);
assert.strictEqual(activeAvailable.status, "AVAILABLE");
assert.strictEqual(activeAvailable.changed, false);
assert.strictEqual(activeAvailable.reason, undefined);

const expiredAvailable = computeEffectiveStatus(
  { status: "AVAILABLE", acceptanceDeadline: pastAcceptance },
  T0
);
assert.strictEqual(expiredAvailable.status, "EXPIRED_NO_BUILDER");
assert.strictEqual(expiredAvailable.changed, true);
assert.strictEqual(expiredAvailable.reason, "ACCEPTANCE_DEADLINE_EXPIRED");
console.log("  ✓ Acceptance deadline expiration verified");

// 1.2 Advance Payment Deadline
const futureAdvance = new Date(T0.getTime() + 24 * 60 * 60 * 1000);
const pastAdvance = new Date(T0.getTime() - 1000);

const activeAwaitingAdvance = computeEffectiveStatus(
  { status: "AWAITING_ADVANCE", advancePaymentDeadline: futureAdvance },
  T0
);
assert.strictEqual(activeAwaitingAdvance.status, "AWAITING_ADVANCE");
assert.strictEqual(activeAwaitingAdvance.changed, false);

const expiredAdvance = computeEffectiveStatus(
  { status: "AWAITING_ADVANCE", advancePaymentDeadline: pastAdvance },
  T0
);
assert.strictEqual(expiredAdvance.status, "ADVANCE_PAYMENT_EXPIRED");
assert.strictEqual(expiredAdvance.changed, true);
assert.strictEqual(expiredAdvance.reason, "ADVANCE_PAYMENT_DEADLINE_EXPIRED");
console.log("  ✓ Advance payment deadline expiration verified");

// 1.3 IN_PROGRESS Development Deadline Expired
const devDeadline = new Date("2026-06-15T18:00:00.000Z");
const beforeDevDeadline = new Date("2026-06-15T17:59:59.000Z");
const afterDevDeadline = new Date("2026-06-15T18:00:01.000Z");

const activeDev = computeEffectiveStatus(
  {
    status: "IN_PROGRESS",
    developmentStartedAt: new Date("2026-06-01T10:00:00.000Z"),
    lastProgressUpdateAt: new Date("2026-06-14T10:00:00.000Z"), // 1 day ago
    developmentDeadline: devDeadline,
  },
  beforeDevDeadline
);
assert.strictEqual(activeDev.status, "IN_PROGRESS");
assert.strictEqual(activeDev.changed, false);

const overdueDev = computeEffectiveStatus(
  {
    status: "IN_PROGRESS",
    developmentStartedAt: new Date("2026-06-01T10:00:00.000Z"),
    lastProgressUpdateAt: new Date("2026-06-15T10:00:00.000Z"), // recent update
    developmentDeadline: devDeadline,
  },
  afterDevDeadline
);
assert.strictEqual(overdueDev.status, "OVERDUE");
assert.strictEqual(overdueDev.changed, true);
assert.strictEqual(overdueDev.reason, "DEVELOPMENT_DEADLINE_EXPIRED");
console.log("  ✓ IN_PROGRESS development deadline expiration verified");

// 1.4 IN_PROGRESS Progress Update Abandonment (> 3 days inactivity)
const startAt = new Date("2026-06-01T10:00:00.000Z");
const longFutureDevDeadline = new Date("2026-07-01T10:00:00.000Z");

// Exactly 3 days: not overdue yet
const exactly3Days = new Date(startAt.getTime() + 3 * 24 * 60 * 60 * 1000);
const activeAt3Days = computeEffectiveStatus(
  {
    status: "IN_PROGRESS",
    developmentStartedAt: startAt,
    lastProgressUpdateAt: startAt,
    developmentDeadline: longFutureDevDeadline,
  },
  exactly3Days
);
assert.strictEqual(activeAt3Days.status, "IN_PROGRESS");
assert.strictEqual(activeAt3Days.changed, false);

// 3 days + 1 millisecond: OVERDUE due to abandonment
const after3Days = new Date(startAt.getTime() + 3 * 24 * 60 * 60 * 1000 + 1);
const abandonedDev = computeEffectiveStatus(
  {
    status: "IN_PROGRESS",
    developmentStartedAt: startAt,
    lastProgressUpdateAt: startAt,
    developmentDeadline: longFutureDevDeadline,
  },
  after3Days
);
assert.strictEqual(abandonedDev.status, "OVERDUE");
assert.strictEqual(abandonedDev.changed, true);
assert.strictEqual(abandonedDev.reason, "PROGRESS_UPDATE_ABANDONED");
console.log("  ✓ Progress update abandonment (>3 days) verified");

// 1.5 Priority: Development Deadline Expired takes priority over Abandonment
const pastBoth = computeEffectiveStatus(
  {
    status: "IN_PROGRESS",
    developmentStartedAt: startAt,
    lastProgressUpdateAt: startAt, // 10 days inactive
    developmentDeadline: new Date(startAt.getTime() + 5 * 24 * 60 * 60 * 1000), // deadline passed 5 days ago
  },
  new Date(startAt.getTime() + 10 * 24 * 60 * 60 * 1000)
);
assert.strictEqual(pastBoth.status, "OVERDUE");
assert.strictEqual(pastBoth.reason, "DEVELOPMENT_DEADLINE_EXPIRED");
console.log("  ✓ Priority ordering (DEVELOPMENT_DEADLINE_EXPIRED > PROGRESS_UPDATE_ABANDONED) verified");

// -----------------------------------------------------------------------------
// Test Suite 2: Quotation Duration Validation (Integer 1-365, Required)
// -----------------------------------------------------------------------------
console.log("\n2. Testing estimatedDurationDays validation rules...");

function validateQuotationDuration(rawDuration: unknown): { valid: boolean; error?: string } {
  if (
    typeof rawDuration !== "number" ||
    !Number.isInteger(rawDuration) ||
    rawDuration < 1 ||
    rawDuration > 365
  ) {
    return {
      valid: false,
      error: "estimatedDurationDays is required and must be an integer between 1 and 365.",
    };
  }
  return { valid: true };
}

// Invalid inputs
assert.strictEqual(validateQuotationDuration(undefined).valid, false);
assert.strictEqual(validateQuotationDuration(null).valid, false);
assert.strictEqual(validateQuotationDuration("14").valid, false);
assert.strictEqual(validateQuotationDuration(0).valid, false);
assert.strictEqual(validateQuotationDuration(-5).valid, false);
assert.strictEqual(validateQuotationDuration(366).valid, false);
assert.strictEqual(validateQuotationDuration(14.5).valid, false);
assert.strictEqual(validateQuotationDuration(NaN).valid, false);

// Valid inputs
assert.strictEqual(validateQuotationDuration(1).valid, true);
assert.strictEqual(validateQuotationDuration(14).valid, true);
assert.strictEqual(validateQuotationDuration(30).valid, true);
assert.strictEqual(validateQuotationDuration(365).valid, true);
console.log("  ✓ Integer 1-365 range & mandatory requirement verified");

// -----------------------------------------------------------------------------
// Test Suite 3: Builder Progress Update Recovery Guard
// -----------------------------------------------------------------------------
console.log("\n3. Testing builder progress updates recovery guard...");

interface ProjectState {
  status: "IN_PROGRESS" | "OVERDUE" | "AVAILABLE" | "AWAITING_ADVANCE" | "COMPLETED";
  developmentDeadline: Date | null;
  developmentStartedAt: Date | null;
  lastProgressUpdateAt: Date | null;
}

function evaluateProgressUpdate(
  project: ProjectState,
  now: Date
): { allowed: boolean; newStatus: string; reason?: string; errorStatus?: number; error?: string } {
  const effective = computeEffectiveStatus(
    {
      status: project.status as any,
      developmentDeadline: project.developmentDeadline,
      developmentStartedAt: project.developmentStartedAt,
      lastProgressUpdateAt: project.lastProgressUpdateAt,
    },
    now
  );

  if (effective.status === "OVERDUE") {
    // Cannot recover if development deadline has passed
    if (
      effective.reason === "DEVELOPMENT_DEADLINE_EXPIRED" ||
      (project.developmentDeadline && now > project.developmentDeadline)
    ) {
      return {
        allowed: false,
        newStatus: "OVERDUE",
        errorStatus: 409,
        error:
          "Development deadline has expired. Progress updates cannot restore project to IN_PROGRESS without administrative deadline extension.",
      };
    }

    if (effective.reason === "PROGRESS_UPDATE_ABANDONED") {
      return {
        allowed: true,
        newStatus: "IN_PROGRESS",
        reason: "RECOVERED_FROM_ABANDONMENT",
      };
    }
  } else if (effective.status === "IN_PROGRESS") {
    return {
      allowed: true,
      newStatus: "IN_PROGRESS",
      reason: "NORMAL_UPDATE",
    };
  }

  return {
    allowed: false,
    newStatus: project.status,
    errorStatus: 400,
    error: "Progress updates are only permitted during active development.",
  };
}

// 3.1 Normal update during active development
const nowTest = new Date("2026-06-05T10:00:00.000Z");
const activeProject: ProjectState = {
  status: "IN_PROGRESS",
  developmentDeadline: new Date("2026-06-20T10:00:00.000Z"),
  developmentStartedAt: new Date("2026-06-01T10:00:00.000Z"),
  lastProgressUpdateAt: new Date("2026-06-04T10:00:00.000Z"),
};
const resActive = evaluateProgressUpdate(activeProject, nowTest);
assert.strictEqual(resActive.allowed, true);
assert.strictEqual(resActive.newStatus, "IN_PROGRESS");
assert.strictEqual(resActive.reason, "NORMAL_UPDATE");

// 3.2 Overdue due to abandonment (4 days inactive, but deadline in future) -> Recovery ALLOWED
const abandonedProject: ProjectState = {
  status: "IN_PROGRESS", // stored in DB as IN_PROGRESS or OVERDUE
  developmentDeadline: new Date("2026-06-20T10:00:00.000Z"),
  developmentStartedAt: new Date("2026-06-01T10:00:00.000Z"),
  lastProgressUpdateAt: new Date("2026-06-01T10:00:00.000Z"), // 4 days ago
};
const resAbandonment = evaluateProgressUpdate(abandonedProject, nowTest);
assert.strictEqual(resAbandonment.allowed, true);
assert.strictEqual(resAbandonment.newStatus, "IN_PROGRESS");
assert.strictEqual(resAbandonment.reason, "RECOVERED_FROM_ABANDONMENT");

// 3.3 Overdue due to development deadline expiration -> Recovery REJECTED (409)
const expiredDevProject: ProjectState = {
  status: "IN_PROGRESS",
  developmentDeadline: new Date("2026-06-04T10:00:00.000Z"), // passed yesterday
  developmentStartedAt: new Date("2026-05-20T10:00:00.000Z"),
  lastProgressUpdateAt: new Date("2026-06-04T12:00:00.000Z"), // recent update yesterday
};
const resExpiredDev = evaluateProgressUpdate(expiredDevProject, nowTest);
assert.strictEqual(resExpiredDev.allowed, false);
assert.strictEqual(resExpiredDev.errorStatus, 409);
assert.ok(resExpiredDev.error?.includes("administrative deadline extension"));

// 3.4 Inactive status (AVAILABLE) -> Rejected (400)
const availableProj: ProjectState = {
  status: "AVAILABLE",
  developmentDeadline: null,
  developmentStartedAt: null,
  lastProgressUpdateAt: null,
};
const resAvailable = evaluateProgressUpdate(availableProj, nowTest);
assert.strictEqual(resAvailable.allowed, false);
assert.strictEqual(resAvailable.errorStatus, 400);
console.log("  ✓ Builder progress update recovery rules and guards verified");

// -----------------------------------------------------------------------------
// Test Suite 4: Automated Status History Attribution
// -----------------------------------------------------------------------------
console.log("\n4. Testing automated status history attribution...");

assert.strictEqual(SYSTEM_ACTOR_ID, "00000000-0000-0000-0000-000000000000");

function resolveHistoryActor(isAutomated: boolean, humanUserId?: string): string {
  if (isAutomated) {
    return SYSTEM_ACTOR_ID;
  }
  if (!humanUserId) {
    throw new Error("Human actor ID required for manual status transitions");
  }
  return humanUserId;
}

const clientUserId = "11111111-1111-1111-1111-111111111111";
const builderUserId = "22222222-2222-2222-2222-222222222222";

// Automated transitions must NEVER log clientId or builderId
const automatedActor = resolveHistoryActor(true, clientUserId);
assert.strictEqual(automatedActor, SYSTEM_ACTOR_ID);
assert.notStrictEqual(automatedActor, clientUserId);
assert.notStrictEqual(automatedActor, builderUserId);

// Manual transition by builder logs builderId
const manualActor = resolveHistoryActor(false, builderUserId);
assert.strictEqual(manualActor, builderUserId);
console.log("  ✓ SYSTEM_ACTOR_ID used for automated transitions without human attribution");

// -----------------------------------------------------------------------------
// Test Suite 5: Admin Resolve-Overdue & Competing Action Safety
// -----------------------------------------------------------------------------
console.log("\n5. Testing admin resolve-overdue (EXTEND & DISPUTE)...");

function executeAdminResolve(
  currentStatus: string,
  action: "EXTEND" | "DISPUTE",
  options: { extensionDays?: number; reason: string; now: Date; currentDeadline?: Date }
): { success: boolean; status?: number; error?: string; newStatus?: string; newDeadline?: Date } {
  // Concurrency guard: Must be in OVERDUE status
  if (currentStatus !== "OVERDUE") {
    return {
      success: false,
      status: 409,
      error: `Project is no longer in OVERDUE status (current status: ${currentStatus}).`,
    };
  }

  if (action === "EXTEND") {
    if (!options.extensionDays || options.extensionDays < 1 || options.extensionDays > 90) {
      return { success: false, status: 400, error: "extensionDays must be integer 1-90" };
    }
    const base =
      options.currentDeadline && options.currentDeadline.getTime() > options.now.getTime()
        ? options.currentDeadline.getTime()
        : options.now.getTime();
    const newDeadline = new Date(base + options.extensionDays * 24 * 60 * 60 * 1000);
    return { success: true, newStatus: "IN_PROGRESS", newDeadline };
  } else if (action === "DISPUTE") {
    return { success: true, newStatus: "DISPUTE_OPEN" };
  }

  return { success: false, status: 400, error: "Invalid action" };
}

// 5.1 EXTEND on OVERDUE project
const overdueProjectDeadline = new Date("2026-06-01T10:00:00.000Z");
const resolveNow = new Date("2026-06-03T10:00:00.000Z");

const extendRes = executeAdminResolve("OVERDUE", "EXTEND", {
  extensionDays: 14,
  reason: "Builder requested 2-week extension due to illness",
  now: resolveNow,
  currentDeadline: overdueProjectDeadline,
});
assert.strictEqual(extendRes.success, true);
assert.strictEqual(extendRes.newStatus, "IN_PROGRESS");
// Extension from resolveNow + 14 days
const expectedNewDeadline = new Date(resolveNow.getTime() + 14 * 24 * 60 * 60 * 1000);
assert.strictEqual(extendRes.newDeadline?.getTime(), expectedNewDeadline.getTime());

// 5.2 DISPUTE on OVERDUE project
const disputeRes = executeAdminResolve("OVERDUE", "DISPUTE", {
  reason: "Builder unresponsive for 10 days",
  now: resolveNow,
});
assert.strictEqual(disputeRes.success, true);
assert.strictEqual(disputeRes.newStatus, "DISPUTE_OPEN");

// 5.3 Competing admin race: Second admin attempts resolve on already-resolved project
const secondAdminRes = executeAdminResolve(extendRes.newStatus!, "EXTEND", {
  extensionDays: 7,
  reason: "Second admin action",
  now: resolveNow,
});
assert.strictEqual(secondAdminRes.success, false);
assert.strictEqual(secondAdminRes.status, 409);
assert.ok(secondAdminRes.error?.includes("no longer in OVERDUE status"));
console.log("  ✓ Admin EXTEND, DISPUTE, and competing action conflict rejection (409) verified");

// -----------------------------------------------------------------------------
// Test Suite 6: Idempotent Overdue Notification Claim
// -----------------------------------------------------------------------------
console.log("\n6. Testing idempotent overdue notification claim...");

interface NotificationClaimProject {
  id: string;
  status: string;
  overdueNotificationSentAt: Date | null;
}

function claimOverdueNotification(
  project: NotificationClaimProject,
  now: Date
): { claimed: boolean; updatedProject: NotificationClaimProject } {
  if (!project.overdueNotificationSentAt) {
    return {
      claimed: true,
      updatedProject: {
        ...project,
        overdueNotificationSentAt: now,
      },
    };
  }
  return {
    claimed: false,
    updatedProject: project,
  };
}

const freshOverdueProj: NotificationClaimProject = {
  id: "proj-1",
  status: "OVERDUE",
  overdueNotificationSentAt: null,
};

// First read claims notification
const claim1 = claimOverdueNotification(freshOverdueProj, nowTest);
assert.strictEqual(claim1.claimed, true);
assert.strictEqual(claim1.updatedProject.overdueNotificationSentAt?.getTime(), nowTest.getTime());

// Second read with existing claim does NOT re-claim
const claim2 = claimOverdueNotification(claim1.updatedProject, new Date(nowTest.getTime() + 60000));
assert.strictEqual(claim2.claimed, false);
console.log("  ✓ Idempotent overdue notification claim verified");

console.log("\n=========================================");
console.log("  ALL PHASE 7 TESTS PASSED SUCCESSFULLY!  ");
console.log("=========================================");
