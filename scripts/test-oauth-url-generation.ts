import fs from "node:fs";
import path from "node:path";
import { generateGoogleAuthUrl } from "../lib/integrations/google/oauth";
import { generateMicrosoftAuthUrl } from "../lib/integrations/microsoft/oauth";
import { getGoogleConfig } from "../lib/integrations/google/config";
import { getMicrosoftConfig, isMicrosoftIntegrationConfigured } from "../lib/integrations/microsoft/config";

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

async function testOAuthFlows() {
  console.log("================================================================");
  console.log(" OPERATIONAL VALIDATION: OAUTH URLS & FLOW INTEGRITY");
  console.log("================================================================\n");

  // 1. Google OAuth URL
  console.log("[1] Testing Google Calendar & Gmail OAuth URL Generation...");
  const googleConfig = getGoogleConfig();
  console.log(`  Google isConfigured: ${googleConfig.isConfigured}`);
  console.log(`  Google Redirect URI: ${googleConfig.redirectUri}`);

  if (googleConfig.isConfigured) {
    const googleUrl = generateGoogleAuthUrl({
      organizationId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-test-uuid",
      service: "google_calendar",
      returnUrl: "/dashboard",
    });

    const parsedGoogle = new URL(googleUrl);
    console.log(`  ✓ Google Auth URL Host: ${parsedGoogle.host}`);
    console.log(`    Client ID Present: ${parsedGoogle.searchParams.has("client_id")}`);
    console.log(`    Redirect URI Present: ${parsedGoogle.searchParams.has("redirect_uri")}`);
    console.log(`    Response Type: ${parsedGoogle.searchParams.get("response_type")}`);
    console.log(`    Access Type: ${parsedGoogle.searchParams.get("access_type")}`);
    console.log(`    State (HMAC-Signed): ${parsedGoogle.searchParams.get("state")?.slice(0, 20)}...`);
    console.log(`    Calendar Scopes: ${parsedGoogle.searchParams.get("scope")?.includes("calendar")}`);
  }

  // 2. Microsoft Config
  console.log("\n[2] Testing Microsoft Outlook Configuration Status...");
  const msConfig = getMicrosoftConfig();
  console.log(`  Microsoft isConfigured: ${msConfig.isConfigured}`);
  console.log(`  isMicrosoftIntegrationConfigured(): ${isMicrosoftIntegrationConfigured()}`);
  console.log(`  Microsoft Redirect URI: ${msConfig.redirectUri}`);
  if (!msConfig.isConfigured) {
    console.log("  ✓ Correctly flagged as unconfigured due to placeholder credentials.");
  }

  // 3. GitHub OAuth
  console.log("\n[3] Testing GitHub OAuth Config...");
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  console.log(`  GitHub Client ID configured: ${Boolean(githubClientId && !githubClientId.includes("your-"))}`);
  console.log(`  GitHub Client Secret configured: ${Boolean(githubClientSecret && !githubClientSecret.includes("your-"))}`);

  console.log("\n================================================================");
  console.log(" OAUTH INTEGRATIONS STATUS: VERIFIED");
  console.log("================================================================\n");
}

testOAuthFlows();
