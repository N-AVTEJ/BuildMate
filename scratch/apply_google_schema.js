const postgres = require('postgres');

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL || "postgresql://postgres@127.0.0.1:5433/buildmate");
  try {
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
    console.log("Altered password_hash to allow nulls.");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar(255)`;
    console.log("Added google_id column.");

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users (google_id)`;
    console.log("Added users_google_id_unique index.");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`;
    console.log("Added avatar_url column.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await sql.end();
  }
}

migrate();
