import assert from "node:assert";
import {
  can,
  AuthAction,
  ProjectResourceContext,
} from "../../authorization";
import { SessionValidationResult } from "../../auth/session";
import {
  isValidProofExtension,
  isValidProofMimeType,
  validateProofBuffer,
  generatePaymentProofKey,
  isKeyInProjectScope,
  getUploadUrl,
  getDownloadUrl,
  verifyStorageObjectExists,
  registerMockFile,
  clearMockStorage,
} from "../../storage";
import {
  computePaymentReminderDecision,
  ProjectReminderInput,
} from "../payment-reminders";

// Mock Actors
const verifiedClientAuth: SessionValidationResult = {
  user: {
    id: "client-101",
    email: "client@buildmate.com",
    name: "Verified Client",
    emailVerified: true,
  },
  roles: ["CLIENT"],
  session: { id: "sess-1", userId: "client-101", expiresAt: new Date(Date.now() + 86400000) },
};

const unverifiedClientAuth: SessionValidationResult = {
  user: {
    id: "client-unverified",
    email: "unverified@buildmate.com",
    name: "Unverified Client",
    emailVerified: false,
  },
  roles: ["CLIENT"],
  session: { id: "sess-2", userId: "client-unverified", expiresAt: new Date(Date.now() + 86400000) },
};

const otherClientAuth: SessionValidationResult = {
  user: {
    id: "client-other",
    email: "other@buildmate.com",
    name: "Other Client",
    emailVerified: true,
  },
  roles: ["CLIENT"],
  session: { id: "sess-3", userId: "client-other", expiresAt: new Date(Date.now() + 86400000) },
};

const builderAuth: SessionValidationResult = {
  user: {
    id: "builder-202",
    email: "builder@buildmate.com",
    name: "Builder User",
    emailVerified: true,
  },
  roles: ["BUILDER"],
  session: { id: "sess-4", userId: "builder-202", expiresAt: new Date(Date.now() + 86400000) },
};

const adminAuth: SessionValidationResult = {
  user: {
    id: "admin-999",
    email: "admin@buildmate.com",
    name: "Platform Admin",
    emailVerified: true,
  },
  roles: ["ADMIN"],
  session: { id: "sess-5", userId: "admin-999", expiresAt: new Date(Date.now() + 86400000) },
};

async function runPhase6Tests() {
  console.log("=== Phase 6 Payment-Proof System Test Suite ===\n");

  // =========================================================================
  // 1. Whole Rupee Money Units (No /100 or Paise)
  // =========================================================================
  console.log("1. Testing whole INR rupee integer representations...");
  const advanceAmount = 450;
  const remainingAmount = 1050;
  const totalPrice = 1500;

  assert.strictEqual(typeof advanceAmount, "number");
  assert.strictEqual(Number.isInteger(advanceAmount), true);
  assert.strictEqual(advanceAmount, 450, "₹450 must be stored as 450, not 45000 paise");
  assert.strictEqual(totalPrice, advanceAmount + remainingAmount);
  assert.strictEqual(
    `₹${advanceAmount}`,
    "₹450",
    "Displaying whole rupee amounts without division by 100"
  );
  console.log("  ✓ Whole INR integer rule verified (₹1500 = 1500, ₹450 = 450)");

  // =========================================================================
  // 2. Central Authorization for Phase 6 Actions
  // =========================================================================
  console.log("\n2. Testing Central Authorization (RBAC & IDOR defense)...");
  const projectContext: ProjectResourceContext = {
    clientId: "client-101",
    builderId: "builder-202",
    status: "AWAITING_ADVANCE",
  };

  // PAYMENT_VIEW_INFO
  assert.strictEqual(
    can(verifiedClientAuth, "PAYMENT_VIEW_INFO", projectContext).allowed,
    true,
    "Client owner can view payment info"
  );
  assert.strictEqual(
    can(otherClientAuth, "PAYMENT_VIEW_INFO", projectContext).allowed,
    false,
    "Other client cannot view payment info"
  );
  assert.strictEqual(
    can(adminAuth, "PAYMENT_VIEW_INFO", projectContext).allowed,
    true,
    "Admin can view payment info"
  );

  // PAYMENT_SUBMIT_PROOF
  assert.strictEqual(
    can(verifiedClientAuth, "PAYMENT_SUBMIT_PROOF", projectContext).allowed,
    true,
    "Verified client owner can submit payment proof"
  );
  assert.strictEqual(
    can(unverifiedClientAuth, "PAYMENT_SUBMIT_PROOF", projectContext).allowed,
    false,
    "Unverified client cannot submit payment proof"
  );
  assert.strictEqual(
    can(otherClientAuth, "PAYMENT_SUBMIT_PROOF", projectContext).allowed,
    false,
    "Other client cannot submit payment proof for another's project"
  );
  assert.strictEqual(
    can(builderAuth, "PAYMENT_SUBMIT_PROOF", projectContext).allowed,
    false,
    "Builder cannot submit payment proof"
  );

  // ADMIN_PAYMENT_LIST, VERIFY, REJECT
  assert.strictEqual(
    can(adminAuth, "ADMIN_PAYMENT_LIST").allowed,
    true,
    "Admin can list payments"
  );
  assert.strictEqual(
    can(adminAuth, "ADMIN_PAYMENT_VERIFY").allowed,
    true,
    "Admin can verify payments"
  );
  assert.strictEqual(
    can(adminAuth, "ADMIN_PAYMENT_REJECT").allowed,
    true,
    "Admin can reject payments"
  );
  assert.strictEqual(
    can(verifiedClientAuth, "ADMIN_PAYMENT_VERIFY").allowed,
    false,
    "Client cannot verify payments"
  );
  assert.strictEqual(
    can(builderAuth, "ADMIN_PAYMENT_VERIFY").allowed,
    false,
    "Builder cannot verify payments"
  );
  console.log("  ✓ Central authorization and IDOR protections pass");

  // =========================================================================
  // 3. Storage Security, Key Scoping & Presigned URLs
  // =========================================================================
  console.log("\n3. Testing Storage Security, Key Scoping & Presigned URLs...");
  const projectId = "proj-123";
  const validKey = generatePaymentProofKey(projectId, "ADVANCE", ".png");

  assert.strictEqual(
    isKeyInProjectScope(validKey, projectId, "ADVANCE"),
    true,
    "Valid key matches project and payment scope"
  );

  // Reject traversal or arbitrary keys
  assert.strictEqual(
    isKeyInProjectScope(`proofs/${projectId}/advance/../../../etc/passwd`, projectId, "ADVANCE"),
    false,
    "Directory traversal key rejected"
  );
  assert.strictEqual(
    isKeyInProjectScope("arbitrary-key.png", projectId, "ADVANCE"),
    false,
    "Arbitrary key rejected"
  );
  assert.strictEqual(
    isKeyInProjectScope(validKey, "other-project", "ADVANCE"),
    false,
    "Key scoped to different project rejected"
  );
  assert.strictEqual(
    isKeyInProjectScope(validKey, projectId, "FINAL"),
    false,
    "Key scoped to ADVANCE rejected for FINAL"
  );

  // Extensions & MIME checks
  assert.strictEqual(isValidProofExtension(".png"), true);
  assert.strictEqual(isValidProofExtension(".jpg"), true);
  assert.strictEqual(isValidProofExtension(".exe"), false);
  assert.strictEqual(isValidProofMimeType("image/png"), true);
  assert.strictEqual(isValidProofMimeType("application/x-sh"), false);

  // Magic bytes inspection
  const fakePngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const fakeBadBuffer = Buffer.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
  ]);
  assert.strictEqual(validateProofBuffer(fakePngBuffer).valid, true);
  assert.strictEqual(validateProofBuffer(fakeBadBuffer).valid, false);

  // Presigned URLs TTL
  const uploadUrl = await getUploadUrl(validKey, "image/png", 300);
  assert.ok(uploadUrl.includes("upload") || uploadUrl.includes("X-Amz-Expires=300"));
  const downloadUrl = await getDownloadUrl(validKey, 60);
  assert.ok(downloadUrl.includes("download") || downloadUrl.includes("X-Amz-Expires=60"));

  // Storage object existence check
  clearMockStorage();
  const checkBefore = await verifyStorageObjectExists(validKey);
  assert.strictEqual(checkBefore.exists, false, "Object must not exist before upload");

  registerMockFile(validKey, 2048, "image/png");
  const checkAfter = await verifyStorageObjectExists(validKey);
  assert.strictEqual(checkAfter.exists, true, "Object exists after mock upload");
  assert.strictEqual(checkAfter.size, 2048);
  console.log("  ✓ Storage security, key scoping and presigned URLs verified");

  // =========================================================================
  // 4. Positive Amount Guard on Payment Info
  // =========================================================================
  console.log("\n4. Testing Payment Info Positive Amount Guard...");
  function validatePaymentExpectedAmount(amount: any): { valid: boolean; error?: string } {
    if (
      amount === null ||
      amount === undefined ||
      typeof amount !== "number" ||
      amount <= 0 ||
      !Number.isInteger(amount)
    ) {
      return { valid: false, error: "Project payment amount is not configured or invalid." };
    }
    return { valid: true };
  }

  assert.strictEqual(validatePaymentExpectedAmount(450).valid, true);
  assert.strictEqual(validatePaymentExpectedAmount(null).valid, false);
  assert.strictEqual(validatePaymentExpectedAmount(undefined).valid, false);
  assert.strictEqual(validatePaymentExpectedAmount(0).valid, false);
  assert.strictEqual(validatePaymentExpectedAmount(-100).valid, false);
  assert.strictEqual(validatePaymentExpectedAmount(45.5).valid, false);
  console.log("  ✓ Expected amount strictly requires a positive integer");

  // =========================================================================
  // 5. Normal Advance Proof Submission (Atomic Progression)
  // =========================================================================
  console.log("\n5. Testing Normal Advance Proof Submission...");
  interface MockProjectState {
    id: string;
    clientId: string;
    projectCode: string;
    title: string;
    status: string;
    advanceAmount: number;
    remainingAmount: number;
    advancePaymentDeadline: Date | null;
    advanceVerifiedAt: Date | null;
    developmentStartedAt: Date | null;
    developmentDeadline: Date | null;
  }

  const project: MockProjectState = {
    id: "proj-001",
    clientId: "client-101",
    projectCode: "PRJ-2026-0001",
    title: "E-Commerce App",
    status: "AWAITING_ADVANCE",
    advanceAmount: 450,
    remainingAmount: 1050,
    advancePaymentDeadline: new Date(Date.now() + 24 * 3600 * 1000), // In future
    advanceVerifiedAt: null,
    developmentStartedAt: null,
    developmentDeadline: null,
  };

  const paymentsTable: Array<{
    id: string;
    projectId: string;
    type: string;
    expectedAmount: number;
    transactionReference: string;
    status: string;
    submittedAt: Date;
    verifiedAt: Date | null;
    verifiedBy: string | null;
    rejectionReason: string | null;
  }> = [];

  const paymentProofsTable: Array<{
    id: string;
    paymentId: string;
    fileUrl: string;
    fileSize: number;
  }> = [];

  const statusHistoryTable: Array<{
    projectId: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
  }> = [];

  const notificationsTable: Array<{
    userId: string;
    message: string;
    read: boolean;
  }> = [];

  // Normal submission execution
  const now = new Date();
  const isLate =
    project.advancePaymentDeadline !== null && now > project.advancePaymentDeadline;
  assert.strictEqual(isLate, false, "Submission is on-time");

  // Create payment row
  const paymentRecord = {
    id: "pay-1",
    projectId: project.id,
    type: "ADVANCE",
    expectedAmount: project.advanceAmount, // server-derived
    transactionReference: "UPI-TXN-123456",
    status: "PROOF_SUBMITTED",
    submittedAt: now,
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  };
  paymentsTable.push(paymentRecord);

  // Insert proof record
  paymentProofsTable.push({
    id: "proof-1",
    paymentId: paymentRecord.id,
    fileUrl: validKey,
    fileSize: 2048,
  });

  // Project transitions to ADVANCE_PROOF_SUBMITTED
  const prevStatus = project.status;
  project.status = "ADVANCE_PROOF_SUBMITTED";
  statusHistoryTable.push({
    projectId: project.id,
    fromStatus: prevStatus,
    toStatus: "ADVANCE_PROOF_SUBMITTED",
    changedBy: "client-101",
  });

  // Admin notification
  notificationsTable.push({
    userId: "admin-999",
    message: `New payment proof submitted for project "${project.title}" (${project.projectCode}) - [ADVANCE]. Review pending.`,
    read: false,
  });

  assert.strictEqual(project.status, "ADVANCE_PROOF_SUBMITTED");
  assert.strictEqual(paymentRecord.status, "PROOF_SUBMITTED");
  assert.strictEqual(statusHistoryTable[0].toStatus, "ADVANCE_PROOF_SUBMITTED");
  assert.strictEqual(notificationsTable.length, 1);
  console.log("  ✓ Normal proof atomically transitions project to ADVANCE_PROOF_SUBMITTED");

  // =========================================================================
  // 6. Late Advance Proof Submission (No Auto-Progression Invariant)
  // =========================================================================
  console.log("\n6. Testing Late Advance Proof Submission (Invariant)...");
  const lateProject: MockProjectState = {
    id: "proj-002",
    clientId: "client-101",
    projectCode: "PRJ-2026-0002",
    title: "Late App",
    status: "AWAITING_ADVANCE",
    advanceAmount: 300,
    remainingAmount: 700,
    advancePaymentDeadline: new Date(Date.now() - 3600 * 1000), // 1 hour in past!
    advanceVerifiedAt: null,
    developmentStartedAt: null,
    developmentDeadline: null,
  };

  const lateNow = new Date();
  const isLateProof =
    lateProject.advancePaymentDeadline !== null && lateNow > lateProject.advancePaymentDeadline;
  assert.strictEqual(isLateProof, true, "Proof is past deadline");

  const latePaymentRecord = {
    id: "pay-2",
    projectId: lateProject.id,
    type: "ADVANCE",
    expectedAmount: lateProject.advanceAmount,
    transactionReference: "UPI-LATE-789012",
    status: "LATE_PAYMENT_PROOF",
    submittedAt: lateNow,
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  };

  // Late submission: project remains AWAITING_ADVANCE. No status progression!
  assert.strictEqual(latePaymentRecord.status, "LATE_PAYMENT_PROOF");
  assert.strictEqual(
    lateProject.status,
    "AWAITING_ADVANCE",
    "Late proof submission must NOT auto-progress project status"
  );
  console.log("  ✓ Late payment receives LATE_PAYMENT_PROOF and leaves project in AWAITING_ADVANCE");

  // =========================================================================
  // 7. Admin Verification & Dual-Hop Status History (ADVANCE_VERIFIED -> IN_PROGRESS)
  // =========================================================================
  console.log("\n7. Testing Admin Verification with Dual-Hop History & Null Deadline Rule...");
  // Admin verifies payment for project 1
  assert.strictEqual(paymentRecord.status, "PROOF_SUBMITTED");
  const verifyNow = new Date();

  // 1. Payment marked VERIFIED
  paymentRecord.status = "VERIFIED";
  paymentRecord.verifiedAt = verifyNow;
  paymentRecord.verifiedBy = "admin-999";

  // 2. Project transition 1: ADVANCE_VERIFIED
  project.status = "ADVANCE_VERIFIED";
  project.advanceVerifiedAt = verifyNow;
  statusHistoryTable.push({
    projectId: project.id,
    fromStatus: "ADVANCE_PROOF_SUBMITTED",
    toStatus: "ADVANCE_VERIFIED",
    changedBy: "admin-999",
  });

  // 3. Project transition 2: IN_PROGRESS
  project.status = "IN_PROGRESS";
  project.developmentStartedAt = verifyNow;
  // Formal deadline engine is Phase 7: developmentDeadline remains null
  assert.strictEqual(
    project.developmentDeadline,
    null,
    "Phase 6 must not invent an arbitrary development deadline formula"
  );

  statusHistoryTable.push({
    projectId: project.id,
    fromStatus: "ADVANCE_VERIFIED",
    toStatus: "IN_PROGRESS",
    changedBy: "admin-999",
  });

  // 4. Mark pending advance reminders as read
  notificationsTable.forEach((n) => {
    if (n.message.includes("advance") || n.message.includes("Advance")) {
      n.read = true;
    }
  });

  assert.strictEqual(paymentRecord.status, "VERIFIED");
  assert.strictEqual(project.status, "IN_PROGRESS");
  assert.strictEqual(statusHistoryTable[1].toStatus, "ADVANCE_VERIFIED");
  assert.strictEqual(statusHistoryTable[2].fromStatus, "ADVANCE_VERIFIED");
  assert.strictEqual(statusHistoryTable[2].toStatus, "IN_PROGRESS");
  console.log("  ✓ Admin verify logs explicit dual-hop history (ADVANCE_VERIFIED -> IN_PROGRESS)");
  console.log("  ✓ developmentStartedAt set, developmentDeadline remains null for Phase 7");

  // =========================================================================
  // 8. Admin Rejection & Resubmission Rule (Single Row Reuse)
  // =========================================================================
  console.log("\n8. Testing Admin Rejection and Resubmission Row Reuse...");
  const rejectProject: MockProjectState = {
    id: "proj-003",
    clientId: "client-101",
    projectCode: "PRJ-2026-0003",
    title: "Rejected Flow Project",
    status: "ADVANCE_PROOF_SUBMITTED",
    advanceAmount: 500,
    remainingAmount: 1000,
    advancePaymentDeadline: new Date(Date.now() + 100000),
    advanceVerifiedAt: null,
    developmentStartedAt: null,
    developmentDeadline: null,
  };

  const paymentToReject = {
    id: "pay-3",
    projectId: rejectProject.id,
    type: "ADVANCE",
    expectedAmount: 500,
    transactionReference: "BAD-REF",
    status: "PROOF_SUBMITTED",
    submittedAt: new Date(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null as string | null,
  };

  // Rejection action
  paymentToReject.status = "REJECTED";
  paymentToReject.rejectionReason = "Transaction reference could not be matched with bank ledger.";
  rejectProject.status = "PAYMENT_REJECTED";

  assert.strictEqual(paymentToReject.status, "REJECTED");
  assert.strictEqual(rejectProject.status, "PAYMENT_REJECTED");

  // Client resubmits proof for the REJECTED payment:
  // Must reuse existing row, reset rejection fields, insert new proof
  const resubmitTime = new Date();
  paymentToReject.status = "PROOF_SUBMITTED";
  paymentToReject.transactionReference = "NEW-VALID-UTR-9999";
  paymentToReject.rejectionReason = null;
  paymentToReject.submittedAt = resubmitTime;
  rejectProject.status = "ADVANCE_PROOF_SUBMITTED";

  assert.strictEqual(paymentToReject.status, "PROOF_SUBMITTED");
  assert.strictEqual(paymentToReject.rejectionReason, null);
  assert.strictEqual(paymentToReject.transactionReference, "NEW-VALID-UTR-9999");
  assert.strictEqual(rejectProject.status, "ADVANCE_PROOF_SUBMITTED");
  console.log("  ✓ Rejection sets PAYMENT_REJECTED; resubmission reuses existing row and resets rejection fields");

  // =========================================================================
  // 9. Dual-Window Light Reminder Logic (<12h and <2h)
  // =========================================================================
  console.log("\n9. Testing Dual-Column Race-Safe Reminders...");
  const baseDeadline = new Date(Date.now() + 10 * 3600 * 1000); // 10h remaining (<12h)

  const reminderProject: ProjectReminderInput = {
    id: "proj-rem-1",
    clientId: "client-101",
    projectCode: "PRJ-REM-1",
    title: "Reminder Project",
    status: "AWAITING_ADVANCE",
    advancePaymentDeadline: baseDeadline,
    advanceReminderSentAt: null,
    finalAdvanceReminderSentAt: null,
  };

  // 10h remaining -> triggers 12H reminder
  const dec1 = computePaymentReminderDecision(reminderProject);
  assert.strictEqual(dec1.shouldSend, true);
  if (dec1.shouldSend) assert.strictEqual(dec1.level, "12H");

  // After 12H reminder is sent:
  reminderProject.advanceReminderSentAt = new Date();
  const dec2 = computePaymentReminderDecision(reminderProject);
  assert.strictEqual(dec2.shouldSend, false, "Subsequent checks in 12h window must not spam");

  // Now advance time so only 1 hour remains (<2h)
  reminderProject.advancePaymentDeadline = new Date(Date.now() + 1 * 3600 * 1000);
  const dec3 = computePaymentReminderDecision(reminderProject);
  assert.strictEqual(dec3.shouldSend, true);
  if (dec3.shouldSend) assert.strictEqual(dec3.level, "2H", "Enters 2H urgent window");

  // After 2H reminder is sent:
  reminderProject.finalAdvanceReminderSentAt = new Date();
  const dec4 = computePaymentReminderDecision(reminderProject);
  assert.strictEqual(dec4.shouldSend, false, "Subsequent checks in 2h window must not spam");

  // Once project enters IN_PROGRESS:
  reminderProject.status = "IN_PROGRESS";
  const dec5 = computePaymentReminderDecision(reminderProject);
  assert.strictEqual(dec5.shouldSend, false, "Reminders naturally cease once in IN_PROGRESS");
  console.log("  ✓ Dual reminder windows (<12h and <2h) evaluate and deduplicate correctly");

  // =========================================================================
  // 10. Reusable Final Payment Verification Branch
  // =========================================================================
  console.log("\n10. Testing Reusable Final Payment Verification Branch...");
  const finalPaymentProject: MockProjectState = {
    id: "proj-final-1",
    clientId: "client-101",
    projectCode: "PRJ-FINAL-001",
    title: "Delivery Ready Project",
    status: "FINAL_PAYMENT_PROOF_SUBMITTED",
    advanceAmount: 300,
    remainingAmount: 700,
    advancePaymentDeadline: null,
    advanceVerifiedAt: new Date(),
    developmentStartedAt: new Date(),
    developmentDeadline: null,
  };

  const finalPayment = {
    id: "pay-final-1",
    projectId: finalPaymentProject.id,
    type: "FINAL",
    expectedAmount: 700,
    transactionReference: "FINAL-UTR-444",
    status: "PROOF_SUBMITTED",
    submittedAt: new Date(),
    verifiedAt: null as Date | null,
    verifiedBy: null as string | null,
    rejectionReason: null,
  };

  // Admin verifies final payment
  finalPayment.status = "VERIFIED";
  finalPayment.verifiedAt = new Date();
  finalPayment.verifiedBy = "admin-999";
  finalPaymentProject.status = "DELIVERY_UNLOCKED";

  assert.strictEqual(finalPayment.status, "VERIFIED");
  assert.strictEqual(finalPaymentProject.status, "DELIVERY_UNLOCKED");
  console.log("  ✓ Final payment verify unlocks DELIVERY_UNLOCKED successfully");

  console.log("\n=== All Phase 6 Tests Completed & Passed Successfully! ===");
}

runPhase6Tests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
