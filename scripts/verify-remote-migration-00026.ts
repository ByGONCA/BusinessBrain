import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
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

const env = loadEnv();
const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function checkRemote00026Status() {
  console.log("=======================================================");
  console.log("PROBING REMOTE SUPABASE FOR MIGRATION 00026 STATUS");
  console.log(`Target: ${supabaseUrl}`);
  console.log("=======================================================\n");

  let appliedScore = 0;

  // Probe 1: Call update_calendar_events_updated_at as anon
  const { data: trigData, error: trigError } = await client.rpc("update_calendar_events_updated_at");
  console.log("[Probe 1] update_calendar_events_updated_at via PostgREST RPC:");
  if (trigError && (trigError.code === "42501" || trigError.code === "PGRST202" || trigError.message?.includes("permission denied"))) {
    console.log(`  ✓ BLOCKED / OMITTED: Code ${trigError.code} - ${trigError.message}`);
    appliedScore++;
  } else {
    console.log(`  ✗ EXPOSED: Returned`, trigData, trigError);
  }

  // Probe 2: Call get_organization_storage_bytes as anon
  const { data: storData, error: storError } = await client.rpc("get_organization_storage_bytes", {
    p_org_id: "00000000-0000-0000-0000-000000000000",
  });
  console.log("\n[Probe 2] get_organization_storage_bytes as anon:");
  if (storError && (storError.code === "42501" || storError.message?.includes("permission denied"))) {
    console.log(`  ✓ STRICTLY DENIED: Code ${storError.code} - ${storError.message}`);
    appliedScore++;
  } else {
    console.log(`  ✗ EXPOSED or Unexpected: Returned`, storData, storError);
  }

  // Probe 3: Call check_rate_limit with null token
  const { data: rlData, error: rlError } = await client.rpc("check_rate_limit", {
    p_key: "rl:test:auth:probe@example.com",
    p_limit: 10,
    p_window_seconds: 60,
    p_server_token: null,
  });
  console.log("\n[Probe 3] check_rate_limit fail-closed verification:");
  if (rlError && rlError.code === "42501") {
    console.log(`  ✓ FAIL-CLOSED ACTIVE: Code ${rlError.code} - ${rlError.message}`);
    appliedScore++;
  } else {
    console.log(`  ✗ Unexpected response:`, rlData, rlError);
  }

  // Probe 4: Call accept_organization_invitation as anon
  const { data: accData, error: accError } = await client.rpc("accept_organization_invitation", {
    p_token_hash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  console.log("\n[Probe 4] accept_organization_invitation anon lockdown:");
  if (accError && (accError.code === "42501" || accError.message?.includes("permission denied"))) {
    console.log(`  ✓ LOCKED DOWN: Code ${accError.code} - ${accError.message}`);
    appliedScore++;
  } else {
    console.log(`  ✗ Allowed or returned:`, accData, accError);
  }

  console.log("\n=======================================================");
  console.log(`REMOTE PROBE COMPLETED: Score ${appliedScore}/4`);
  console.log("=======================================================");
}

checkRemote00026Status();
