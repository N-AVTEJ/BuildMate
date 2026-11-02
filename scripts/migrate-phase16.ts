import { client } from "../src/db/index";

async function main() {
  console.log("Applying Phase 16 Database Scalability Indexes...");
  await client.unsafe(`
    -- Phase 16 Scalability & Foreign Key Indexes
    CREATE INDEX IF NOT EXISTS "projects_client_id_idx" ON "projects" ("client_id");
    CREATE INDEX IF NOT EXISTS "projects_builder_id_idx" ON "projects" ("builder_id");
    CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");
    CREATE INDEX IF NOT EXISTS "projects_project_code_idx" ON "projects" ("project_code");

    CREATE INDEX IF NOT EXISTS "payments_project_id_idx" ON "payments" ("project_id");
    CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" ("status");
    CREATE INDEX IF NOT EXISTS "payments_razorpay_order_id_idx" ON "payments" ("razorpay_order_id");

    CREATE INDEX IF NOT EXISTS "quotations_project_id_idx" ON "quotations" ("project_id");
    CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations" ("status");

    CREATE INDEX IF NOT EXISTS "messages_project_id_idx" ON "messages" ("project_id");
    CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages" ("sender_id");

    CREATE INDEX IF NOT EXISTS "disputes_project_id_idx" ON "disputes" ("project_id");
    CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes" ("status");
    CREATE INDEX IF NOT EXISTS "disputes_raised_by_idx" ON "disputes" ("raised_by");

    CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
    CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" ("read");
    CREATE INDEX IF NOT EXISTS "notifications_user_id_read_idx" ON "notifications" ("user_id", "read");

    CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
    CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");

    CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles" ("user_id");
    CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles" ("role");

    CREATE INDEX IF NOT EXISTS "project_requirements_project_id_idx" ON "project_requirements" ("project_id");
    CREATE INDEX IF NOT EXISTS "payment_proofs_payment_id_idx" ON "payment_proofs" ("payment_id");
    CREATE INDEX IF NOT EXISTS "deliverables_project_id_idx" ON "deliverables" ("project_id");
    CREATE INDEX IF NOT EXISTS "project_status_history_project_id_idx" ON "project_status_history" ("project_id");
    CREATE INDEX IF NOT EXISTS "change_requests_project_id_idx" ON "change_requests" ("project_id");
    CREATE INDEX IF NOT EXISTS "change_requests_status_idx" ON "change_requests" ("status");
    CREATE INDEX IF NOT EXISTS "progress_updates_project_id_idx" ON "progress_updates" ("project_id");
    CREATE INDEX IF NOT EXISTS "progress_updates_builder_id_idx" ON "progress_updates" ("builder_id");
    CREATE INDEX IF NOT EXISTS "scope_versions_project_id_idx" ON "scope_versions" ("project_id");

    CREATE INDEX IF NOT EXISTS "builder_applications_status_idx" ON "builder_applications" ("status");
    CREATE INDEX IF NOT EXISTS "builder_applications_email_idx" ON "builder_applications" ("email");
    CREATE INDEX IF NOT EXISTS "builder_applications_created_at_idx" ON "builder_applications" ("created_at");
  `);
  console.log("✓ Phase 16 indexes successfully applied.");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
