import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * BusinessBrain — SEC-01 Staging Secret Generator & Migration Preparer
 * 
 * Generates a high-entropy 256-bit secret (64-character hex) and:
 * 1. Writes it to .env.local (gitignored) as SERVER_AUTH_SECRET
 * 2. Prepares database/migrations/RUN_MIGRATION_00024_STAGING.sql (gitignored)
 *    which contains migration 00024 plus the automated secret insertion
 *    into public.internal_system_secrets.
 * 
 * NEVER prints the secret to stdout or stderr.
 */

function setupStaging() {
  console.log("=======================================================");
  console.log("SEC-01: PREPARING STAGING SECRETS & MIGRATION PACKAGE");
  console.log("=======================================================");

  // 1. Generate 32 bytes (256 bits) of cryptographic randomness
  const secret = crypto.randomBytes(32).toString("hex");

  // 2. Update .env.local
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  let envLocalContent = "";
  if (fs.existsSync(envLocalPath)) {
    envLocalContent = fs.readFileSync(envLocalPath, "utf-8");
  }

  // Replace or append SERVER_AUTH_SECRET
  if (envLocalContent.includes("SERVER_AUTH_SECRET=")) {
    envLocalContent = envLocalContent.replace(/SERVER_AUTH_SECRET=.*(\r?\n|$)/, `SERVER_AUTH_SECRET=${secret}$1`);
  } else {
    envLocalContent += (envLocalContent.endsWith("\n") || envLocalContent.length === 0 ? "" : "\n") + `SERVER_AUTH_SECRET=${secret}\n`;
  }
  fs.writeFileSync(envLocalPath, envLocalContent, "utf-8");
  console.log("✓ Successfully wrote SERVER_AUTH_SECRET to .env.local (gitignored).");

  // 3. Read base migration 00024
  const migPath = path.resolve(process.cwd(), "database/migrations/00024_secure_invitations_and_hashing.sql");
  if (!fs.existsSync(migPath)) {
    console.error("✗ Fatal: 00024_secure_invitations_and_hashing.sql not found!");
    process.exit(1);
  }
  const baseSql = fs.readFileSync(migPath, "utf-8");

  // 4. Construct complete, idempotent Staging SQL script
  const stagingSql = `
-- ==============================================================================
-- BusinessBrain: Migration 00024 for STAGING
-- Automated Generation for SEC-01 Rollout
-- Target Instance: https://jjalqvgaxzajsyccbjch.supabase.co
-- ==============================================================================

${baseSql}

-- ------------------------------------------------------------------------------
-- 10. Provision Staging SERVER_AUTH_SECRET in public.internal_system_secrets
-- ------------------------------------------------------------------------------
insert into public.internal_system_secrets (key, secret, updated_at)
values ('server_auth', '${secret}', now())
on conflict (key) do update set secret = excluded.secret, updated_at = now();

-- Validation check
do $$
declare
  v_check text;
begin
  select secret into v_check from public.internal_system_secrets where key = 'server_auth';
  if v_check is null or length(v_check) < 32 then
    raise exception 'Staging provisioning failed: secret not set properly';
  end if;
end $$;
`;

  const stagingMigPath = path.resolve(process.cwd(), "database/migrations/RUN_MIGRATION_00024_STAGING.sql");
  fs.writeFileSync(stagingMigPath, stagingSql, "utf-8");
  console.log("✓ Successfully generated database/migrations/RUN_MIGRATION_00024_STAGING.sql (gitignored).");
  console.log("✓ Security Notice: Zero secret values exposed in terminal output.");
  console.log("=======================================================");
}

setupStaging();
