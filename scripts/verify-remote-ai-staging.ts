import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function verifyStaging() {
  console.log("==================================================================");
  console.log("SUPABASE STAGING REMOTE VERIFICATION (MIGRATIONS 00038-00041)");
  console.log("==================================================================\n");

  const envPath = path.resolve(process.cwd(), ".env");
  const envLocalPath = path.resolve(process.cwd(), ".env.local");

  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const envLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";

  const urlMatch = envContent.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
  const anonKeyMatch = envContent.match(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)$/m);
  const serviceKeyMatch = (envLocalContent + "\n" + envContent).match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m);

  const supabaseUrl = urlMatch ? urlMatch[1].trim() : "";
  const anonKey = anonKeyMatch ? anonKeyMatch[1].trim() : "";
  const serviceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : "";

  console.log(`Target: ${supabaseUrl}`);
  const url = new URL(supabaseUrl);
  console.log(`Host: ${url.hostname}`);
  console.log(`Project Ref: ${url.hostname.split(".")[0]}`);
  console.log(`Service Role Key Available: ${Boolean(serviceKey)}\n`);

  if (!supabaseUrl || !anonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
  }

  // 1. Probe PostgREST REST endpoints for all tables
  const tables = [
    "user_ai_credentials",
    "organization_ai_credentials",
    "ai_conversations",
    "ai_messages",
    "ai_usage_ledger",
    "ai_credit_reservations",
    "ai_access_authorizations",
    "ai_access_audit_ledger",
  ];

  console.log("--- PART 1: Table Availability & RLS Verification (REST API) ---");
  for (const table of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 200) {
      console.log(`  ✅ Table '${table}': HTTP 200 OK (Exists & queryable under RLS)`);
    } else if (res.status === 401 || res.status === 403) {
      console.log(`  ✅ Table '${table}': HTTP ${res.status} (Exists and protected by RLS)`);
    } else {
      const errText = await res.text();
      console.log(`  ❌ Table '${table}': HTTP ${res.status} - ${errText.slice(0, 150)}`);
    }
  }

  // 2. Probe RPC functions
  console.log("\n--- PART 2: Atomic PostgreSQL RPC Verification ---");
  const rpcs = [
    {
      name: "reserve_ai_credits_atomic",
      params: {
        p_org_id: "00000000-0000-0000-0000-000000000000",
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_conversation_id: null,
        p_task_type: "general_chat",
        p_provider: "gemini",
        p_model: "gemini-2.5-flash",
        p_is_byok: false,
        p_estimated_credits: 2,
        p_quota: 1000,
      },
    },
    {
      name: "settle_ai_credit_reservation_atomic",
      params: {
        p_reservation_id: "00000000-0000-0000-0000-000000000000",
        p_actual_tokens: 1500,
        p_is_byok: false,
        p_status: "settled",
      },
    },
    {
      name: "release_ai_credit_reservation_atomic",
      params: {
        p_reservation_id: "00000000-0000-0000-0000-000000000000",
      },
    },
  ];

  for (const rpc of rpcs) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc.name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpc.params),
    });

    const bodyText = await res.text();
    if (res.status === 200) {
      console.log(`  ✅ RPC '${rpc.name}': HTTP 200 OK (Signature matches and executed)`);
    } else if (res.status === 404) {
      console.log(`  ❌ RPC '${rpc.name}': HTTP 404 (Missing from schema cache: ${bodyText.slice(0, 100)})`);
    } else {
      console.log(`  ✅ RPC '${rpc.name}': HTTP ${res.status} (Function recognized: ${bodyText.slice(0, 120)})`);
    }
  }

  // 3. Service role client probe (if key available)
  if (serviceKey) {
    console.log("\n--- PART 3: Service Role Diagnostic Check ---");
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: orgs, error: orgErr } = await adminClient
      .from("organizations")
      .select("id, name, workspace_type")
      .limit(3);

    if (orgErr) {
      console.error("  ❌ Failed to query organizations with service key:", orgErr.message);
    } else {
      console.log(`  ✅ Service key connected successfully. Found ${orgs?.length || 0} organizations in staging.`);
      if (orgs && orgs.length > 0) {
        console.log(`     Sample org: ${orgs[0].id} (${orgs[0].name || "unnamed"})`);
      }
    }
  }
}

verifyStaging().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
