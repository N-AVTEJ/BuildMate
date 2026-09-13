import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ==========================================
// ENUMS
// ==========================================

export const roleEnum = pgEnum("role", ["CLIENT", "BUILDER", "ADMIN"]);

export const projectStatusEnum = pgEnum("project_status", [
  "DRAFT",
  "SUBMITTED",
  "AVAILABLE",
  "QUOTATION_SENT",
  "CLIENT_ACCEPTED",
  "AWAITING_ADVANCE",
  "ADVANCE_PROOF_SUBMITTED",
  "ADVANCE_VERIFICATION",
  "ADVANCE_VERIFIED",
  "IN_PROGRESS",
  "SUBMITTED_FOR_DELIVERY",
  "FINAL_PAYMENT_PENDING",
  "FINAL_PAYMENT_PROOF_SUBMITTED",
  "FINAL_PAYMENT_VERIFICATION",
  "DELIVERY_UNLOCKED",
  "CLIENT_REVIEW",
  "COMPLETED",
  "REJECTED",
  "EXPIRED_NO_BUILDER",
  "ADVANCE_PAYMENT_EXPIRED",
  "PAYMENT_REJECTED",
  "OVERDUE",
  "DISPUTE_OPEN",
  "CANCELLED_BEFORE_DEV",
]);

export const quotationStatusEnum = pgEnum("quotation_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "ADVANCE",
  "FINAL",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "AWAITING",
  "PROOF_SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "LATE_PAYMENT_PROOF",
]);

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

export const disputeReasonEnum = pgEnum("dispute_reason", [
  "MISSING_FEATURE",
  "DOESNT_MATCH_REQUIREMENTS",
  "INCORRECT_PROJECT",
  "TECHNICAL_ISSUE",
  "PAYMENT_ISSUE",
  "BUILDER_UNRESPONSIVE",
  "CLIENT_NOT_RESPONDING",
  "REQUIREMENT_CHANGED",
  "OTHER",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "RESOLVED",
  "CANCELLED",
]);

// ==========================================
// TABLES
// ==========================================

// 1. users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. user_roles (join table for multi-role support)
export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. projects
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectCode: varchar("project_code", { length: 64 }).unique().notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  builderId: uuid("builder_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  techStack: text("tech_stack").notNull(),
  budgetMin: integer("budget_min").notNull(),
  budgetMax: integer("budget_max").notNull(),
  totalPrice: integer("total_price"),
  advanceAmount: integer("advance_amount"),
  remainingAmount: integer("remaining_amount"),
  status: projectStatusEnum("status").default("DRAFT").notNull(),
  integrityAck: boolean("integrity_ack").default(false).notNull(),
  integrityAckAt: timestamp("integrity_ack_at", { withTimezone: true }),
  acceptanceDeadline: timestamp("acceptance_deadline", { withTimezone: true }),
  builderAcceptedAt: timestamp("builder_accepted_at", { withTimezone: true }),
  advancePaymentDeadline: timestamp("advance_payment_deadline", {
    withTimezone: true,
  }),
  advanceVerifiedAt: timestamp("advance_verified_at", { withTimezone: true }),
  developmentStartedAt: timestamp("development_started_at", {
    withTimezone: true,
  }),
  developmentDeadline: timestamp("development_deadline", {
    withTimezone: true,
  }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4. project_requirements
export const projectRequirements = pgTable("project_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. quotations
export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  totalPrice: integer("total_price").notNull(),
  advanceAmount: integer("advance_amount").notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  status: quotationStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 6. scope_versions
export const scopeVersions = pgTable("scope_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  requirementsSnapshot: jsonb("requirements_snapshot").notNull(),
  quotationSnapshot: jsonb("quotation_snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 7. payments
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: paymentTypeEnum("type").notNull(),
  expectedAmount: integer("expected_amount").notNull(),
  submittedAmount: integer("submitted_amount"),
  transactionReference: text("transaction_reference"),
  status: paymentStatusEnum("status").default("AWAITING").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by").references(() => users.id, {
    onDelete: "restrict",
  }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 8. payment_proofs
export const paymentProofs = pgTable("payment_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 9. deliverables
export const deliverables = pgTable("deliverables", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  githubUrl: text("github_url").notNull(),
  repoType: text("repo_type").notNull(),
  branch: text("branch").notNull(),
  commitRef: text("commit_ref").notNull(),
  description: text("description").notNull(),
  implementedFeatures: text("implemented_features").notNull(),
  documentationUrl: text("documentation_url"),
  pptUrl: text("ppt_url"),
  screenshots: jsonb("screenshots").$type<string[]>(),
  demoUrl: text("demo_url"),
  deploymentUrl: text("deployment_url"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 10. project_status_history (audit log)
export const projectStatusHistory = pgTable("project_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fromStatus: projectStatusEnum("from_status"),
  toStatus: projectStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 11. change_requests
export const changeRequests = pgTable("change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  additionalCost: integer("additional_cost").notNull(),
  additionalTimeDays: integer("additional_time_days").notNull(),
  status: changeRequestStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 12. notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 13. disputes
export const disputes = pgTable("disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  raisedBy: uuid("raised_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  reason: disputeReasonEnum("reason").notNull(),
  description: text("description").notNull(),
  status: disputeStatusEnum("status").default("OPEN").notNull(),
  resolvedBy: uuid("resolved_by").references(() => users.id, {
    onDelete: "restrict",
  }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 14. messages
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
