import { PGlite } from "@electric-sql/pglite";

async function testTs() {
  const db = new PGlite();
  // Generate a timestamp with fractional microseconds and retrieve as text
  const res = await db.query<{ ts_text: string }>("select '2026-10-18 15:30:00.123456+00'::timestamptz::text as ts_text;");
  const rawTsText = res.rows[0].ts_text;
  console.log("PostgreSQL raw text timestamp:", rawTsText);

  const jsDate = new Date(rawTsText).toISOString();
  console.log("JavaScript Date.toISOString():", jsDate);

  const cmp1 = await db.query<{ eq: boolean }>(
    `select ('${rawTsText}'::timestamptz = '${jsDate}'::timestamptz) as eq;`
  );
  console.log("Direct = comparison (Microseconds vs Milliseconds):", cmp1.rows[0].eq);

  const cmp2 = await db.query<{ eq: boolean }>(
    `select (date_trunc('milliseconds', '${rawTsText}'::timestamptz) = date_trunc('milliseconds', '${jsDate}'::timestamptz)) as eq;`
  );
  console.log("date_trunc('milliseconds') comparison:", cmp2.rows[0].eq);
}

testTs().catch(console.error);
