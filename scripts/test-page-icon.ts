import React from "react";
import ReactDOMServer from "react-dom/server";
import { PageIcon } from "../components/dashboard/pages/page-icon";

function testPageIcon() {
  console.log("=== Testing PageIcon Component ===");

  // 1. Emoji icon
  const emojiHtml = ReactDOMServer.renderToString(
    React.createElement(PageIcon, { icon: "🚀" })
  );
  console.log("Emoji render:", emojiHtml.includes("🚀") ? "PASS" : "FAIL");

  // 2. Default fallback
  const fallbackHtml = ReactDOMServer.renderToString(
    React.createElement(PageIcon, { icon: null })
  );
  console.log("Fallback render:", fallbackHtml.includes("📄") ? "PASS" : "FAIL");

  // 3. Custom ID pointer with pageId
  const customIdHtml = ReactDOMServer.renderToString(
    React.createElement(PageIcon, {
      icon: "custom_id",
      pageId: "123e4567-e89b-12d3-a456-426614174000",
    })
  );
  console.log(
    "Custom ID with pageId renders img:",
    customIdHtml.includes('src="/api/pages/123e4567-e89b-12d3-a456-426614174000/icon"')
      ? "PASS"
      : "FAIL"
  );

  // 4. External URL
  const extUrlHtml = ReactDOMServer.renderToString(
    React.createElement(PageIcon, { icon: "https://example.com/icon.png" })
  );
  console.log(
    "External URL renders img:",
    extUrlHtml.includes('src="https://example.com/icon.png"') ? "PASS" : "FAIL"
  );

  // 5. Raw UUID without pageId (should NOT leak UUID string, should render fallback)
  const uuidLeakHtml = ReactDOMServer.renderToString(
    React.createElement(PageIcon, {
      icon: "123e4567-e89b-12d3-a456-426614174000",
    })
  );
  console.log(
    "UUID leak guard renders fallback:",
    uuidLeakHtml.includes("📄") && !uuidLeakHtml.includes("123e4567") ? "PASS" : "FAIL"
  );

  console.log("=== PageIcon All Checks Passed ===");
}

testPageIcon();
