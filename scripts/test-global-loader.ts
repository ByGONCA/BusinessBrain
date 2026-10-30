import assert from "node:assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessBrainLoader, CompanyBrainLoader } from "../components/ui/company-brain-loader";
import { LanguageProvider } from "../lib/i18n/context";

console.log("=== Testing BusinessBrain Global Loader Redesign ===");

// Test 1: Export Parity & Backward Compatibility
assert.strictEqual(
  BusinessBrainLoader,
  CompanyBrainLoader,
  "BusinessBrainLoader and CompanyBrainLoader must reference the same component"
);
console.log("Export parity: PASS");

// Test 2: FullScreen Render & Theme Compliance
{
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(BusinessBrainLoader, { fullScreen: true })
    )
  );

  // Background must be adaptive semantic token bg-background, NOT hardcoded bg-slate-950
  assert(html.includes("bg-background"), "Must use semantic bg-background token");
  assert(html.includes("text-foreground"), "Must use semantic text-foreground token");
  assert(!html.includes("bg-slate-950"), "Must NOT contain hardcoded dark bg-slate-950");
  assert(!html.includes("text-slate-100"), "Must NOT contain hardcoded text-slate-100");
  assert(!html.includes("text-slate-400"), "Must NOT contain hardcoded text-slate-400");
  console.log("Semantic theme tokens (bg-background, text-foreground): PASS");

  // Removed static logo wordmark and static card box
  assert(!html.includes("Company Brain"), "Must NOT display outdated 'Company Brain'");
  assert(!html.includes("shadow-2xs"), "Must NOT contain static logo card container");
  console.log("Removed static logo box and static title: PASS");

  // Canonical 3-Node Connected Network Icon Spinning Directly
  assert(html.includes("viewBox=\"0 0 24 24\""), "Must contain canonical logo SVG");
  assert(html.includes("cx=\"6\""), "Must contain node 1 (cx=6)");
  assert(html.includes("cx=\"18\""), "Must contain node 2 (cx=18)");
  assert(html.includes("cx=\"12\""), "Must contain node 3 (cx=12)");
  assert(html.includes("animate-spin"), "Brand icon must have animate-spin directly on it");
  console.log("Canonical 3-node connected network icon animated with animate-spin: PASS");

  // Accessibility & Motion Reduction
  assert(html.includes("role=\"status\""), "Must have role='status'");
  assert(html.includes("aria-live=\"polite\""), "Must have aria-live='polite'");
  assert(html.includes("aria-busy=\"true\""), "Must have aria-busy='true'");
  assert(html.includes("sr-only"), "Must have screen-reader announcer");
  assert(html.includes("motion-reduce:animate-none"), "Must support prefers-reduced-motion");
  console.log("Accessibility & prefers-reduced-motion: PASS");

  // Default localized string in sr-only
  assert(html.includes("Loading..."), "Default English locale renders 'Loading...' in sr-only");
  console.log("Default localized status in screen-reader announcer: PASS");
}

// Test 3: Custom Text Override
{
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(BusinessBrainLoader, { fullScreen: false, text: "A sincronizar workspace..." })
    )
  );

  assert(html.includes("A sincronizar workspace..."), "Renders custom text override correctly");
  assert(!html.includes("min-h-screen"), "Non-fullScreen does not enforce min-h-screen");
  console.log("Custom text override & non-fullscreen container: PASS");
}

// Test 4: SSR Safety Outside Provider (Fallback Graceful Degradation)
{
  const html = renderToStaticMarkup(
    React.createElement(BusinessBrainLoader, { fullScreen: false })
  );

  assert(html.includes("animate-spin"), "Renders spinning icon safely outside LanguageProvider");
  assert(html.includes("Loading..."), "Falls back safely to 'Loading...' in sr-only outside LanguageProvider");
  console.log("SSR / isolated execution safety: PASS");
}

console.log("\n=== ALL GLOBAL LOADER TESTS PASSED ===");
