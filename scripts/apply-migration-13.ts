import postgres from "postgres";

async function applyToDb(name: string, connectionConfig: any) {
  console.log(`\n========================================`);
  console.log(`Applying Push Notifications Migration (0013) to ${name}...`);
  console.log(`========================================`);

  const sql = postgres(connectionConfig);

  try {
    // 1. Ensure notification_prefs table exists
    console.log("Ensuring notification_prefs table exists...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "notification_prefs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "push_enabled" boolean DEFAULT true NOT NULL,
        "quotation_updates" boolean DEFAULT true NOT NULL,
        "payment_updates" boolean DEFAULT true NOT NULL,
        "delivery_updates" boolean DEFAULT true NOT NULL,
        "deadline_alerts" boolean DEFAULT true NOT NULL,
        "change_request_updates" boolean DEFAULT true NOT NULL,
        "dispute_updates" boolean DEFAULT true NOT NULL,
        "snoozed_until" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "notification_prefs_user_id_unique" UNIQUE("user_id")
      );
    `);

    // 2. Ensure push_subscriptions table exists
    console.log("Ensuring push_subscriptions table exists...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "last_used_at" timestamp with time zone,
        "revoked_at" timestamp with time zone,
        CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
      );
    `);

    // 3. Update notifications table columns
    console.log("Adding columns to notifications table if not present...");
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "notifications" ALTER COLUMN "message" SET DEFAULT '';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" varchar(64) DEFAULT 'SYSTEM' NOT NULL;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text DEFAULT 'Notification' NOT NULL;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" text DEFAULT '' NOT NULL;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "url" text;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "project_id" uuid;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);

    // 4. Add FKs if not present
    console.log("Ensuring foreign keys exist...");
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "notification_prefs"
          ADD CONSTRAINT "notification_prefs_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "push_subscriptions"
          ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "notifications"
          ADD CONSTRAINT "notifications_project_id_projects_id_fk"
          FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 5. Create indexes
    console.log("Ensuring indexes exist...");
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "notification_prefs_user_id_idx" ON "notification_prefs" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
      CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_revoked_at_idx" ON "push_subscriptions" USING btree ("user_id", "revoked_at");
      CREATE INDEX IF NOT EXISTS "notifications_project_id_idx" ON "notifications" USING btree ("project_id");
      CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_created_at_idx" ON "notifications" USING btree ("user_id", "read_at", "created_at" DESC);
    `);

    console.log(`✓ Migration 0013 successfully applied to ${name}!`);
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
