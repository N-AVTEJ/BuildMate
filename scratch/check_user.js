const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres@127.0.0.1:5433/buildmate' });

async function run() {
  try {
    const res = await pool.query(
      "SELECT id, name, email, email_verified, created_at FROM users WHERE email = $1",
      ['madipadiganavtej@gmail.com']
    );
    console.log("User:", res.rows);

    if (res.rows.length > 0) {
      const tokens = await pool.query(
        "SELECT id, user_id, used, expires_at, created_at FROM email_verification_tokens WHERE user_id = $1",
        [res.rows[0].id]
      );
      console.log("Tokens:", tokens.rows);
    }
  } catch (err) {
    console.error("Query error:", err);
  } finally {
    await pool.end();
  }
}

run();
