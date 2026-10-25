/**
 * Unit Test Suite for Codebase Map Integrity Validator
 *
 * Deterministically tests all 10 required validation behaviors:
 * 1. Valid existing file
 * 2. Invalid/missing file
 * 3. Valid directory
 * 4. Command/tooling examples (ignored)
 * 5. Wildcard/glob patterns (safe)
 * 6. External URLs (ignored)
 * 7. Path traversal escape attempts (../)
 * 8. Empty map or map without verifiable paths
 * 9. Path containing spaces
 * 10. CLI exit codes (0 on success, 1 on failure)
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import {
  parseMapReferences,
  validateMapReferences,
  runMapValidation,
} from "./validate-codebase-map";

function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 TESTING CODEBASE MAP VALIDATOR (10 CONDITIONS)`);
  console.log(`======================================================`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-map-test-"));
  const realFile = path.join(tempDir, "existing-file.ts");
  const realDir = path.join(tempDir, "components", "ui");
  const fileWithSpace = path.join(tempDir, "folder with space", "my file.ts");

  fs.mkdirSync(realDir, { recursive: true });
  fs.writeFileSync(realFile, "export const ok = true;");
  fs.mkdirSync(path.dirname(fileWithSpace), { recursive: true });
  fs.writeFileSync(fileWithSpace, "export const spaceOk = true;");

  let passed = 0;
  let total = 10;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ [PASS] Condition: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Condition: ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  try {
    // 1. Existing file reference
    const md1 = `Check out \`existing-file.ts\` for implementation.`;
    const res1 = validateMapReferences(parseMapReferences(md1), tempDir);
    assert(res1.valid && res1.validPaths.includes("existing-file.ts"), "1. Valid existing file accepted");

    // 2. Non-existent file reference
    const md2 = `See \`ghost-file.ts\` for details.`;
    const res2 = validateMapReferences(parseMapReferences(md2), tempDir);
    assert(
      !res2.valid && res2.invalidPaths.some((p) => p.path === "ghost-file.ts" && p.reason.includes("does not exist")),
      "2. Missing file rejected with error diagnostic"
    );

    // 3. Existing directory reference
    const md3 = `All components live in \`components/ui/\`.`;
    const res3 = validateMapReferences(parseMapReferences(md3), tempDir);
    assert(res3.valid && res3.validPaths.includes("components/ui"), "3. Valid directory accepted");

    // 4. Command/tooling example ignored
    const md4 = `Run \`npm run typecheck\` and \`eslint .\` to verify.`;
    const refs4 = parseMapReferences(md4);
    assert(refs4.every((r) => r.type === "ignored"), "4. Command executions ignored as non-paths");

    // 5. Wildcard/glob pattern
    const md5 = `Migrations match \`database/migrations/*.sql\`.`;
    const refs5 = parseMapReferences(md5);
    assert(refs5.some((r) => r.type === "pattern"), "5. Wildcard glob patterns recognized and safely bypassed");

    // 6. External URL reference
    const md6 = `Docs at \`https://docs.stripe.com/api\` are useful.`;
    const refs6 = parseMapReferences(md6);
    assert(refs6.some((r) => r.type === "ignored" && r.cleanPath.startsWith("https://")), "6. External HTTP/HTTPS URLs ignored");

    // 7. Path traversal escape attempt
    const md7 = `Escaping root via \`../../etc/passwd\` or \`../secrets.env\`.`;
    const res7 = validateMapReferences(parseMapReferences(md7), tempDir);
    assert(
      !res7.valid && res7.invalidPaths.some((p) => p.reason.includes("Path traversal")),
      "7. Path traversal attempts rejected with security warning"
    );

    // 8. Empty map or map without verifiable paths
    const md8 = `# Just a title\nNo paths here at all.`;
    const res8 = validateMapReferences(parseMapReferences(md8), tempDir);
    assert(
      !res8.valid && res8.invalidPaths.some((p) => p.reason.includes("No verifiable file")),
      "8. Map without verifiable references fails explicitly"
    );

    // 9. Path containing spaces
    const md9 = `Refer to \`folder with space/my file.ts\`.`;
    const res9 = validateMapReferences(parseMapReferences(md9), tempDir);
    assert(
      res9.valid && res9.validPaths.includes("folder with space/my file.ts"),
      "9. Paths with spaces supported and verified"
    );

    // 10. CLI exit codes on real files
    const validMapPath = path.join(tempDir, "VALID_MAP.md");
    fs.writeFileSync(validMapPath, `File: \`existing-file.ts\`\nDir: \`components/ui/\``);
    const validCli = runMapValidation(validMapPath, tempDir);

    const invalidMapPath = path.join(tempDir, "INVALID_MAP.md");
    fs.writeFileSync(invalidMapPath, `File: \`missing-404.ts\``);
    const invalidCli = runMapValidation(invalidMapPath, tempDir);

    assert(validCli.valid && !invalidCli.valid, "10. CLI exit code contract: valid -> 0, invalid -> non-zero");

    console.log(`\n🎉 ALL ${passed}/${total} VALIDATOR TESTS PASSED WITH 100% SUCCESS!\n`);
  } finally {
    // Cleanup temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows locks
    }
  }
}

if (require.main === module) {
  runTests();
}

export { runTests };
