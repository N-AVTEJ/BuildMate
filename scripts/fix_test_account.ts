// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";
import { users, userRoles } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

async function fixNavtej() {
  const email = "madipadiganavtej@gmail.com";
  const newHash = await hashPassword("Navtej2006");
  
  // 1. Update password hash and emailVerified to true
  await db.update(users)
    .set({
      passwordHash: newHash,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.email, email));

  // 2. Fetch user id
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  // 3. Ensure CLIENT role exists
  const existingClientRole = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, user.id), eq(userRoles.role, "CLIENT")),
  });

  if (!existingClientRole) {
    await db.insert(userRoles).values({
      userId: user.id,
      role: "CLIENT",
    });
    console.log("Added CLIENT role to", email);
  } else {
    console.log("CLIENT role already present for", email);
  }

  // 4. Ensure all existing users have emailVerified = true for V1 policy
  await db.update(users).set({ emailVerified: true });

  // 5. Test verifyPassword
  const verified = await verifyPassword(newHash, "Navtej2006");
  console.log("Navtej2006 verified with new hash:", verified);

  const roles = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, user.id),
  });
  console.log("Current roles for user:", roles.map(r => r.role));
}

fixNavtej().catch(console.error).finally(() => process.exit(0));
