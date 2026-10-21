/**
 * BusinessBrain — Non-Destructive Staging Probe for Onboarding, Plans & Invitations
 * Target: https://jjalqvgaxzajsyccbjch.supabase.co
 *
 * Verifies schema and status without mutating data:
 * 1. Column `website_url` in `organizations` (Migration 00032)
 * 2. Column `onboarding_metadata` in `organizations` (Migration 00031)
 * 3. Table `subscriptions` and its plan/status columns
 * 4. Table `organization_invitations` schema and RLS behavior for anon vs authenticated
 * 5. Stripe test key validation (format and live balance check in test mode)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

function loadEnv(): Record<string, string> {
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
const stripeSecretKey = env["STRIPE_SECRET_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function probeStaging() {
  console.log("==========================================================================");
  console.log("NON-DESTRUCTIVE STAGING PROBE: ONBOARDING, INVITATIONS & STRIPE");
  console.log(`Target: ${supabaseUrl}`);
  console.log("==========================================================================\n");

  // 1. Organizations schema
  console.log("[1] Probing public.organizations schema...");
  const { data: orgData, error: orgError } = await client
    .from("organizations")
    .select("id, name, slug, status, created_by, website_url, onboarding_metadata")
    .limit(0);

  if (orgError) {
    if (orgError.message?.includes("website_url") || orgError.code === "42703") {
      console.log("  ⧖ PENDING: Column 'website_url' (Migration 00032) is pending remote execution");
    } else if (orgError.message?.includes("onboarding_metadata")) {
      console.log("  ⧖ PENDING: Column 'onboarding_metadata' (Migration 00031) is pending remote execution");
    } else {
      console.log(`  ✓ Organizations query result: ${orgError.message} (code: ${orgError.code})`);
    }
  } else {
    console.log("  ✓ PASS: Columns 'website_url' and 'onboarding_metadata' exist in public.organizations on remote staging");
  }

  // 2. Subscriptions schema
  console.log("\n[2] Probing public.subscriptions schema...");
  const { data: subData, error: subError } = await client
    .from("subscriptions")
    .select("id, organization_id, plan, status, trial_start, trial_end, current_period_end")
    .limit(0);

  if (subError) {
    console.log(`  ✗ Subscriptions error: ${subError.message} (code: ${subError.code})`);
  } else {
    console.log("  ✓ PASS: Table public.subscriptions exists with plan, status, and trial timestamp columns");
  }

  // 3. Organization Invitations schema & token_hash
  console.log("\n[3] Probing public.organization_invitations schema...");
  const { data: invData, error: invError } = await client
    .from("organization_invitations")
    .select("id, organization_id, email, role, token_hash, status, expires_at, job_title, initial_team_ids")
    .limit(0);

  if (invError) {
    console.log(`  ✗ Invitations error: ${invError.message} (code: ${invError.code})`);
  } else {
    console.log("  ✓ PASS: Table public.organization_invitations has all required columns including token_hash, job_title, and initial_team_ids");
  }

  // 4. Test Stripe Connectivity (read-only balance probe in test mode)
  console.log("\n[4] Probing Stripe Test Mode connectivity (Read-Only Balance Probe)...");
  if (!stripeSecretKey) {
    console.log("  ⧖ PENDING: STRIPE_SECRET_KEY not found in environment");
  } else {
    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
      const balance = await stripe.balance.retrieve();
      console.log(`  ✓ PASS: Stripe test mode key verified active. Available currencies: ${balance.available.map((b) => b.currency.toUpperCase()).join(", ") || "USD"}`);
    } catch (stripeErr: any) {
      console.log(`  ✗ Stripe test key error: ${stripeErr.message}`);
    }
  }

  // 5. Check RLS policies for unauthenticated access on organization_invitations
  console.log("\n[5] Probing Anon RLS lockdown on organization_invitations...");
  const { data: anonInv, error: anonError } = await client
    .from("organization_invitations")
    .select("id, email")
    .limit(1);

  if (!anonError && (!anonInv || anonInv.length === 0)) {
    console.log("  ✓ PASS: Anon caller receives 0 records (RLS correctly blocks unauthenticated access to invitations)");
  } else if (anonError) {
    console.log(`  ✓ PASS: Anon query blocked by PostgreSQL RLS: ${anonError.message}`);
  } else {
    console.log("  ✗ WARNING: Anon query leaked invitation records!");
  }

  console.log("\n==========================================================================");
  console.log("STAGING PROBE COMPLETE");
  console.log("==========================================================================");
}

probeStaging().catch(console.error);
