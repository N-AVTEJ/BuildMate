import { client } from "../src/db";

interface LowPriceProject {
  id: string;
  project_code: string;
  title: string;
  status: string;
  total_price: number | null;
  advance_amount: number | null;
  remaining_amount: number | null;
  created_at: Date;
  client_id: string;
  builder_id: string | null;
}

interface LowPriceQuotation {
  id: string;
  project_id: string;
  total_price: number;
  advance_amount: number;
  remaining_amount: number;
  estimated_duration_days: number;
  status: string;
  created_at: Date;
}

async function auditLowPriceProjects() {
  console.log("================================================================================");
  console.log("BUILDMATE AUDIT: Low-Price Projects (< ₹300 Floor)");
  console.log("Rule: Server-side price floor is ₹300. Reporting projects & quotations < ₹300.");
  console.log("SAFE AUDIT MODE: No database mutations will be performed.");
  console.log("================================================================================\n");

  const lowPriceProjects = await client<LowPriceProject[]>`
    SELECT 
      id,
      project_code,
      title,
      status,
      total_price,
      advance_amount,
      remaining_amount,
      created_at,
      client_id,
      builder_id
    FROM projects
    WHERE total_price IS NOT NULL AND total_price < 300
    ORDER BY created_at ASC
  `;

  const lowPriceQuotations = await client<LowPriceQuotation[]>`
    SELECT
      id,
      project_id,
      total_price,
      advance_amount,
      remaining_amount,
      estimated_duration_days,
      status,
      created_at
    FROM quotations
    WHERE total_price < 300
    ORDER BY created_at ASC
  `;

  console.log(`[Audit Result] Found ${lowPriceProjects.length} project(s) with total_price < ₹300.`);
  if (lowPriceProjects.length > 0) {
    console.log("\nAFFECTED PROJECTS:");
    for (const proj of lowPriceProjects) {
      console.log(`  - Project Code: ${proj.project_code}`);
      console.log(`    ID:           ${proj.id}`);
      console.log(`    Title:        ${proj.title}`);
      console.log(`    Status:       ${proj.status}`);
      console.log(`    Total Price:  ₹${proj.total_price}`);
      console.log(`    Advance:      ₹${proj.advance_amount}`);
      console.log(`    Remaining:    ₹${proj.remaining_amount}`);
      console.log(`    Created At:   ${proj.created_at.toISOString()}`);
      console.log(`    Builder ID:   ${proj.builder_id || "Unassigned"}`);
      console.log(`    Client ID:    ${proj.client_id}`);
      console.log("  ------------------------------------------------------------------------------");
    }
  } else {
    console.log("  No projects found in this database instance with total_price < ₹300.");
  }

  console.log(`\n[Audit Result] Found ${lowPriceQuotations.length} quotation(s) with total_price < ₹300.`);
  if (lowPriceQuotations.length > 0) {
    console.log("\nAFFECTED QUOTATIONS:");
    for (const q of lowPriceQuotations) {
      console.log(`  - Quotation ID: ${q.id}`);
      console.log(`    Project ID:   ${q.project_id}`);
      console.log(`    Status:       ${q.status}`);
      console.log(`    Total Price:  ₹${q.total_price}`);
      console.log(`    Advance:      ₹${q.advance_amount}`);
      console.log(`    Remaining:    ₹${q.remaining_amount}`);
      console.log(`    Duration:     ${q.estimated_duration_days} days`);
      console.log(`    Created At:   ${q.created_at.toISOString()}`);
      console.log("  ------------------------------------------------------------------------------");
    }
  } else {
    console.log("  No quotations found in this database instance with total_price < ₹300.");
  }

  console.log("\n================================================================================");
  console.log("ACTION RECOMMENDATION:");
  console.log("- For any listed project (e.g., PRJ-2026-0005 with ₹15 total_price):");
  console.log("  DO NOT automatically update live financial records.");
  console.log("  Review agreed project terms manually with builder & client before manual fix.");
  console.log("================================================================================");

  await client.end();
  process.exit(0);
}

auditLowPriceProjects().catch(async (err) => {
  console.error("[Audit Low Price Projects] Error executing audit script:", err);
  await client.end();
  process.exit(1);
});
