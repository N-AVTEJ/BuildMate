import { eq, and } from "drizzle-orm";
import { db, client } from "../src/db";
import { users, userRoles } from "../src/db/schema";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function provisionBuilder() {
  const args = process.argv.slice(2);
  const targetEmail = args[0]?.trim().toLowerCase();

  if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
    console.error("Usage: npx tsx scripts/provision-builder.ts <email>");
    console.error("Example: npx tsx scripts/provision-builder.ts alex@example.com");
    await client.end();
    process.exit(1);
  }

  console.log(`[Provision Builder] Starting manual provisioning for: ${targetEmail}...`);

  // 1. Find existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, targetEmail))
    .limit(1);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`[Provision Builder] Found existing user account (ID: ${userId}).`);

    // Ensure email is marked verified
    if (!existingUser.emailVerified) {
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));
      console.log(`[Provision Builder] Marked email as verified.`);
    }
  } else {
    console.log(`[Provision Builder] No account found with email '${targetEmail}'. Creating placeholder builder account...`);
    const [newUser] = await db
      .insert(users)
      .values({
        name: targetEmail.split("@")[0],
        email: targetEmail,
        emailVerified: true,
      })
      .returning({ id: users.id });

    userId = newUser.id;
    console.log(`[Provision Builder] Created new user (ID: ${userId}). User can complete password setup or sign in via Google.`);
  }

  // 2. Check if BUILDER role already exists
  const [existingBuilderRole] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "BUILDER")))
    .limit(1);

  if (existingBuilderRole) {
    console.log(`[Provision Builder] User ${targetEmail} ALREADY holds BUILDER role.`);
  } else {
    await db.insert(userRoles).values({
      userId,
      role: "BUILDER",
    });
    console.log(`[Provision Builder] BUILDER role successfully provisioned for ${targetEmail}.`);
  }

  // 3. Confirm all active roles for the user
  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  console.log(`[Provision Builder] Successfully completed! User ${targetEmail} active roles:`, roles.map((r) => r.role));

  await client.end();
  process.exit(0);
}

provisionBuilder().catch(async (error) => {
  console.error("[Provision Builder] Fatal error during provisioning:", error);
  await client.end();
  process.exit(1);
});
