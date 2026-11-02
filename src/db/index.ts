import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
    ? "postgresql://postgres@127.0.0.1:5433/buildmate"
    : "");

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  console.error(
    "❌ [DATABASE CONFIG ERROR] DATABASE_URL is not set in environment variables! " +
    "When deploying on Vercel, you must set DATABASE_URL in Vercel Project Settings > Environment Variables."
  );
}

// Pooling audit & verification for serverless Postgres (Neon / Supabase)
if (connectionString) {
  if (connectionString.includes(".neon.") && !connectionString.includes("-pooler")) {
    console.warn(
      "⚠️ [DATABASE POOLING WARNING] Neon connection string is connecting to a DIRECT host instead of the POOLED host (-pooler).\n" +
      "For serverless deployments on Vercel, please use Neon's pooled connection string:\n" +
      "e.g. ep-xxxx-pooler.c-7.aws.neon.tech to avoid hitting connection exhaustion under concurrent load."
    );
  } else if (connectionString.includes(".supabase.") && !connectionString.includes(":6543")) {
    console.warn(
      "⚠️ [DATABASE POOLING WARNING] Supabase connection string is not using the transaction pooler port (6543).\n" +
      "For serverless deployments on Vercel, use port 6543 (PgBouncer transaction pooler) rather than direct 5432."
    );
  }
}

// Automatically enforce SSL for cloud-hosted databases (Neon, Supabase, Render, Aiven, AWS RDS)
const isCloudDb =
  connectionString.includes(".neon.") ||
  connectionString.includes(".supabase.") ||
  connectionString.includes(".render.") ||
  connectionString.includes(".aivencloud.") ||
  (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1") && connectionString.length > 0);

// Serverless Connection Pooling Strategy (Phase 16 Hardening):
// On Vercel / serverless runtimes, each lambda invocation must maintain a minimal pool (max: 1)
// allowing the remote PgBouncer / Neon pooler to absorb concurrent spikes without exhausting database slots.
const serverlessMaxConnections = process.env.DB_MAX_CONNECTIONS
  ? parseInt(process.env.DB_MAX_CONNECTIONS, 10)
  : (process.env.NODE_ENV === "production" ? 1 : 5);

// Maintain singleton client across serverless warm-starts and Next.js HMR reloads
const globalForDb = globalThis as unknown as {
  postgresClient: postgres.Sql | undefined;
};

export const client =
  globalForDb.postgresClient ??
  postgres(connectionString || "postgresql://postgres@127.0.0.1:5433/buildmate", {
    prepare: false, // Required for PgBouncer / Neon transaction pooling mode
    ssl: isCloudDb ? "require" : false,
    max: serverlessMaxConnections,
    idle_timeout: 15, // Close idle connections after 15s to free slots
    connect_timeout: 10, // Fail fast after 10s if database or pooler is unreachable
    max_lifetime: 60 * 30, // Max connection lifetime 30 minutes
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
