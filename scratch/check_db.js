const postgres = require('postgres');

async function test() {
  console.log("Checking local DB...");
  const localSql = postgres('postgresql://postgres@127.0.0.1:5433/buildmate');
  try {
    const res = await localSql`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'builder_applications'`;
    console.log('Local builder_applications columns:', res.length, res);
  } catch (e) {
    console.error('Local error:', e.message);
  } finally {
    await localSql.end();
  }

  console.log("\nChecking Neon DB...");
  const neonHost = "ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech";
  const neonUser = "neondb_owner";
  const neonPass = "npg_lpy7de4HEAOF";
  const neonDb = "neondb";
  
  try {
    const resolver = new (await import("dns")).promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const addresses = await resolver.resolve4(neonHost);
    console.log("Resolved Neon IP:", addresses[0]);

    const neonSql = postgres({
      host: addresses[0],
      port: 5432,
      database: neonDb,
      username: neonUser,
      password: neonPass,
      ssl: {
        servername: neonHost,
        rejectUnauthorized: false,
      },
      connect_timeout: 10,
    });

    const neonRes = await neonSql`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'builder_applications'`;
    console.log('Neon builder_applications columns:', neonRes.length, neonRes);

    const apps = await neonSql`SELECT * FROM builder_applications ORDER BY created_at DESC LIMIT 5`;
    console.log('Recent applications in Neon:', apps);

    await neonSql.end();
  } catch (e) {
    console.error('Neon error:', e.message);
  }
}

test();
