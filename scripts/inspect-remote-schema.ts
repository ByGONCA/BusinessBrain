import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function getEnv() {
  const env: Record<string, string> = {};
  for (const f of [".env", ".env.local"]) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"]!;
const supabaseKey = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]!;

console.log("=== INSPECTING REMOTE SUPABASE (READ-ONLY) ===");
console.log(`Target URL: ${supabaseUrl}`);
const projectRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
console.log(`Project Ref: ${projectRef}\n`);

async function runInspection() {
  const client = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch OpenAPI definition from PostgREST /rest/v1/
  console.log("--- [Check 1] PostgREST OpenAPI Schema Definitions ---");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseKey },
    });
    if (!res.ok) {
      console.log(`Failed to fetch OpenAPI spec: HTTP ${res.status}`);
    } else {
      const spec = await res.json();
      const defs = spec.definitions || {};
      const paths = Object.keys(spec.paths || {});

      console.log(`Total table/view definitions in OpenAPI: ${Object.keys(defs).length}`);

      // Check organization_metric_snapshots
      if (defs.organization_metric_snapshots) {
        console.log("\n[CONFIRMED] 'organization_metric_snapshots' exists in schema cache!");
        console.log("Columns & Types:");
        const props = defs.organization_metric_snapshots.properties || {};
        for (const [col, details] of Object.entries(props) as [string, any][]) {
          console.log(`  - ${col}: type=${details.type || "unknown"}, format=${details.format || "none"}, description=${details.description || ""}`);
        }
        console.log("Required columns:", defs.organization_metric_snapshots.required || []);
      } else {
        console.log("\n[NOT FOUND] 'organization_metric_snapshots' NOT in PostgREST OpenAPI definitions");
      }

      // Check oauth_nonce_ledger
      if (defs.oauth_nonce_ledger) {
        console.log("\n[CONFIRMED] 'oauth_nonce_ledger' exists in schema cache!");
        console.log("Columns & Types:");
        const props = defs.oauth_nonce_ledger.properties || {};
        for (const [col, details] of Object.entries(props) as [string, any][]) {
          console.log(`  - ${col}: type=${details.type || "unknown"}, format=${details.format || "none"}, description=${details.description || ""}`);
        }
        console.log("Required columns:", defs.oauth_nonce_ledger.required || []);
      } else {
        console.log("\n[NOT FOUND] 'oauth_nonce_ledger' NOT in PostgREST OpenAPI definitions");
      }

      // Check RPCs
      console.log("\nChecking exposed RPC paths in OpenAPI:");
      const rpcPaths = paths.filter(p => p.startsWith("/rpc/"));
      console.log(`Found ${rpcPaths.length} RPC paths. Has /rpc/has_org_role:`, paths.includes("/rpc/has_org_role"));
      console.log("Has /rpc/is_org_member:", paths.includes("/rpc/is_org_member"));
    }
  } catch (err: any) {
    console.log("Error querying OpenAPI spec:", err.message);
  }

  // 2. Migration History Table Check
  console.log("\n--- [Check 2] Migration History Accessibility ---");
  for (const tbl of ["schema_migrations", "supabase_migrations", "_prisma_migrations"]) {
    const { data, error } = await client.from(tbl).select("*").limit(5);
    if (error) {
      console.log(`  Table '${tbl}': ${error.code} - ${error.message}`);
    } else {
      console.log(`  Table '${tbl}': Found ${data?.length} records!`, data);
    }
  }

  // 3. Error Root-Cause Investigation: "permission denied for function has_org_role"
  console.log("\n--- [Check 3] Root Cause Investigation: has_org_role Permission Denied ---");
  
  // Test 3a: Direct RPC call to has_org_role as anon
  const { data: rpcData, error: rpcError } = await client.rpc("has_org_role", {
    target_org_id: "00000000-0000-0000-0000-000000000000",
    allowed_roles: ["owner", "admin"],
  });
  console.log("Direct RPC has_org_role as anon:", rpcError ? `${rpcError.code} - ${rpcError.message}` : "Success");

  // Test 3b: Direct RPC call to is_org_member as anon
  const { data: memData, error: memError } = await client.rpc("is_org_member", {
    target_org_id: "00000000-0000-0000-0000-000000000000",
  });
  console.log("Direct RPC is_org_member as anon:", memError ? `${memError.code} - ${memError.message}` : "Success");

  // Test 3c: Check other tenant tables with RLS as anon (e.g. organization_integrations, pages)
  const { data: intData, error: intError } = await client.from("organization_integrations").select("id").limit(1);
  console.log("SELECT on organization_integrations as anon:", intError ? `${intError.code} - ${intError.message}` : `Empty data: ${JSON.stringify(intData)}`);

  const { data: snapData, error: snapError } = await client.from("organization_metric_snapshots").select("id").limit(1);
  console.log("SELECT on organization_metric_snapshots as anon:", snapError ? `${snapError.code} - ${snapError.message}` : `Empty data: ${JSON.stringify(snapData)}`);

  const { data: nonData, error: nonError } = await client.from("oauth_nonce_ledger").select("id").limit(1);
  console.log("SELECT on oauth_nonce_ledger as anon:", nonError ? `${nonError.code} - ${nonError.message}` : `Empty data: ${JSON.stringify(nonData)}`);
}

runInspection().catch(console.error);
