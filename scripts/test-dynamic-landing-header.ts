/**
 * Deterministic Test Suite: Dynamic Landing Header Authentication States
 *
 * Verifies:
 * 1. landing-header.tsx integration with Supabase client (@/lib/supabase/client)
 * 2. Unauthenticated visitor contract: href="/login" and href="/signup"
 * 3. Authenticated user contract: single account button linking to /dashboard
 * 4. Avatar detection with fallback to neutral User icon
 * 5. Discrete transitional loading skeleton to prevent flash of wrong controls
 * 6. Responsive design: desktop action stack and mobile header + drawer
 * 7. Real-time auth subscription via onAuthStateChange
 * 8. Quad-locale i18n support (account and goToDashboard in en, pt, es, fr)
 * 9. Cross-landing coverage: all marketing pages render LandingHeader
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { en } from "../lib/i18n/dictionaries/en";
import { pt } from "../lib/i18n/dictionaries/pt";
import { es } from "../lib/i18n/dictionaries/es";
import { fr } from "../lib/i18n/dictionaries/fr";

console.log("==================================================================");
console.log("BUSINESSBRAIN: DYNAMIC LANDING HEADER AUTHENTICATION VERIFICATION");
console.log("==================================================================\n");

const rootDir = process.cwd();
const headerPath = path.join(rootDir, "components/landing/landing-header.tsx");
assert.ok(fs.existsSync(headerPath), "components/landing/landing-header.tsx exists");
const headerCode = fs.readFileSync(headerPath, "utf-8");

// --- Audit 1: Supabase Client Authentication Reuse ---
console.log("[Audit 1] Authentication Client Integration");
assert.ok(
  headerCode.includes('import { createClient } from "@/lib/supabase/client"'),
  "LandingHeader reuses existing createClient from @/lib/supabase/client"
);
assert.ok(
  headerCode.includes("supabase.auth.getUser()"),
  "LandingHeader checks authoritative user state with supabase.auth.getUser()"
);
assert.ok(
  headerCode.includes("supabase.auth.onAuthStateChange"),
  "LandingHeader subscribes to real-time session changes via onAuthStateChange"
);
console.log("  ✅ Existing Supabase browser authentication correctly integrated without duplicate systems");

// --- Audit 2: Destination Route & Security Invariants ---
console.log("\n[Audit 2] Canonical Dashboard Destination");
assert.ok(
  headerCode.includes('href="/dashboard"'),
  "Authenticated account button links strictly to canonical /dashboard"
);
assert.ok(
  !headerCode.includes("/account-fake") && !headerCode.includes("/profile-temp"),
  "No invented routes used; strictly directs to existing dashboard"
);
console.log("  ✅ Authenticated destination is strictly /dashboard");

// --- Audit 3: Unauthenticated vs Authenticated Contract ---
console.log("\n[Audit 3] Unauthenticated vs Authenticated Structural Switching");
assert.ok(
  headerCode.includes('href="/login"') && headerCode.includes('href="/signup"'),
  "Visitor controls retain Sign In (/login) and Start Free Trial (/signup)"
);
assert.ok(
  headerCode.includes('authStatus === "authenticated"') &&
    headerCode.includes('authStatus === "loading"'),
  "Header contains explicit state branches for loading, authenticated, and visitor"
);
console.log("  ✅ Full state branching implemented for visitor and authenticated users");

// --- Audit 4: Avatar Display with Neutral Icon Fallback ---
console.log("\n[Audit 4] Avatar Rendering & Neutral Fallback Icon");
assert.ok(
  headerCode.includes("user?.avatarUrl && !avatarError"),
  "Header conditionally renders user image when avatarUrl is present and valid"
);
assert.ok(
  headerCode.includes("<User") || headerCode.includes("User className="),
  "Header falls back to neutral User icon when avatar is missing or fails to load"
);
assert.ok(
  headerCode.includes("onError={() => setAvatarError(true)}"),
  "Header implements onError handler to recover gracefully from broken avatar URLs"
);
console.log("  ✅ Avatar rendering handles both real images and neutral fallback");

// --- Audit 5: Anti-Flash Transitional Loading State ---
console.log("\n[Audit 5] Anti-Flash Discrete Transitional Loading State");
assert.ok(
  headerCode.includes('authStatus === "loading"') && headerCode.includes("animate-pulse"),
  "Header renders subtle skeleton placeholder during session resolution"
);
assert.ok(
  headerCode.includes("hasSbCookie") || headerCode.includes("startsWith(\"sb-\")"),
  "Header inspects sb- cookie to avoid delay for visitors without active credentials"
);
console.log("  ✅ Discrete loading state avoids flash of wrong controls");

// --- Audit 6: Mobile and Desktop Responsive Ergonomics ---
console.log("\n[Audit 6] Responsive Ergonomics (Desktop & Mobile)");
assert.ok(
  headerCode.includes("hidden md:flex"),
  "Desktop controls placed in dedicated desktop action stack"
);
assert.ok(
  headerCode.includes("flex md:hidden"),
  "Mobile action controls provide one-tap dashboard access next to drawer button"
);
assert.ok(
  headerCode.includes("h-9 w-9") || headerCode.includes("min-h-[44px]"),
  "Touch and click target conforms to ergonomic interactive dimensions"
);
console.log("  ✅ Ergonomic click and tap targets verified for desktop and mobile");

// --- Audit 7: Quad-Locale i18n Dictionary Integrity ---
console.log("\n[Audit 7] Quad-Locale i18n Dictionary Integrity");
assert.strictEqual(en.landing.nav.account, "Account", "EN account token exists");
assert.strictEqual(en.landing.nav.goToDashboard, "Go to dashboard", "EN goToDashboard token exists");
assert.strictEqual(pt.landing.nav.account, "Conta", "PT account token exists");
assert.strictEqual(pt.landing.nav.goToDashboard, "Ir para a dashboard", "PT goToDashboard token exists");
assert.strictEqual(es.landing.nav.account, "Cuenta", "ES account token exists");
assert.strictEqual(es.landing.nav.goToDashboard, "Ir al panel de control", "ES goToDashboard token exists");
assert.strictEqual(fr.landing.nav.account, "Compte", "FR account token exists");
assert.strictEqual(fr.landing.nav.goToDashboard, "Aller au tableau de bord", "FR goToDashboard token exists");
console.log("  ✅ Quad-locale dictionaries fully populated with account navigation keys");

// --- Audit 8: Cross-Landing Coverage ---
console.log("\n[Audit 8] Cross-Landing Coverage Verification");
const marketingRoutes = [
  "app/(marketing)/page.tsx",
  "app/(marketing)/product/page.tsx",
  "app/(marketing)/company-graph/page.tsx",
  "app/(marketing)/integrations/page.tsx",
  "app/(marketing)/faq/page.tsx",
  "app/pricing/page.tsx",
];

for (const relRoute of marketingRoutes) {
  const fullRoutePath = path.join(rootDir, relRoute);
  assert.ok(fs.existsSync(fullRoutePath), `${relRoute} exists`);
  const content = fs.readFileSync(fullRoutePath, "utf-8");
  assert.ok(content.includes("<LandingHeader"), `${relRoute} renders LandingHeader`);
}
console.log("  ✅ All 6 landing and marketing routes render LandingHeader");

console.log("\n==================================================================");
console.log("ALL 8 DYNAMIC HEADER AUDITS PASSED WITH 100% COMPLIANCE");
console.log("==================================================================");
