import postgres from "postgres";

const neonHost = "ep-ancient-pond-b5aujk34-pooler.c-7.us-east-2.aws.neon.tech";
const neonUser = "neondb_owner";
const neonPass = "npg_lpy7de4HEAOF";
const neonDb = "neondb";

async function main() {
  console.log("Resolving Neon host with fallback DNS...");
  const resolver = new (await import("dns")).promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const addresses = await resolver.resolve4(neonHost);
  console.log("Resolved Neon IP:", addresses[0]);

  const sql = postgres({
    host: addresses[0],
    port: 5432,
    database: neonDb,
    username: neonUser,
    password: neonPass,
    ssl: {
      servername: neonHost,
      rejectUnauthorized: false,
    },
    connect_timeout: 15,
  });

  try {
    console.log("1. Ensuring builder_application_status enum exists on Neon...");
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE builder_application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("2. Ensuring builder_applications table exists on Neon...");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS builder_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email varchar(255) NOT NULL,
        resume_url text NOT NULL,
        github_url text,
        message text,
        status builder_application_status DEFAULT 'PENDING' NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    console.log("3. Provisioning ADMIN role for madipadiganavtej@gmail.com on Neon...");
    const [user] = await sql`
      SELECT id, name, email FROM users WHERE LOWER(email) = 'madipadiganavtej@gmail.com'
    `;

    if (!user) {
      console.error("User madipadiganavtej@gmail.com not found on Neon!");
      return;
    }

    console.log(`Found user: ${user.name} (${user.email}) ID: ${user.id}`);

    // Update user name to Madipadiga Navtej
    await sql`
      UPDATE users 
      SET name = 'Madipadiga Navtej', updated_at = now()
      WHERE id = ${user.id}
    `;

    // Ensure ADMIN role exists
    const [existingAdminRole] = await sql`
      SELECT * FROM user_roles WHERE user_id = ${user.id} AND role = 'ADMIN'
    `;

    if (!existingAdminRole) {
      await sql`
        INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
        VALUES (gen_random_uuid(), ${user.id}, 'ADMIN', now(), now())
      `;
      console.log("Successfully inserted ADMIN role for madipadiganavtej@gmail.com on Neon!");
    } else {
      console.log("ADMIN role already present on Neon.");
    }

    // Ensure BUILDER role exists
    const [existingBuilderRole] = await sql`
      SELECT * FROM user_roles WHERE user_id = ${user.id} AND role = 'BUILDER'
    `;

    if (!existingBuilderRole) {
      await sql`
        INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
        VALUES (gen_random_uuid(), ${user.id}, 'BUILDER', now(), now())
      `;
      console.log("Successfully inserted BUILDER role for madipadiganavtej@gmail.com on Neon!");
    } else {
      console.log("BUILDER role already present on Neon.");
    }

    // Check roles
    const roles = await sql`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    console.log("Final roles on Neon for madipadiganavtej@gmail.com:", roles.map(r => r.role));

    // Also verify no other users hold ADMIN or BUILDER on Neon
    const otherPrivileged = await sql`
      SELECT ur.id, ur.role, u.email, u.name 
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.role IN ('ADMIN', 'BUILDER')
        AND LOWER(u.email) != 'madipadiganavtej@gmail.com';
    `;
    console.log("Other privileged roles on Neon (should be 0):", otherPrivileged);

    console.log("Neon database sync complete!");
  } catch (err) {
    console.error("Error during Neon sync:", err);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

