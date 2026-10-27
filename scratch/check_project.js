const postgres = require('postgres');

async function check() {
  const localSql = postgres('postgresql://postgres@127.0.0.1:5433/buildmate');
  try {
    const rows = await localSql`SELECT id, project_code, status, total_price, advance_amount, remaining_amount, budget_min, budget_max FROM projects WHERE id = '4c91511b-9a7c-4e81-bd0b-55bc62dbe6f5'`;
    console.log('LOCAL DB PROJECT:', rows);
    const quotes = await localSql`SELECT id, total_price, advance_amount, remaining_amount, status FROM quotations WHERE project_id = '4c91511b-9a7c-4e81-bd0b-55bc62dbe6f5'`;
    console.log('LOCAL DB QUOTES:', quotes);
  } catch(e) { console.error('local err:', e.message); }
  await localSql.end();

  const neonUrl = 'postgresql://neondb_owner:npg_lpy7de4HEAOF@ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const neonSql = postgres(neonUrl, { ssl: 'require' });
  try {
    const rows = await neonSql`SELECT id, project_code, status, total_price, advance_amount, remaining_amount, budget_min, budget_max FROM projects WHERE id = '4c91511b-9a7c-4e81-bd0b-55bc62dbe6f5'`;
    console.log('NEON DB PROJECT:', rows);
    const quotes = await neonSql`SELECT id, total_price, advance_amount, remaining_amount, status FROM quotations WHERE project_id = '4c91511b-9a7c-4e81-bd0b-55bc62dbe6f5'`;
    console.log('NEON DB QUOTES:', quotes);
  } catch(e) { console.error('neon err:', e.message); }
  await neonSql.end();
}
check();
