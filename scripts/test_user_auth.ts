import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../src/lib/auth/password";

async function test() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, "madipadiganavtej@gmail.com"),
  });
  if (!user) {
    console.log("User not found!");
    return;
  }
  console.log("Found user:", user.email, "hash:", user.passwordHash.substring(0, 20));
  const matchNavtej = await verifyPassword("Navtej2006", user.passwordHash);
  console.log("Match Navtej2006:", matchNavtej);
}

test().catch(console.error).finally(() => process.exit(0));
