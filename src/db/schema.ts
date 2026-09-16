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
  unique,
  pgSequence,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// SEQUENCES
// ==========================================

export const projectCodeSeq = pgSequence("project_code_seq", {
  startWith: 1,
  increment: 1,
});

// ==========================================
// ALL 8 POSTGRESQL ENUMS
// ==========================================

export const roleEnum = pgEnum("role", ["CLIENT", "BUILDER", "ADMIN"]);

export const projectStatusEnum = pgEnum("project_status", [
  "DRAFT",
  "SUBMITTED",
  "AVAILABLE",
  "ACCEPTED_PENDING_QUOTE",
  "QUOTATION_SENT",
  // RESERVED / DEPRECATED: CLIENT_ACCEPTED is intentionally unused.
  // Phase 5 transitions directly from QUOTATION_SENT -> AWAITING_ADVANCE (single hop).
  // This value is preserved only because PostgreSQL enums cannot drop values without a
  // table-rewrite migration. Do NOT write this value from application code.
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
// ALL 14 TABLES
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

// 2. user_roles
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("user_roles_user_id_role_unique").on(table.userId, table.role),
  ]
);

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
  advanceReminderSentAt: timestamp("advance_reminder_sent_at", {
    withTimezone: true,
  }),
  finalAdvanceReminderSentAt: timestamp("final_advance_reminder_sent_at", {
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
export const scopeVersions = pgTable(
  "scope_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    requirementsSnapshot: jsonb("requirements_snapshot").notNull(),
    quotationSnapshot: jsonb("quotation_snapshot").notNull(),
    projectSnapshot: jsonb("project_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("scope_versions_project_id_version_unique").on(
      table.projectId,
      table.versionNumber
    ),
  ]
);

// 7. payments
export const payments = pgTable(
  "payments",
  {
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
  },
  (table) => [
    unique("payments_project_id_type_unique").on(table.projectId, table.type),
  ]
);

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

// 10. project_status_history
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

// 15. sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 16. email_verification_tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 17. project_builder_rejections
export const projectBuilderRejections = pgTable(
  "project_builder_rejections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    builderId: uuid("builder_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_builder_rejections_project_id_idx").on(table.projectId),
    index("project_builder_rejections_builder_id_idx").on(table.builderId),
  ]
);

// ==========================================
// DRIZZLE RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  clientProjects: many(projects, { relationName: "client" }),
  builderProjects: many(projects, { relationName: "builder" }),
  notifications: many(notifications),
  messages: many(messages),
  verifiedPayments: many(payments),
  statusChanges: many(projectStatusHistory),
  disputesRaised: many(disputes, { relationName: "raised_by" }),
  disputesResolved: many(disputes, { relationName: "resolved_by" }),
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  builderRejections: many(projectBuilderRejections),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  })
);

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(users, {
    fields: [projects.clientId],
    references: [users.id],
    relationName: "client",
  }),
  builder: one(users, {
    fields: [projects.builderId],
    references: [users.id],
    relationName: "builder",
  }),
  requirements: many(projectRequirements),
  quotations: many(quotations),
  scopeVersions: many(scopeVersions),
  payments: many(payments),
  deliverables: many(deliverables),
  statusHistory: many(projectStatusHistory),
  changeRequests: many(changeRequests),
  disputes: many(disputes),
  messages: many(messages),
  builderRejections: many(projectBuilderRejections),
}));

export const projectRequirementsRelations = relations(
  projectRequirements,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectRequirements.projectId],
      references: [projects.id],
    }),
  })
);

export const quotationsRelations = relations(quotations, ({ one }) => ({
  project: one(projects, {
    fields: [quotations.projectId],
    references: [projects.id],
  }),
}));

export const scopeVersionsRelations = relations(scopeVersions, ({ one }) => ({
  project: one(projects, {
    fields: [scopeVersions.projectId],
    references: [projects.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  project: one(projects, {
    fields: [payments.projectId],
    references: [projects.id],
  }),
  verifier: one(users, {
    fields: [payments.verifiedBy],
    references: [users.id],
  }),
  proofs: many(paymentProofs),
}));

export const paymentProofsRelations = relations(paymentProofs, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentProofs.paymentId],
    references: [payments.id],
  }),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  project: one(projects, {
    fields: [deliverables.projectId],
    references: [projects.id],
  }),
}));

export const projectStatusHistoryRelations = relations(
  projectStatusHistory,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectStatusHistory.projectId],
      references: [projects.id],
    }),
    changedByUser: one(users, {
      fields: [projectStatusHistory.changedBy],
      references: [users.id],
    }),
  })
);

export const changeRequestsRelations = relations(changeRequests, ({ one }) => ({
  project: one(projects, {
    fields: [changeRequests.projectId],
    references: [projects.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  project: one(projects, {
    fields: [disputes.projectId],
    references: [projects.id],
  }),
  raisedByUser: one(users, {
    fields: [disputes.raisedBy],
    references: [users.id],
    relationName: "raised_by",
  }),
  resolvedByUser: one(users, {
    fields: [disputes.resolvedBy],
    references: [users.id],
    relationName: "resolved_by",
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  project: one(projects, {
    fields: [messages.projectId],
    references: [projects.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const projectBuilderRejectionsRelations = relations(
  projectBuilderRejections,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectBuilderRejections.projectId],
      references: [projects.id],
    }),
    builder: one(users, {
      fields: [projectBuilderRejections.builderId],
      references: [users.id],
    }),
  })
);

