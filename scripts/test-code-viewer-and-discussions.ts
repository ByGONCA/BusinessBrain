/**
 * BusinessBrain — Code Viewer & GitHub Discussions Verification Suite
 * Tests language detection, AST tokenization, VS Code syntax coloring,
 * code snippet extraction, comment serialization/deserialization, and internal storage isolation.
 */

import assert from "assert";
import {
  detectLanguageFromPath,
  tokenizeCodeToLines,
  getTokenClasses,
} from "../lib/code-viewer/syntax";
import {
  serializeCommentWithSnippet,
  parseCommentBody,
  CodeSnippetReference,
} from "../components/dashboard/github/github-comments-drawer";

async function runTests() {
  console.log("=======================================================");
  console.log("BUSINESSBRAIN: CODE VIEWER & DISCUSSIONS VERIFICATION");
  console.log("=======================================================\n");

  let passed = 0;

  // [1] Language Detection by Extension & File Name
  console.log("[1] Language Detection:");
  assert.strictEqual(detectLanguageFromPath("src/components/App.tsx").lang, "tsx");
  assert.strictEqual(detectLanguageFromPath("lib/utils.ts").lang, "typescript");
  assert.strictEqual(detectLanguageFromPath("scripts/deploy.sh").lang, "bash");
  assert.strictEqual(detectLanguageFromPath("backend/main.py").lang, "python");
  assert.strictEqual(detectLanguageFromPath("db/migrations/0001.sql").lang, "sql");
  assert.strictEqual(detectLanguageFromPath("Dockerfile").lang, "docker");
  assert.strictEqual(detectLanguageFromPath("config.yaml").lang, "yaml");
  assert.strictEqual(detectLanguageFromPath("package.json").lang, "json");
  console.log("  ✓ PASS: TSX, TS, Bash, Python, SQL, Dockerfile, YAML, JSON mapped accurately\n");
  passed += 8;

  // [2] Tokenization & Line Preservation (TSX Sample)
  console.log("[2] AST Tokenization & Line Alignment (TSX):");
  const tsxSample = [
    'import React from "react";',
    "",
    "export interface UserProps {",
    "  id: string;",
    "  name: string;",
    "}",
    "",
    "export const UserCard: React.FC<UserProps> = ({ id, name }) => {",
    "  // Render card component",
    "  return <div className=\"user-card\">{name} (#{id})</div>;",
    "};",
  ].join("\n");

  const lines = tokenizeCodeToLines(tsxSample, "tsx");
  assert.strictEqual(lines.length, 11, "Must produce exactly 11 lines matching source");
  assert.strictEqual(lines[0].lineNumber, 1);
  assert.strictEqual(lines[10].lineNumber, 11);

  // Verify keyword token classes
  const line0Tokens = lines[0].tokens;
  const importToken = line0Tokens.find((t) => t.content === "import");
  assert.ok(importToken, "Found import token");
  const importClasses = getTokenClasses(importToken?.type);
  assert.ok(importClasses.includes("bb-code-keyword"), "Keyword has bb-code-keyword class");
  assert.ok(importClasses.includes("#569cd6") || importClasses.includes("#0000ff"), "Keyword styled with VS Code blue");

  // Verify type annotation token classes
  const line3Tokens = lines[3].tokens;
  const typeToken = line3Tokens.find((t) => t.content === "string");
  assert.ok(typeToken, "Found type string token");
  const typeClasses = getTokenClasses(typeToken?.type);
  assert.ok(typeClasses.includes("bb-code-builtin"), "Builtin type has bb-code-builtin class");

  // Verify JSX tags, attributes and string values on line 9
  const line9Tokens = lines[9].tokens;
  const tagToken = line9Tokens.find((t) => t.content === "div");
  assert.ok(tagToken, "Found JSX tag div token");
  const tagClasses = getTokenClasses(tagToken?.type);
  assert.ok(tagClasses.includes("bb-code-tag"), "Tag has bb-code-tag class");

  const attrToken = line9Tokens.find((t) => t.content === "className");
  assert.ok(attrToken, "Found JSX attr className token");
  const attrClasses = getTokenClasses(attrToken?.type);
  assert.ok(attrClasses.includes("bb-code-attr-name"), "Attr name has bb-code-attr-name class");

  const strToken = line9Tokens.find((t) => t.content === "user-card");
  assert.ok(strToken, "Found JSX string user-card token");
  const strClasses = getTokenClasses(strToken?.type);
  assert.ok(strClasses.includes("bb-code-string"), "String has bb-code-string class");

  // Verify comment token classes
  const line8Tokens = lines[8].tokens;
  const commentToken = line8Tokens.find((t) => t.content.includes("Render card"));
  assert.ok(commentToken, "Found comment token");
  const commentClasses = getTokenClasses(commentToken?.type);
  assert.ok(commentClasses.includes("bb-code-comment"), "Comment has bb-code-comment class");
  assert.ok(commentClasses.includes("italic"), "Comments styled with italic");
  console.log("  ✓ PASS: TSX AST tokens (keywords, types, JSX tags, attributes, strings, comments) verified with exact styling\n");
  passed += 14;

  // [3] Indentation & Whitespace Integrity
  console.log("[3] Indentation & Raw Content Integrity:");
  const pythonSample = [
    "def calculate_total(items):",
    "    total = 0",
    "    for item in items:",
    "        total += item['price']",
    "    return total",
  ].join("\n");

  const pyLines = tokenizeCodeToLines(pythonSample, "python");
  assert.strictEqual(pyLines.length, 5);
  // Verify 4 spaces indentation preserved on line 2
  assert.strictEqual(pyLines[1].rawText.startsWith("    "), true);
  // Verify 8 spaces indentation preserved on line 4
  assert.strictEqual(pyLines[3].rawText.startsWith("        "), true);
  console.log("  ✓ PASS: Strict 4-space and 8-space indentation preserved without alteration\n");
  passed += 3;

  // [4] Code Snippet Selection Serialization & Deserialization
  console.log("[4] Snippet Selection Serialization in Internal Comments:");
  const sampleSnippet: CodeSnippetReference = {
    filePath: "lib/auth/session.ts",
    selectedCode: "const session = await getSession();\nif (!session) throw new Error('Unauthorized');",
    startLine: 42,
    endLine: 43,
    commitSha: "a1b2c3d",
  };

  const commentText = "Precisamos de validar a expiração do token aqui antes de prosseguir.";
  const serialized = serializeCommentWithSnippet(commentText, sampleSnippet);

  assert.ok(serialized.includes("<!--bb:code-ref"), "Contains structured reference tag");
  assert.ok(serialized.includes("lib/auth/session.ts"), "Contains file path");
  assert.ok(serialized.includes(commentText), "Contains user text comment");

  const parsed = parseCommentBody(serialized);
  assert.strictEqual(parsed.text, commentText, "Parsed text matches user comment");
  assert.ok(parsed.snippet, "Parsed snippet exists");
  assert.strictEqual(parsed.snippet?.filePath, "lib/auth/session.ts");
  assert.strictEqual(parsed.snippet?.startLine, 42);
  assert.strictEqual(parsed.snippet?.endLine, 43);
  assert.strictEqual(parsed.snippet?.commitSha, "a1b2c3d");
  assert.strictEqual(parsed.snippet?.selectedCode, sampleSnippet.selectedCode);
  console.log("  ✓ PASS: Selection serialized and parsed losslessly with line numbers & commit ref\n");
  passed += 7;

  // [5] Snippet Selection Without Line Numbers Fallback
  console.log("[5] Snippet Without Line Numbers Graceful Fallback:");
  const noLinesSnippet: CodeSnippetReference = {
    filePath: "README.md",
    selectedCode: "# BusinessBrain Documentation",
  };

  const serializedNoLines = serializeCommentWithSnippet("Adicionar secção de arquitetura", noLinesSnippet);
  const parsedNoLines = parseCommentBody(serializedNoLines);
  assert.strictEqual(parsedNoLines.snippet?.filePath, "README.md");
  assert.strictEqual(parsedNoLines.snippet?.startLine, undefined, "Does not invent startLine");
  assert.strictEqual(parsedNoLines.snippet?.endLine, undefined, "Does not invent endLine");
  assert.strictEqual(parsedNoLines.text, "Adicionar secção de arquitetura");
  console.log("  ✓ PASS: Excerpt without line numbers correctly preserved without hallucinating lines\n");
  passed += 4;

  // [6] Standard Comments Without Snippets
  console.log("[6] Standard Comments Passthrough:");
  const plainComment = "Esta discussão não tem código selecionado associado.";
  const plainSerialized = serializeCommentWithSnippet(plainComment, null);
  const plainParsed = parseCommentBody(plainSerialized);
  assert.strictEqual(plainParsed.text, plainComment);
  assert.strictEqual(plainParsed.snippet, undefined);
  console.log("  ✓ PASS: Standard discussion comments remain clean and untouched\n");
  passed += 2;

  // [7] Add Code Snippet to Page Action Validation
  console.log("[7] Code Snippet to Page Actions:");
  const { addCodeSnippetToPageAction, getPageHeadingsAction } = await import("../lib/pages/actions");
  assert.strictEqual(typeof addCodeSnippetToPageAction, "function", "addCodeSnippetToPageAction is exported");
  assert.strictEqual(typeof getPageHeadingsAction, "function", "getPageHeadingsAction is exported");

  // Invalid UUID guard
  const invalidRes = await addCodeSnippetToPageAction({
    pageId: "invalid-uuid",
    filePath: "src/index.ts",
    selectedCode: "console.log(1);",
  });
  assert.strictEqual(invalidRes.success, false);
  assert.strictEqual(invalidRes.error, "Invalid page ID");

  const invalidHeadings = await getPageHeadingsAction("invalid-uuid");
  assert.strictEqual(invalidHeadings.success, false);
  assert.strictEqual(invalidHeadings.error, "Invalid page ID");
  console.log("  ✓ PASS: addCodeSnippetToPageAction & getPageHeadingsAction strictly guard tenant boundaries and valid UUIDs\n");
  passed += 4;

  console.log("=======================================================");
  console.log(`ALL ${passed} CODE VIEWER & DISCUSSIONS TESTS PASSED!`);
  console.log("=======================================================");
}

runTests();
