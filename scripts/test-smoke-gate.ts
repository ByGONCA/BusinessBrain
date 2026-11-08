/**
 * scripts/test-smoke-gate.ts
 *
 * Fast Pre-Integration Smoke Gate.
 * Runs key representative domain suites in < 30 seconds for rapid pre-commit validation.
 */

import { execSync } from 'child_process';

interface SmokeSuite {
  name: string;
  command: string;
}

const suites: SmokeSuite[] = [
  {
    name: 'UI / Animation System',
    command: 'npx tsx scripts/test-animation-system.ts',
  },
  {
    name: 'Workspace & Pages State Machine',
    command: 'npx tsx scripts/test-pages-workspace.ts',
  },
  {
    name: 'Billing Reconciliation & Multi-Currency',
    command: 'npx tsx scripts/test-billing-reconciliation.ts',
  },
  {
    name: 'Public API Security Guard',
    command: 'npx tsx scripts/test-public-api-disabled.ts',
  },
  {
    name: 'Corporate Finance & i18n Quad-Locale',
    command: 'npx tsx scripts/test-corporate-finance-ui-i18n.ts',
  },
];

console.log('==================================================================');
console.log('BUSINESSBRAIN: FAST PRE-INTEGRATION SMOKE GATE');
console.log('==================================================================\n');

const startTime = Date.now();
let passed = 0;
let failed = 0;

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i];
  const stepStart = Date.now();
  process.stdout.write(`[${i + 1}/${suites.length}] Running ${suite.name} ... `);

  try {
    execSync(suite.command, { stdio: 'pipe', encoding: 'utf8' });
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(2);
    console.log(`✅ PASSED (${elapsed}s)`);
    passed++;
  } catch (err: any) {
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(2);
    console.log(`❌ FAILED (${elapsed}s)`);
    console.error(err.stdout || err.stderr || err.message);
    failed++;
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('\n==================================================================');
console.log(`SMOKE GATE SUMMARY: ${passed}/${suites.length} Passed, ${failed} Failed in ${totalElapsed}s`);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Smoke gate verification clean! Ready for pre-integration gate.');
  process.exit(0);
}
