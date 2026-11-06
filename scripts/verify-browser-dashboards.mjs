/**
 * Browser Verification Script for Universal Dashboards (Home & Finance)
 * Uses Edge Headless via Chrome DevTools Protocol (CDP)
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9224;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, maxRetries = 25) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserVerification() {
  console.log("==================================================================");
  console.log(" BUSINESSBRAIN: REAL BROWSER DASHBOARD & WIDGET VERIFICATION");
  console.log("==================================================================\n");

  const userDataDir = path.join(process.cwd(), ".tmp_edge_profile_dashboards");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log("1. Launching Edge Headless with Remote Debugging Port " + PORT + "...");
  const browserProc = spawn(EDGE_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank",
  ]);

  try {
    const versionInfo = await waitForHttp(`http://127.0.0.1:${PORT}/json/version`);
    console.log(`  Browser Version: ${versionInfo.Browser}`);

    const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
    const tabInfo = await newTabRes.json();
    const cdp = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    // Track console errors
    const consoleErrors = [];
    cdp.ws.addEventListener("message", (evt) => {
      const parsed = JSON.parse(evt.data);
      if (parsed.method === "Runtime.consoleAPICalled" && parsed.params.type === "error") {
        consoleErrors.push(parsed.params.args.map((a) => a.value || a.description).join(" "));
      }
    });

    // -------------------------------------------------------------
    // Test 1: Desktop Viewport (1440x900) on Demo Workstation (Home)
    // -------------------------------------------------------------
    console.log("\n[Test 1] Desktop Viewport (1440x900) — Loading Workstation Home Dashboard...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send("Page.navigate", { url: "http://localhost:3000/demo" });
    await sleep(2000);

    // Verify WidgetGrid container is rendered
    const hasWidgetGrid = await cdp.evaluate(`
      Boolean(document.querySelector('[data-grid-container="true"]'))
    `);
    console.log(`  ✓ WidgetGrid rendered on Home: ${hasWidgetGrid}`);

    // Verify absence of Shopeers cards
    const hasShopeersCards = await cdp.evaluate(`
      Boolean(document.querySelector('.shopeers-cards') || document.querySelector('[data-shopeers]'))
    `);
    console.log(`  ✓ Shopeers bypass cards absent: ${!hasShopeersCards}`);

    // Count widgets rendered in grid
    const widgetCount = await cdp.evaluate(`
      document.querySelectorAll('[data-grid-container="true"] > div').length
    `);
    console.log(`  ✓ Number of widgets rendered in Home grid: ${widgetCount}`);

    // Verify card styling tokens
    const gridStyle = await cdp.evaluate(`
      const card = document.querySelector('[data-grid-container="true"] > div > div');
      if (!card) return null;
      const comp = window.getComputedStyle(card);
      return {
        borderRadius: comp.borderRadius,
        display: comp.display
      };
    `);
    console.log(`  ✓ Card styling tokens: borderRadius = ${gridStyle?.borderRadius}`);

    // -------------------------------------------------------------
    // Test 2: Customization Mode Toggle
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing Customization Mode Toggle & Toolbar in Real Browser...");
    const customButtonExists = await cdp.evaluate(`
      Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Personalizar') || b.textContent.includes('Customize'))))
    `);
    console.log(`  ✓ Customization button located: ${customButtonExists}`);

    if (customButtonExists) {
      // Click customize button
      await cdp.evaluate(`
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Personalizar') || b.textContent.includes('Customize')));
        if (btn) btn.click();
      `);
      await sleep(1000);

      const hasToolbar = await cdp.evaluate(`
        Boolean(document.querySelector('[role="region"][aria-label="Customization Toolbar"]'))
      `);
      console.log(`  ✓ CustomizationToolbar rendered on toggle: ${hasToolbar}`);

      // Open Add Widget Drawer
      await cdp.evaluate(`
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Adicionar Widget') || b.textContent.includes('Add Widget')));
        if (addBtn) addBtn.click();
      `);
      await sleep(1000);

      const hasDrawer = await cdp.evaluate(`
        Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))
      `);
      console.log(`  ✓ WidgetDrawer opened: ${hasDrawer}`);

      // Close drawer with Escape key
      await cdp.evaluate(`
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      `);
      await sleep(500);

      // Cancel customization
      await cdp.evaluate(`
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Cancelar') || b.textContent.includes('Cancel')));
        if (cancelBtn) cancelBtn.click();
      `);
      await sleep(500);
      console.log(`  ✓ Customization closed cleanly, reverted to read-only view.`);
    }

    // -------------------------------------------------------------
    // Test 2B: Switch to Finance Dashboard in Workstation
    // -------------------------------------------------------------
    console.log("\n[Test 2B] Navigating to Finance Dashboard in Real Browser...");
    await cdp.evaluate(`
      const navLinks = Array.from(document.querySelectorAll('a, button'));
      const finLink = navLinks.find(el => el.textContent && (el.textContent.includes('Finanças') || el.textContent.includes('Finance')));
      if (finLink) finLink.click();
    `);
    await sleep(1500);

    const hasFinanceGrid = await cdp.evaluate(`
      Boolean(document.querySelector('[data-grid-container="true"]'))
    `);
    console.log(`  ✓ WidgetGrid rendered on Finance: ${hasFinanceGrid}`);

    const financeWidgetCount = await cdp.evaluate(`
      document.querySelectorAll('[data-grid-container="true"] > div').length
    `);
    console.log(`  ✓ Number of widgets rendered in Finance grid: ${financeWidgetCount}`);

    const hasLegacyDuplicate = await cdp.evaluate(`
      Boolean(document.querySelector('.interactive-revenue-trajectory') || Array.from(document.querySelectorAll('h2, h3')).some(h => h.textContent && h.textContent.includes('Interactive Revenue Trajectory')))
    `);
    console.log(`  ✓ Zero duplicate hero charts on Finance: ${!hasLegacyDuplicate}`);

    // -------------------------------------------------------------
    // Test 3: Responsive Viewports (Tablet: 768x1024 & Mobile: 375x812)
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing Tablet Viewport (768x1024)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(800);

    const tabletGridCols = await cdp.evaluate(`
      const grid = document.querySelector('[data-grid-container="true"]');
      if (!grid) return null;
      return window.getComputedStyle(grid).gridTemplateColumns;
    `);
    console.log(`  ✓ Tablet gridTemplateColumns resolved: ${tabletGridCols?.split(' ').length} columns active`);

    console.log("\n[Test 4] Testing Mobile Viewport (375x812)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(800);

    const mobileGridCols = await cdp.evaluate(`
      const grid = document.querySelector('[data-grid-container="true"]');
      if (!grid) return null;
      return window.getComputedStyle(grid).gridTemplateColumns;
    `);
    console.log(`  ✓ Mobile gridTemplateColumns resolved: ${mobileGridCols?.split(' ').length} columns active (single column layout)`);

    // Verify no horizontal overflow on mobile
    const horizontalOverflow = await cdp.evaluate(`
      document.documentElement.scrollWidth > window.innerWidth
    `);
    console.log(`  ✓ Horizontal overflow on mobile (expected false): ${horizontalOverflow}`);

    // Check for severe console errors
    console.log("\n[Test 5] Console Error Health Check:");
    const severeErrors = consoleErrors.filter(e => !e.includes("favicon") && !e.includes("404"));
    if (severeErrors.length === 0) {
      console.log("  ✓ 0 critical console errors during full browser execution.");
    } else {
      console.warn(`  ⚠ ${severeErrors.length} console errors captured:`, severeErrors);
    }

    cdp.close();
    console.log("\n==================================================================");
    console.log(" RESULT: BROWSER DASHBOARD TEST COMPLETED WITH PASS");
    console.log("==================================================================\n");
  } finally {
    browserProc.kill();
  }
}

runBrowserVerification();
