import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { hashPassword } from "../lib/auth/password";
import { eq } from "drizzle-orm";

const neonUrl = "postgresql://neondb_owner:npg_lpy7de4HEAOF@ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon...");
  const client = postgres(neonUrl, { ssl: "require", prepare: false });
  const db = drizzle(client, { schema });

  const builderEmail = "madipadiganavtej@gmail.com";
  const builderPass = "Navtej2006";

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, builderEmail))
    .limit(1);

  if (existing) {
    console.log("User already exists in Neon with ID:", existing.id);
  } else {
    console.log("Creating Builder account...");
    const passwordHash = await hashPassword(builderPass);
    const [newUser] = await db
      .insert(schema.users)
      .values({
        name: "Navtej Builder",
        email: builderEmail,
        passwordHash,
        emailVerified: true,
      })
      .returning();

    await db.insert(schema.userRoles).values([
      { userId: newUser.id, role: "BUILDER" },
      { userId: newUser.id, role: "CLIENT" },
    ]);
    console.log("Builder created with roles BUILDER and CLIENT! ID:", newUser.id);
  }

  // Also create a sample client account for testing
  const clientEmail = "client@buildmate.dev";
  const [existingClient] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, clientEmail))
    .limit(1);

  if (!existingClient) {
    const passwordHash = await hashPassword("ClientPassword123!");
    const [clientUser] = await db
      .insert(schema.users)
      .values({
        name: "Test Client",
        email: clientEmail,
        passwordHash,
        emailVerified: true,
      })
      .returning();

    await db.insert(schema.userRoles).values({
      userId: clientUser.id,
      role: "CLIENT",
    });
    console.log("Client created:", clientEmail);
  }

  console.log("Seed complete!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
