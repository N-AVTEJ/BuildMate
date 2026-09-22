const postgres = require('postgres');
const sql = postgres('postgresql://postgres@127.0.0.1:5433/buildmate');

async function main() {
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS requested_completion_date date;`;
  console.log('Column requested_completion_date added or already present.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
