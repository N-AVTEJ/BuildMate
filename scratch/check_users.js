const postgres = require('postgres');
const sql = postgres('postgresql://postgres@127.0.0.1:5433/buildmate');

async function main() {
  const users = await sql`
    SELECT u.id, u.name, u.email, u.email_verified, u.created_at, ur.role
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    ORDER BY u.created_at DESC;
  `;
  console.log(`Total users: ${users.length}`);
  for (const u of users) {
    console.log(`${u.created_at.toISOString()} | ${u.role || 'NO_ROLE'} | verified=${u.email_verified} | ${u.email} | ${u.name}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
