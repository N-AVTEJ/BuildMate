// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../src/lib/auth/password";

async function test() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, "madipadiganavtej@gmail.com"),
  });
  if (!user || !user.passwordHash) {
    console.log("User not found or has no password hash!");
    return;
  }
  console.log("Found user:", user.email, "hash:", user.passwordHash.substring(0, 20));
  const matchNavtej = await verifyPassword(user.passwordHash, "Navtej2006");
  console.log("Match Navtej2006:", matchNavtej);
}

test().catch(console.error).finally(() => process.exit(0));
