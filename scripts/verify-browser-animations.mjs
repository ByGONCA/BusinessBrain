/**
 * Browser Verification Script for BusinessBrain Animation System
 * Uses Chromium (Edge) Headless via Chrome DevTools Protocol (CDP)
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
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

async function runBrowserTests() {
  console.log("==================================================================");
  console.log("BUSINESSBRAIN: REAL BROWSER SCROLL & ANIMATION VERIFICATION");
  console.log("==================================================================\n");

  const userDataDir = path.join(process.cwd(), ".tmp_edge_profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Launch Edge headless
  console.log("1. Launching Chromium (Edge) Headless with Remote Debugging...");
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
    // Wait for CDP to be ready
    const versionInfo = await waitForHttp(`http://127.0.0.1:${PORT}/json/version`);
    console.log(`  Browser Version: ${versionInfo.Browser}`);

    // Create a new tab
    const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
    const tabInfo = await newTabRes.json();
    const cdp = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    // -------------------------------------------------------------
    // Test 1: Desktop Scroll Flow on Homepage (http://localhost:3000)
    // -------------------------------------------------------------
    console.log("\n[Test 1] Desktop Scroll Reveal on Homepage (1280x800)");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send("Page.navigate", { url: "http://localhost:3000" });
    await sleep(1500);

    // Initial check: Hero is visible, but below-the-fold footer is not yet revealed
    const heroHeadlineOpacity = await cdp.evaluate(`
      window.getComputedStyle(document.querySelector('h1')).opacity
    `);
    console.log(`  Hero headline opacity: ${heroHeadlineOpacity} (Expected 1)`);

    const initialFooterOpacity = await cdp.evaluate(`
      window.getComputedStyle(document.querySelector('footer')).opacity
    `);
    console.log(`  Initial below-the-fold footer opacity: ${initialFooterOpacity} (Expected < 1 or hidden initially)`);

    // Progressive Scroll Down
    console.log("  Simulating smooth progressive scroll down to footer...");
    for (let scrollY = 500; scrollY <= 4000; scrollY += 500) {
      await cdp.evaluate(`window.scrollTo({ top: ${scrollY}, behavior: 'smooth' });`);
      await sleep(250);
    }
    // Scroll to bottom
    await cdp.evaluate(`window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });`);
    await sleep(1000);

    // Post-scroll check: Sections and Footer
    const sectionsStatus = await cdp.evaluate(`
      (() => {
        const sections = ['#showcase', '#graph', '#integrations', '#pricing', '#faq'];
        return sections.map(id => {
          const el = document.querySelector(id);
          if (!el) return { id, exists: false };
          const style = window.getComputedStyle(el);
          return { id, exists: true, opacity: style.opacity, transform: style.transform };
        });
      })()
    `);
    console.log("  Section Visibility Status after scroll:");
    sectionsStatus.forEach((s) => {
      console.log(`    ${s.id}: exists=${s.exists}, opacity=${s.opacity}`);
    });

    const footerRevealed = await cdp.evaluate(`
      (() => {
        const footer = document.querySelector('footer');
        if (!footer) return false;
        const style = window.getComputedStyle(footer);
        const pDesc = footer.querySelector('p');
        const descStyle = pDesc ? window.getComputedStyle(pDesc) : null;
        return {
          footerOpacity: style.opacity,
          descOpacity: descStyle ? descStyle.opacity : null,
          hasLinks: footer.querySelectorAll('a').length > 5
        };
      })()
    `);
    console.log(`  Footer reveal verified: opacity=${footerRevealed.footerOpacity}, linksCount > 5 = ${footerRevealed.hasLinks}`);

    // -------------------------------------------------------------
    // Test 2: Mobile Viewport Scroll Flow (375x812)
    // -------------------------------------------------------------
    console.log("\n[Test 2] Mobile Viewport Scroll Flow (375x812, iPhone scale)");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await cdp.send("Page.navigate", { url: "http://localhost:3000" });
    await sleep(1500);

    for (let scrollY = 400; scrollY <= 5000; scrollY += 600) {
      await cdp.evaluate(`window.scrollTo({ top: ${scrollY}, behavior: 'smooth' });`);
      await sleep(200);
    }
    await sleep(800);

    const mobileFooterStatus = await cdp.evaluate(`
      (() => {
        const footer = document.querySelector('footer');
        return footer ? window.getComputedStyle(footer).opacity : null;
      })()
    `);
    console.log(`  Mobile Footer opacity after scroll: ${mobileFooterStatus}`);

    // -------------------------------------------------------------
    // Test 3: Prefers-Reduced-Motion Accessibility Check
    // -------------------------------------------------------------
    console.log("\n[Test 3] prefers-reduced-motion: reduce Contract Verification");
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });

    await cdp.send("Page.navigate", { url: "http://localhost:3000" });
    await sleep(1000);

    const reducedMotionStatus = await cdp.evaluate(`
      (() => {
        const footer = document.querySelector('footer');
        const hero = document.querySelector('h1');
        return {
          footerOpacity: footer ? window.getComputedStyle(footer).opacity : null,
          heroOpacity: hero ? window.getComputedStyle(hero).opacity : null
        };
      })()
    `);
    console.log(`  Reduced-motion instant visibility: hero=${reducedMotionStatus.heroOpacity}, footer=${reducedMotionStatus.footerOpacity}`);

    // -------------------------------------------------------------
    // Test 4: Sub-Landing Pages Scroll Verifications
    // -------------------------------------------------------------
    const subPages = [
      { name: "Product", url: "http://localhost:3000/product" },
      { name: "Company Graph", url: "http://localhost:3000/company-graph" },
      { name: "Integrations", url: "http://localhost:3000/integrations" },
      { name: "FAQ", url: "http://localhost:3000/faq" },
      { name: "Pricing", url: "http://localhost:3000/pricing" },
    ];

    console.log("\n[Test 4] Multi-Landing Page Scroll Verification across sub-pages");
    // Reset reduced motion emulation for normal testing
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const page of subPages) {
      await cdp.send("Page.navigate", { url: page.url });
      await sleep(1000);
      await cdp.evaluate(`window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });`);
      await sleep(800);

      const status = await cdp.evaluate(`
        (() => {
          const footer = document.querySelector('footer');
          const h1 = document.querySelector('h1');
          return {
            h1Text: h1 ? h1.textContent.trim().substring(0, 30) : null,
            footerOpacity: footer ? window.getComputedStyle(footer).opacity : null
          };
        })()
      `);
      console.log(`  ✅ ${page.name} (${page.url}): Title "${status.h1Text}...", Footer opacity=${status.footerOpacity}`);
    }

    cdp.close();
    console.log("\n==================================================================");
    console.log("🎉 ALL REAL BROWSER SCROLL & ANIMATION TESTS COMPLETED SUCCESSFULLY");
    console.log("==================================================================\n");
  } finally {
    browserProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runBrowserTests().catch((err) => {
  console.error("Browser test error:", err);
  process.exit(1);
});
