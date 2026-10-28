import { client } from "../src/db/index";

async function main() {
  console.log("Applying Phase 14 DDL migration...");
  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE builder_application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS builder_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email VARCHAR(255) NOT NULL,
      resume_url TEXT NOT NULL,
      github_url TEXT,
      message TEXT,
      status builder_application_status NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Phase 14 builder_applications table and enum successfully created.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
