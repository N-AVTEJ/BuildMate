import { eq, and, sql } from "drizzle-orm";
import { db, client } from "../src/db";
import { users, userRoles } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const BUILDER_EMAIL = "buildrazor@gmail.com";
const BUILDER_PASSWORD_PLAINTEXT = "razor123";
const BUILDER_NAME = "Razor Builder";

async function provisionBuilder() {
  console.log(`[Provision Builder] Starting idempotent provision for: ${BUILDER_EMAIL}...`);

  // 1. Hash password with Argon2id
  const passwordHash = await hashPassword(BUILDER_PASSWORD_PLAINTEXT);

  // 2. Find or create user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${BUILDER_EMAIL})`)
    .limit(1);

  let userId: string;

  if (existingUser) {
    console.log(`[Provision Builder] User ${BUILDER_EMAIL} already exists (ID: ${existingUser.id}). Updating password hash and email verification...`);
    userId = existingUser.id;

    await db
      .update(users)
      .set({
        name: existingUser.name || BUILDER_NAME,
        passwordHash,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));
  } else {
    console.log(`[Provision Builder] User ${BUILDER_EMAIL} does not exist. Creating user...`);
    const [newUser] = await db
      .insert(users)
      .values({
        name: BUILDER_NAME,
        email: BUILDER_EMAIL,
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });

    userId = newUser.id;
    console.log(`[Provision Builder] Created user with ID: ${userId}`);
  }

  // 3. Ensure user has BUILDER role idempotently
  const [existingRole] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "BUILDER")))
    .limit(1);

  if (existingRole) {
    console.log(`[Provision Builder] Role 'BUILDER' already provisioned for user.`);
  } else {
    await db.insert(userRoles).values({
      userId,
      role: "BUILDER",
    });
    console.log(`[Provision Builder] Role 'BUILDER' successfully inserted for user.`);
  }

  // 4. Verify provisioned state
  const assignedRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  console.log(`[Provision Builder] Finished! User ${BUILDER_EMAIL} current roles:`, assignedRoles.map((r) => r.role));

  await client.end();
  process.exit(0);
}

provisionBuilder().catch(async (error) => {
  console.error("[Provision Builder] Fatal error during provisioning:", error);
  await client.end();
  process.exit(1);
});
