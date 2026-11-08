/**
 * scripts/check-locale-parity.ts
 *
 * Canonical Quad-Locale Key Parity & Namespace Synchronization Validator.
 * Recursively verifies that all four dictionaries (en, pt, es, fr) have 100% key and structure parity.
 */

import { en } from '../lib/i18n/dictionaries/en';
import { pt } from '../lib/i18n/dictionaries/pt';
import { es } from '../lib/i18n/dictionaries/es';
import { fr } from '../lib/i18n/dictionaries/fr';

function extractKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys.push(...extractKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

console.log('==================================================================');
console.log('BUSINESSBRAIN: QUAD-LOCALE DICTIONARY KEY PARITY VALIDATOR');
console.log('==================================================================\n');

const enKeys = new Set(extractKeys(en));
const ptKeys = new Set(extractKeys(pt));
const esKeys = new Set(extractKeys(es));
const frKeys = new Set(extractKeys(fr));

console.log(`[1] Total Key Counts:`);
console.log(`  - English (en)    : ${enKeys.size} keys`);
console.log(`  - Portuguese (pt) : ${ptKeys.size} keys`);
console.log(`  - Spanish (es)    : ${esKeys.size} keys`);
console.log(`  - French (fr)     : ${frKeys.size} keys`);

const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k));
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));

const extraInPt = [...ptKeys].filter((k) => !enKeys.has(k));
const extraInEs = [...esKeys].filter((k) => !enKeys.has(k));
const extraInFr = [...frKeys].filter((k) => !enKeys.has(k));

let hasErrors = false;

if (missingInPt.length > 0 || extraInPt.length > 0) {
  hasErrors = true;
  console.error(`❌ Portuguese (pt) key discrepancy: Missing ${missingInPt.length}, Extra ${extraInPt.length}`);
} else {
  console.log(`  ✅ Portuguese (pt) matches English 100% (0 missing, 0 extra)`);
}

if (missingInEs.length > 0 || extraInEs.length > 0) {
  hasErrors = true;
  console.error(`❌ Spanish (es) key discrepancy: Missing ${missingInEs.length}, Extra ${extraInEs.length}`);
} else {
  console.log(`  ✅ Spanish (es) matches English 100% (0 missing, 0 extra)`);
}

if (missingInFr.length > 0 || extraInFr.length > 0) {
  hasErrors = true;
  console.error(`❌ French (fr) key discrepancy: Missing ${missingInFr.length}, Extra ${extraInFr.length}`);
} else {
  console.log(`  ✅ French (fr) matches English 100% (0 missing, 0 extra)`);
}

console.log('\n==================================================================');
if (!hasErrors) {
  console.log('🎉 SUCCESS: All 4 language dictionaries have 100% structural parity!');
  console.log('==================================================================');
  process.exit(0);
} else {
  console.error('❌ FAILURE: Translation key discrepancies detected.');
  console.log('==================================================================');
  process.exit(1);
}
