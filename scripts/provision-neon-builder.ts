import postgres from "postgres";
import { hashPassword } from "../src/lib/auth/password";

const neonHost = "ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech";
const neonUser = "neondb_owner";
const neonPass = "npg_lpy7de4HEAOF";
const neonDb = "neondb";

const BUILDER_EMAIL = "buildrazor@gmail.com";
const BUILDER_PASSWORD_PLAINTEXT = "razor123";
const BUILDER_NAME = "Razor Builder";

async function main() {
  console.log("[Neon Provision] Resolving Neon host with fallback DNS (8.8.8.8)...");
  const resolver = new (await import("dns")).promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const addresses = await resolver.resolve4(neonHost);
  console.log("[Neon Provision] Resolved Neon IP:", addresses[0]);

  const sql = postgres({
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

  try {
    console.log(`[Neon Provision] Hashing password for ${BUILDER_EMAIL}...`);
    const passwordHash = await hashPassword(BUILDER_PASSWORD_PLAINTEXT);

    console.log(`[Neon Provision] Checking if ${BUILDER_EMAIL} exists on Neon...`);
    const [existingUser] = await sql`
      SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(${BUILDER_EMAIL})
    `;

    let userId: string;

    if (existingUser) {
      console.log(`[Neon Provision] User found on Neon with ID: ${existingUser.id}. Updating password and details...`);
      userId = existingUser.id;
      await sql`
        UPDATE users
        SET name = ${BUILDER_NAME},
            password_hash = ${passwordHash},
            email_verified = true,
            updated_at = now()
        WHERE id = ${userId}
      `;
    } else {
      console.log(`[Neon Provision] Creating new user for ${BUILDER_EMAIL} on Neon...`);
      const [newUser] = await sql`
        INSERT INTO users (id, name, email, password_hash, email_verified, created_at, updated_at)
        VALUES (gen_random_uuid(), ${BUILDER_NAME}, ${BUILDER_EMAIL}, ${passwordHash}, true, now(), now())
        RETURNING id
      `;
      userId = newUser.id;
      console.log(`[Neon Provision] User created with ID: ${userId}`);
    }

    // Ensure BUILDER role exists in user_roles
    const [existingRole] = await sql`
      SELECT id, role FROM user_roles WHERE user_id = ${userId} AND role = 'BUILDER'
    `;

    if (!existingRole) {
      await sql`
        INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
        VALUES (gen_random_uuid(), ${userId}, 'BUILDER', now(), now())
      `;
      console.log(`[Neon Provision] BUILDER role successfully assigned to ${BUILDER_EMAIL} on Neon!`);
    } else {
      console.log(`[Neon Provision] User already holds BUILDER role on Neon.`);
    }

    // Verify current roles on Neon
    const roles = await sql`
      SELECT role FROM user_roles WHERE user_id = ${userId}
    `;
    console.log(`[Neon Provision] Verified roles on Neon for ${BUILDER_EMAIL}:`, roles.map(r => r.role));
    console.log("[Neon Provision] Neon cloud database provisioning completed successfully!");
  } catch (err) {
    console.error("[Neon Provision] Error during Neon provisioning:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
