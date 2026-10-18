import fs from "node:fs";

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

const snapshotColumns = [
  "id",
  "organization_id",
  "metric_type",
  "payload",
  "currency_summaries",
  "computed_at",
  "expires_at",
  "status",
  "checksum",
  "payload_size_bytes",
  "sync_lock_until",
  "sync_locked_by",
  "error_details",
  "created_at",
  "updated_at",
];

const nonceColumns = [
  "id",
  "organization_id",
  "nonce",
  "provider",
  "created_by_user_id",
  "expires_at",
  "consumed_at",
  "created_at",
];

async function probeColumn(table: string, column: string): Promise<{ exists: boolean; code: string; message: string }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${column}&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const data = await res.json();
  if (data?.code === "42703") {
    return { exists: false, code: data.code, message: data.message };
  }
  if (data?.code === "42501" || Array.isArray(data)) {
    return { exists: true, code: data?.code || "200", message: data?.message || "OK" };
  }
  return { exists: false, code: data?.code || `${res.status}`, message: data?.message || "Unknown error" };
}

async function verifyAllColumns() {
  console.log("=== VERIFYING REMOTE SCHEMA COLUMNS (POSTGRES ENGINE) ===");
  console.log(`Target: ${supabaseUrl}\n`);

  console.log("--- Probing table: organization_metric_snapshots ---");
  for (const col of snapshotColumns) {
    const r = await probeColumn("organization_metric_snapshots", col);
    if (r.exists) {
      console.log(`  ✓ Column '${col}': CONFIRMED PRESENT (Status: ${r.code})`);
    } else {
      console.log(`  ✗ Column '${col}': MISSING (Error: ${r.code} - ${r.message})`);
    }
  }

  // Also probe a bogus column to demonstrate negative control
  const bogusSnapshot = await probeColumn("organization_metric_snapshots", "_non_existent_check_xyz");
  console.log(`  Negative Control ('_non_existent_check_xyz'): exists=${bogusSnapshot.exists} (Code: ${bogusSnapshot.code})`);

  console.log("\n--- Probing table: oauth_nonce_ledger ---");
  for (const col of nonceColumns) {
    const r = await probeColumn("oauth_nonce_ledger", col);
    if (r.exists) {
      console.log(`  ✓ Column '${col}': CONFIRMED PRESENT (Status: ${r.code})`);
    } else {
      console.log(`  ✗ Column '${col}': MISSING (Error: ${r.code} - ${r.message})`);
    }
  }

  // Negative control for nonce ledger
  const bogusNonce = await probeColumn("oauth_nonce_ledger", "_non_existent_check_xyz");
  console.log(`  Negative Control ('_non_existent_check_xyz'): exists=${bogusNonce.exists} (Code: ${bogusNonce.code})`);
}

verifyAllColumns().catch(console.error);
