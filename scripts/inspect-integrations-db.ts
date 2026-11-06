import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env and .env.local
for (const f of [".env", ".env.local"]) {
  const full = path.resolve(process.cwd(), f);
  if (fs.existsSync(full)) {
    const lines = fs.readFileSync(full, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function checkIntegrationsTable() {
  console.log("Checking remote Supabase database integrations...");
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Publishable key");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("organization_integrations")
    .select("id, organization_id, provider, provider_account_id, status, created_at, updated_at");

  if (error) {
    console.log("Error querying organization_integrations (expected if anonymous / RLS):", error.message);
  } else {
    console.log(`Found ${data?.length || 0} integration rows:`, data);
  }
}

checkIntegrationsTable();
