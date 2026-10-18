// ==============================================================================
// Test 404 Page Render & Assertions
// ==============================================================================

import React from "react";
import ReactDOMServer from "react-dom/server";

// Mock next/headers cookies
jest_mock_headers: {
  // We'll test both authenticated (cookie present) and unauthenticated (cookie absent)
}

async function run404Tests() {
  console.log("=== Testing Premium 404 Page Render ===");

  // Dynamically import NotFound component
  const { default: NotFound } = await import("../app/not-found");

  // 1. Render Component
  const jsx = await NotFound();
  const html = ReactDOMServer.renderToString(jsx);

  // 2. Assertions
  const checks = [
    { name: "Title 'Page not found' present", pass: html.includes("Page not found") },
    {
      name: "Description 'The page you were looking for does not exist or has moved.' present",
      pass: html.includes("The page you were looking for does not exist or has moved."),
    },
    { name: "Button 'Back to home' present", pass: html.includes("Back to home") },
    { name: "Dark obsidian background present", pass: html.includes("bg-[#080607]") },
    { name: "Pure red text styling #ef4444 present", pass: html.includes("#ef4444") },
    { name: "Pill button styling present", pass: html.includes("rounded-full") },
    { name: "Canvas container present", pass: html.includes("<canvas") },
    { name: "Mobile layout present", pass: html.includes("sm:hidden") },
    { name: "Desktop layout present", pass: html.includes("hidden sm:flex") },
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.pass) {
      console.log(`✓ ${check.name}: PASS`);
    } else {
      console.error(`✗ ${check.name}: FAIL`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error("Some 404 checks failed!");
    process.exit(1);
  }

  console.log("=== All 404 Assertions Passed Successfully ===");
}

run404Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
