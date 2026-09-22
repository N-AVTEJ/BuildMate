import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../src/lib/auth/password";

async function check() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, "madipadiganavtej@gmail.com"),
  });
  if (!user) return;
  console.log("Full hash:", user.passwordHash);
  const candidates = [
    "Navtej2006",
    "Navtej2006!",
    "Navtej2006@",
    "Navtej@2006",
    "navtej2006",
    "1234",
    "Password123!",
    "BuildMate2026!",
    "Admin123!",
  ];
  for (const c of candidates) {
    const ok = await verifyPassword(c, user.passwordHash);
    console.log(`Checking "${c}": ${ok}`);
  }
}

check().catch(console.error).finally(() => process.exit(0));
