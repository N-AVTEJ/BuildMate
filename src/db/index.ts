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

// Automatically enforce SSL for cloud-hosted databases (Neon, Supabase, Render, Aiven, AWS RDS)
const isCloudDb =
  connectionString.includes(".neon.") ||
  connectionString.includes(".supabase.") ||
  connectionString.includes(".render.") ||
  connectionString.includes(".aivencloud.") ||
  (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1") && connectionString.length > 0);

export const client = postgres(connectionString || "postgresql://postgres@127.0.0.1:5433/buildmate", {
  prepare: false,
  ssl: isCloudDb ? "require" : false,
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
