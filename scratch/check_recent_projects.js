const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const postgres = require('postgres');

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const sql = postgres(process.env.DATABASE_URL);

async function inspectProjects() {
  try {
    const projects = await sql`
      SELECT id, project_code, client_id, status, advance_amount, remaining_amount, total_price, budget_min, budget_max, created_at
      FROM projects
      ORDER BY created_at DESC
      LIMIT 5
    `;
    console.log("Recent projects:", projects);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

inspectProjects();
