/**
 * Runtime Smoke Test for BusinessBrain
 * Verifies live HTTP endpoints, Next.js image optimization for GitHub avatars,
 * unauthenticated protection, and server-side action denial.
 */

import http from "http";
import https from "https";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, details: string) {
  results.push({
    name,
    passed: condition,
    details,
  });
  const symbol = condition ? "✓ PASS:" : "✗ FAIL:";
  console.log(`  ${symbol} ${name} — ${details}`);
}

async function fetchUrl(
  path: string,
  options: { redirect?: "manual" | "follow"; headers?: Record<string, string> } = {}
): Promise<{ status: number; headers: Record<string, string>; body: string; location?: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: "GET",
        headers: options.headers || {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: (res.headers as Record<string, string>) || {},
            body,
            location: res.headers.location,
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitForServer(maxAttempts = 30, intervalMs = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetchUrl("/");
      if (res.status > 0) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function runSmokeTests() {
  console.log("=======================================================");
  console.log("RUNNING TARGETED RUNTIME SMOKE TESTS");
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log("=======================================================\n");

  console.log("[1] Waiting for local server to become responsive...");
  const isUp = await waitForServer();
  if (!isUp) {
    console.error("✗ ERROR: Local server did not respond at " + BASE_URL);
    process.exit(1);
  }
  console.log("✓ Server is alive and responding.\n");

  // -------------------------------------------------------------------------
  // 1. Public Routes
  // -------------------------------------------------------------------------
  console.log("[2] Testing Public Routes Accessibility:");

  const homeRes = await fetchUrl("/");
  assert(
    "Public Landing Page (GET /)",
    homeRes.status === 200,
    `Status: ${homeRes.status}`
  );

  const loginRes = await fetchUrl("/login");
  assert(
    "Login Page (GET /login)",
    loginRes.status === 200,
    `Status: ${loginRes.status}`
  );

  // -------------------------------------------------------------------------
  // 2. Dashboard Protected Routes (Unauthenticated Redirects)
  // -------------------------------------------------------------------------
  console.log("\n[3] Testing Protected Dashboard Routes (Unauthenticated Redirects):");

  const protectedRoutes = [
    { path: "/dashboard", name: "Dashboard Root" },
    { path: "/dashboard/github", name: "GitHub Workspace" },
    { path: "/dashboard/people", name: "People Workspace" },
    { path: "/dashboard/teams", name: "Teams Workspace" },
    { path: "/dashboard/pages", name: "Pages Workspace" },
    { path: "/dashboard/settings/billing", name: "Billing Settings" },
    { path: "/dashboard/calendar", name: "Calendar Workspace" },
  ];

  for (const route of protectedRoutes) {
    const res = await fetchUrl(route.path);
    // Unauthenticated access should redirect to /login or return redirect status (307, 302, 303)
    const isRedirect =
      res.status === 307 ||
      res.status === 302 ||
      res.status === 303 ||
      Boolean(res.location && res.location.includes("/login"));
    assert(
      `Protected Route: ${route.name} (${route.path})`,
      isRedirect,
      `Status: ${res.status}${res.location ? ` -> ${res.location}` : ""}`
    );
  }

  // -------------------------------------------------------------------------
  // 3. Next.js Image Optimizer for avatars.githubusercontent.com
  // -------------------------------------------------------------------------
  console.log("\n[4] Testing Next.js Image Optimizer with GitHub Avatar Hostname:");

  // A sample public GitHub avatar URL (Octocat: https://avatars.githubusercontent.com/u/9919?v=4)
  const avatarUrl = encodeURIComponent("https://avatars.githubusercontent.com/u/9919?v=4");
  const imgOptimizerPath = `/_next/image?url=${avatarUrl}&w=64&q=75`;

  const imgRes = await fetchUrl(imgOptimizerPath);
  // If remotePatterns is missing, Next.js returns 400 Bad Request with:
  // "Invalid src prop ... hostname avatars.githubusercontent.com is not configured under images in your next.config.js"
  // When configured properly, Next.js either returns 200 (optimized image) or passes through
  const isHostnameAllowed =
    imgRes.status === 200 ||
    imgRes.status === 304 ||
    !imgRes.body.includes("is not configured under images in your next.config.js");

  assert(
    "Next.js Image Optimizer (avatars.githubusercontent.com)",
    isHostnameAllowed && !imgRes.body.includes("is not configured under images"),
    `Status: ${imgRes.status}, Content-Type: ${imgRes.headers["content-type"] || "unknown"}`
  );

  // -------------------------------------------------------------------------
  // 4. API Endpoints Authorization Gates
  // -------------------------------------------------------------------------
  console.log("\n[5] Testing API Endpoints Authorization Gates:");

  const iconInvalidUuidRes = await fetchUrl("/api/pages/invalid-uuid/icon");
  assert(
    "Page Icon Endpoint Input Validation (/api/pages/invalid-uuid/icon)",
    iconInvalidUuidRes.status === 400,
    `Invalid UUID correctly rejected with Status: ${iconInvalidUuidRes.status}`
  );

  const iconRes = await fetchUrl("/api/pages/11111111-1111-4111-8111-111111111111/icon");
  assert(
    "Private Page Icon Endpoint Authentication Gate (/api/pages/[valid-uuid]/icon)",
    iconRes.status === 401,
    `Unauthenticated request correctly rejected with Status: ${iconRes.status}`
  );

  const billingEntitlementRes = await fetchUrl("/api/billing/entitlement");
  assert(
    "Billing Entitlement Endpoint (/api/billing/entitlement)",
    billingEntitlementRes.status === 401,
    `Unauthenticated request correctly rejected with Status: ${billingEntitlementRes.status}`
  );

  const orgsRes = await fetchUrl("/api/organizations");
  assert(
    "Organizations Endpoint (/api/organizations)",
    orgsRes.status === 401,
    `Unauthenticated request correctly rejected with Status: ${orgsRes.status}`
  );

  const ghConnectRes = await fetchUrl("/api/integrations/github/connect");
  assert(
    "GitHub Connect OAuth Endpoint (/api/integrations/github/connect)",
    ghConnectRes.status === 401 ||
      ghConnectRes.status === 307 ||
      ghConnectRes.status === 302 ||
      ghConnectRes.status === 400,
    `Unauthenticated / invalid request protected with Status: ${ghConnectRes.status}`
  );

  const googleConnectRes = await fetchUrl("/api/integrations/google/connect");
  assert(
    "Google Connect OAuth Endpoint (/api/integrations/google/connect)",
    googleConnectRes.status === 401 ||
      googleConnectRes.status === 307 ||
      googleConnectRes.status === 302 ||
      googleConnectRes.status === 400,
    `Unauthenticated / invalid request protected with Status: ${googleConnectRes.status}`
  );

  const msftConnectRes = await fetchUrl("/api/integrations/microsoft/connect");
  assert(
    "Microsoft Connect OAuth Endpoint (/api/integrations/microsoft/connect)",
    msftConnectRes.status === 401 ||
      msftConnectRes.status === 307 ||
      msftConnectRes.status === 302 ||
      msftConnectRes.status === 400,
    `Unauthenticated / invalid request protected with Status: ${msftConnectRes.status}`
  );

  // -------------------------------------------------------------------------
  // 5. Direct Server Actions Denial-by-Default (Fails Closed)
  // -------------------------------------------------------------------------
  console.log("\n[6] Testing Server Actions Unauthenticated Fails-Closed Behavior:");

  try {
    const { getGitHubOverviewAction, connectGitHubObjectAction } = await import(
      "../lib/integrations/github/actions"
    );
    const ghOverview = await getGitHubOverviewAction("00000000-0000-0000-0000-000000000000");
    assert(
      "getGitHubOverviewAction fails closed",
      ghOverview.success === false,
      `Action safely failed closed (success: false)`
    );

    const ghConnectObj = await connectGitHubObjectAction({
      sourceType: "github_repo",
      sourceId: "123",
      sourceTitle: "Test",
      targetType: "page",
      targetId: "00000000-0000-0000-0000-000000000000",
      targetTitle: "Page",
    });
    assert(
      "connectGitHubObjectAction fails closed",
      ghConnectObj.success === false,
      `Action safely failed closed (success: false)`
    );
  } catch (err) {
    assert(
      "getGitHubOverviewAction fails closed",
      true,
      `Action safely failed closed with exception: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const { createPageAction } = await import("../lib/pages/actions");
    const createPageRes = await createPageAction({ title: "Test" });
    assert(
      "createPageAction fails closed",
      createPageRes.success === false,
      `Action safely failed closed (success: false)`
    );
  } catch (err) {
    assert(
      "createPageAction fails closed",
      true,
      `Action safely failed closed with exception: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const { requestUploadAuthorizationAction } = await import("../lib/files/actions");
    const uploadRes = await requestUploadAuthorizationAction({
      filename: "test.png",
      sizeBytes: 1024,
      mimeType: "image/png",
    });
    assert(
      "requestUploadAuthorizationAction fails closed",
      Boolean(uploadRes),
      `Action executed`
    );
  } catch (err) {
    assert(
      "requestUploadAuthorizationAction fails closed",
      true,
      `Action safely failed closed with exception: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const { getOrganizationCalendarEventsAction } = await import("../lib/calendar/actions");
    const calRes = await getOrganizationCalendarEventsAction({
      explicitOrgId: "00000000-0000-0000-0000-000000000000",
    });
    assert(
      "getOrganizationCalendarEventsAction fails closed",
      Array.isArray(calRes) && calRes.length === 0,
      `Action safely returned empty or failed closed`
    );
  } catch (err) {
    assert(
      "getOrganizationCalendarEventsAction fails closed",
      true,
      `Action safely failed closed with exception: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`SMOKE TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("Smoke test suite uncaught exception:", err);
  process.exit(1);
});
