import postgres from "postgres";
import fs from "fs";
import path from "path";

async function applyToDb(name: string, connectionConfig: any) {
  console.log(`\n========================================`);
  console.log(`Applying Phase 16 Indexes & Migration to ${name}...`);
  console.log(`========================================`);

  const sql = postgres(connectionConfig);

  try {
    // 1. Ensure enums exist
    console.log("Checking enums...");
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE builder_application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'ORDER_CREATED' BEFORE 'PROOF_SUBMITTED';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Ensure builder_applications table exists
    console.log("Ensuring builder_applications table exists...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS builder_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email varchar(255) NOT NULL,
        resume_url text NOT NULL,
        github_url text,
        message text,
        status builder_application_status DEFAULT 'PENDING' NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    // 3. Ensure columns exist if not already present
    console.log("Ensuring nullable/new columns exist...");
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE project_status_history ALTER COLUMN changed_by DROP NOT NULL;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id varchar(255);
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id varchar(255);
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_signature varchar(512);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE(google_id);
      EXCEPTION WHEN others THEN null;
      END $$;
    `);

    // 4. Apply all required indexes with IF NOT EXISTS
    console.log("Creating required Phase 16 indexes...");
    const indexStatements = [
      // Required Task 2 Indexes
      `CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id);`,
      `CREATE INDEX IF NOT EXISTS projects_builder_id_idx ON projects (builder_id);`,
      `CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);`,
      `CREATE INDEX IF NOT EXISTS projects_project_code_idx ON projects (project_code);`,
      `CREATE INDEX IF NOT EXISTS payments_project_id_idx ON payments (project_id);`,
      `CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);`,
      `CREATE INDEX IF NOT EXISTS quotations_project_id_idx ON quotations (project_id);`,
      `CREATE INDEX IF NOT EXISTS messages_project_id_idx ON messages (project_id);`,
      `CREATE INDEX IF NOT EXISTS disputes_project_id_idx ON disputes (project_id);`,
      `CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes (status);`,
      `CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);`,
      `CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (read);`,
      `CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON notifications (user_id, read);`,
      `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);`,
      `CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);`,
      `CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role);`,
      // Additional Hot-Path Indexes
      `CREATE INDEX IF NOT EXISTS builder_applications_status_idx ON builder_applications (status);`,
      `CREATE INDEX IF NOT EXISTS builder_applications_email_idx ON builder_applications (email);`,
      `CREATE INDEX IF NOT EXISTS builder_applications_created_at_idx ON builder_applications (created_at);`,
      `CREATE INDEX IF NOT EXISTS payments_razorpay_order_id_idx ON payments (razorpay_order_id);`,
      `CREATE INDEX IF NOT EXISTS change_requests_project_id_idx ON change_requests (project_id);`,
      `CREATE INDEX IF NOT EXISTS change_requests_status_idx ON change_requests (status);`,
      `CREATE INDEX IF NOT EXISTS deliverables_project_id_idx ON deliverables (project_id);`,
      `CREATE INDEX IF NOT EXISTS disputes_raised_by_idx ON disputes (raised_by);`,
      `CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id);`,
      `CREATE INDEX IF NOT EXISTS payment_proofs_payment_id_idx ON payment_proofs (payment_id);`,
      `CREATE INDEX IF NOT EXISTS progress_updates_project_id_idx ON progress_updates (project_id);`,
      `CREATE INDEX IF NOT EXISTS progress_updates_builder_id_idx ON progress_updates (builder_id);`,
      `CREATE INDEX IF NOT EXISTS project_requirements_project_id_idx ON project_requirements (project_id);`,
      `CREATE INDEX IF NOT EXISTS project_status_history_project_id_idx ON project_status_history (project_id);`,
      `CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations (status);`,
      `CREATE INDEX IF NOT EXISTS scope_versions_project_id_idx ON scope_versions (project_id);`,
      `CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);`,
    ];

    for (const stmt of indexStatements) {
      await sql.unsafe(stmt);
    }
    console.log(`✓ All ${indexStatements.length} indexes applied successfully to ${name}!`);

    // Verify indexes
    const indexes = await sql`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE '%_idx'
      ORDER BY tablename, indexname;
    `;
    console.log(`Verified ${indexes.length} custom indexes in ${name}:`);
    indexes.forEach((idx) => console.log(`  - ${idx.tablename}: ${idx.indexname}`));

  } catch (err) {
    console.error(`Error applying migration to ${name}:`, err);
    throw err;
  } finally {
    await sql.end();
  }
}

async function main() {
  // 1. Local Postgres
  await applyToDb("Local Postgres", "postgresql://postgres@127.0.0.1:5433/buildmate");

  // 2. Live Neon DB
  const neonHost = "ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech";
  const neonUser = "neondb_owner";
  const neonPass = "npg_lpy7de4HEAOF";
  const neonDb = "neondb";

  try {
    const resolver = new (await import("dns")).promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const addresses = await resolver.resolve4(neonHost);
    console.log(`Resolved Neon host to IP ${addresses[0]}`);

    await applyToDb("Live Neon PostgreSQL", {
      host: addresses[0],
      port: 5432,
      database: neonDb,
      username: neonUser,
      password: neonPass,
      ssl: {
        servername: neonHost,
        rejectUnauthorized: false,
      },
      connect_timeout: 15,
    });
  } catch (neonErr) {
    console.error("Failed to connect to Neon DB:", neonErr);
  }
}

main().catch(console.error);
