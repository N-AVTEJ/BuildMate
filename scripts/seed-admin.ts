import { eq, and } from "drizzle-orm";
import { db, client } from "../src/db";
import { users, userRoles } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const ADMIN_EMAIL = "madipadiganavtej@gmail.com";
const ADMIN_PASSWORD_PLAINTEXT = "Navtej2006";
const ADMIN_NAME = "Navtej Madipadi";

async function seedAdmin() {
  console.log(`[Seed Admin] Starting idempotent seed for: ${ADMIN_EMAIL}...`);

  // 1. Hash password with Argon2id
  const passwordHash = await hashPassword(ADMIN_PASSWORD_PLAINTEXT);

  // 2. Find or create user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  let userId: string;

  if (existingUser) {
    console.log(`[Seed Admin] User ${ADMIN_EMAIL} already exists (ID: ${existingUser.id}). Updating password hash and email verification...`);
    userId = existingUser.id;

    await db
      .update(users)
      .set({
        name: existingUser.name || ADMIN_NAME,
        passwordHash,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));
  } else {
    console.log(`[Seed Admin] User ${ADMIN_EMAIL} does not exist. Creating user...`);
    const [newUser] = await db
      .insert(users)
      .values({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });

    userId = newUser.id;
    console.log(`[Seed Admin] Created user with ID: ${userId}`);
  }

  // 3. Ensure user has both ADMIN and BUILDER roles idempotently
  const targetRoles = ["ADMIN", "BUILDER"] as const;

  for (const role of targetRoles) {
    const [existingRole] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
      .limit(1);

    if (existingRole) {
      console.log(`[Seed Admin] Role '${role}' already provisioned for user.`);
    } else {
      await db.insert(userRoles).values({
        userId,
        role,
      });
      console.log(`[Seed Admin] Role '${role}' successfully inserted for user.`);
    }
  }

  // 4. Verify provisioned state
  const assignedRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  console.log(`[Seed Admin] Finished! User ${ADMIN_EMAIL} current roles:`, assignedRoles.map((r) => r.role));
  console.log(`[Seed Admin] IMPORTANT SECURITY ADVISORY: Password was shared in plaintext during planning. Please change it via the normal change-password flow after initial sign-in.`);

  await client.end();
  process.exit(0);
}

seedAdmin().catch(async (error) => {
  console.error("[Seed Admin] Fatal error during seed:", error);
  await client.end();
  process.exit(1);
});
