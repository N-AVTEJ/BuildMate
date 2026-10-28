import { client } from "../src/db";

const ALLOWED_ADMIN_EMAIL = "madipadiganavtej@gmail.com";

async function cleanupRoles() {
  console.log(`[Cleanup Roles] Scanning for unauthorized ADMIN and BUILDER roles...`);
  console.log(`[Cleanup Roles] Allowed privileged email: ${ALLOWED_ADMIN_EMAIL}`);

  // 1. Audit and log which rows are targeted for deletion
  const candidateRows = await client<
    { role_id: string; role: string; user_id: string; email: string; name: string }[]
  >`
    SELECT 
      ur.id AS role_id, 
      ur.role, 
      ur.user_id, 
      u.email, 
      u.name
    FROM user_roles ur
    INNER JOIN users u ON ur.user_id = u.id
    WHERE ur.role IN ('ADMIN', 'BUILDER')
      AND u.email != ${ALLOWED_ADMIN_EMAIL}
  `;

  if (candidateRows.length === 0) {
    console.log(`[Cleanup Roles] No unauthorized ADMIN or BUILDER roles found in database.`);
    console.log(`[Cleanup Roles] Confirmation: ONLY '${ALLOWED_ADMIN_EMAIL}' holds privileged access.`);
    await client.end();
    process.exit(0);
  }

  console.log(`\n============================================================`);
  console.log(`AUDIT LOG: Stripping ${candidateRows.length} unauthorized role row(s):`);
  console.log(`============================================================`);
  for (const row of candidateRows) {
    console.log(
      `  - User: "${row.name}" | Email: <${row.email}> | UserID: ${row.user_id} | Role to strip: ${row.role}`
    );
  }
  console.log(`============================================================\n`);

  // 2. Perform deletion of unauthorized user_roles rows only (preserving underlying users)
  const deletedRows = await client<
    { id: string; user_id: string; role: string }[]
  >`
    DELETE FROM user_roles
    WHERE role IN ('ADMIN', 'BUILDER')
      AND user_id NOT IN (
        SELECT id FROM users WHERE email = ${ALLOWED_ADMIN_EMAIL}
      )
    RETURNING id, user_id, role
  `;

  console.log(`[Cleanup Roles] Successfully deleted ${deletedRows.length} unauthorized role assignment(s).`);
  console.log(`[Cleanup Roles] Confirmation: Only '${ALLOWED_ADMIN_EMAIL}' possesses ADMIN/BUILDER roles.`);

  await client.end();
  process.exit(0);
}

cleanupRoles().catch(async (error) => {
  console.error("[Cleanup Roles] Fatal error:", error);
  await client.end();
  process.exit(1);
});
