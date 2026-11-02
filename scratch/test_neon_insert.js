const postgres = require('postgres');

async function test() {
  const neonHost = 'ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech';
  const resolver = new (await import('dns')).promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  const addresses = await resolver.resolve4(neonHost);
  const sql = postgres({
    host: addresses[0],
    port: 5432,
    database: 'neondb',
    username: 'neondb_owner',
    password: 'npg_lpy7de4HEAOF',
    ssl: { servername: neonHost, rejectUnauthorized: false },
    connect_timeout: 10,
  });
  try {
    const [inserted] = await sql`
      INSERT INTO builder_applications (name, email, resume_url, github_url, message, status)
      VALUES ('Test Candidate', 'test_candidate@example.com', 'resumes/test.pdf', 'https://github.com/test', 'hello', 'PENDING')
      RETURNING id, created_at;
    `;
    console.log('Successfully inserted into Neon:', inserted);
    await sql`DELETE FROM builder_applications WHERE id = ${inserted.id}`;
    console.log('Successfully cleaned up test record from Neon');
  } catch (e) {
    console.error('Neon insert failed:', e);
  } finally {
    await sql.end();
  }
}
test();
