import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Generates an atomic project code formatted as:
 * PRJ-{current-year}-{4-digit-global-sequence}
 * e.g., PRJ-2026-0001, PRJ-2026-0002
 *
 * Guaranteed atomic and concurrency-safe using PostgreSQL sequence `project_code_seq`.
 * Sequence gaps due to aborted/rolled-back transactions are acceptable.
 */
export async function generateProjectCode(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] = db
): Promise<string> {
  const result = await tx.execute(
    sql`SELECT nextval('project_code_seq')::text as "seqVal"`
  );

  const rawRows = (result as any).rows || result;
  const seqVal = rawRows[0]?.seqVal || "1";

  const year = new Date().getFullYear();
  const sequenceNumber = String(seqVal).padStart(4, "0");

  return `PRJ-${year}-${sequenceNumber}`;
}
