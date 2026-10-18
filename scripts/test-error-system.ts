// ==============================================================================
// Test Error System Components (ErrorNotice & ErrorPanel)
// ==============================================================================

import React from "react";
import ReactDOMServer from "react-dom/server";
import { ErrorNotice, ErrorPanel } from "../components/ui/error-notice";

function testErrorSystem() {
  console.log("=== Testing Error System Components ===");

  // 1. Test ErrorNotice in Toast mode
  const toastHtml = ReactDOMServer.renderToString(
    React.createElement(ErrorNotice, {
      title: "Network synchronization failed",
      message: "Unable to sync changes to the server. Please check your connection.",
      digest: "ERR_NET_TIMEOUT_921",
      variant: "toast",
      onRetry: () => {},
      onDismiss: () => {},
    })
  );

  const toastChecks = [
    { name: "Toast title rendered", pass: toastHtml.includes("Network synchronization failed") },
    { name: "Toast message rendered", pass: toastHtml.includes("Unable to sync changes to the server") },
    { name: "Toast digest code rendered", pass: toastHtml.includes("ERR_NET_TIMEOUT_921") },
    { name: "Toast position bottom-6 left-6", pass: toastHtml.includes("bottom-6 left-6") },
    { name: "Toast retry button rendered", pass: toastHtml.includes("Try again") },
    { name: "Toast dismiss button rendered", pass: toastHtml.includes("Dismiss error notification") },
  ];

  for (const c of toastChecks) {
    if (c.pass) {
      console.log(`✓ ErrorNotice (Toast) - ${c.name}: PASS`);
    } else {
      console.error(`✗ ErrorNotice (Toast) - ${c.name}: FAIL`);
      process.exit(1);
    }
  }

  // 2. Test ErrorNotice in Inline mode
  const inlineHtml = ReactDOMServer.renderToString(
    React.createElement(ErrorNotice, {
      title: "Failed to load page blocks",
      message: "The document structure could not be retrieved.",
      variant: "inline",
      onRetry: () => {},
    })
  );

  const inlineChecks = [
    { name: "Inline title rendered", pass: inlineHtml.includes("Failed to load page blocks") },
    { name: "Inline message rendered", pass: inlineHtml.includes("The document structure could not be retrieved") },
    { name: "Inline retry button rendered", pass: inlineHtml.includes("Try again") },
  ];

  for (const c of inlineChecks) {
    if (c.pass) {
      console.log(`✓ ErrorNotice (Inline) - ${c.name}: PASS`);
    } else {
      console.error(`✗ ErrorNotice (Inline) - ${c.name}: FAIL`);
      process.exit(1);
    }
  }

  // 3. Test ErrorPanel
  const panelHtml = ReactDOMServer.renderToString(
    React.createElement(ErrorPanel, {
      title: "Unable to display this view",
      description: "A temporary network or server interruption occurred.",
      digest: "ERR_DIGEST_404_RED",
      showRefresh: true,
      showDashboardLink: true,
      onRetry: () => {},
    })
  );

  const panelChecks = [
    { name: "ErrorPanel title rendered", pass: panelHtml.includes("Unable to display this view") },
    { name: "ErrorPanel description rendered", pass: panelHtml.includes("A temporary network or server interruption occurred") },
    { name: "ErrorPanel digest code rendered", pass: panelHtml.includes("ERR_DIGEST_404_RED") },
    { name: "ErrorPanel 'Try again' button rendered", pass: panelHtml.includes("Try again") },
    { name: "ErrorPanel 'Refresh page' button rendered", pass: panelHtml.includes("Refresh page") },
    { name: "ErrorPanel 'Dashboard' button rendered", pass: panelHtml.includes("Dashboard") },
    { name: "ErrorPanel dark obsidian background rendered", pass: panelHtml.includes("bg-[#100a0d]/95") },
    { name: "ErrorPanel pure red highlight #ef4444 rendered", pass: panelHtml.includes("text-[#ef4444]") },
  ];

  for (const c of panelChecks) {
    if (c.pass) {
      console.log(`✓ ErrorPanel - ${c.name}: PASS`);
    } else {
      console.error(`✗ ErrorPanel - ${c.name}: FAIL`);
      process.exit(1);
    }
  }

  console.log("=== All Error System Tests Passed Successfully ===");
}

testErrorSystem();
