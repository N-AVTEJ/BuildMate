const { Pool } = require('pg');

async function heal(name, url, ssl) {
  const pool = new Pool({ connectionString: url, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  try {
    const res = await pool.query(
      "SELECT p.id, p.project_code, p.status, p.total_price, p.advance_amount, p.remaining_amount " +
      "FROM projects p " +
      "WHERE p.status = 'FINAL_PAYMENT_PENDING' AND (p.remaining_amount <= 0 OR p.remaining_amount IS NULL);"
    );
    console.log(name + ' candidates:', res.rows);
    for (const row of res.rows) {
      console.log('Healing ' + row.project_code + ' on ' + name);
      const now = new Date();
      await pool.query(
        "UPDATE projects SET status = 'DELIVERY_UNLOCKED', completed_at = $1, updated_at = $1 WHERE id = $2;",
        [now, row.id]
      );
      await pool.query(
        "INSERT INTO payments (id, project_id, type, expected_amount, submitted_amount, status, transaction_reference, verified_at, created_at, updated_at) " +
        "VALUES (gen_random_uuid(), $1, 'FINAL', 0, 0, 'VERIFIED', 'FULL_ADVANCE_SETTLED', $2, $2, $2);",
        [row.id, now]
      );
      await pool.query(
        "INSERT INTO project_status_history (id, project_id, from_status, to_status, changed_by, reason, created_at) " +
        "VALUES (gen_random_uuid(), $1, 'FINAL_PAYMENT_PENDING', 'DELIVERY_UNLOCKED', '00000000-0000-0000-0000-000000000000', 'Automated reconciliation: 100% advance deposit settled', $2);",
        [row.id, now]
      );
      console.log('Successfully healed ' + row.project_code);
    }
  } catch (e) {
    console.error(name + ' error:', e);
  } finally {
    await pool.end();
  }
}

async function main() {
  await heal('Neon', 'postgresql://neondb_owner:npg_lpy7de4HEAOF@ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require', true);
  await heal('Local', 'postgresql://postgres@127.0.0.1:5433/buildmate', false);
}
main();
