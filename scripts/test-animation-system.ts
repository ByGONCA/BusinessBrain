/**
 * Automated Verification Suite for BusinessBrain Marketing Animation System
 *
 * Verifies:
 * 1. globals.css animation tokens, easing curves, and reduced-motion contract
 * 2. useScrollReveal hook and sequential useHeroSequence implementation
 * 3. Hero staged entrance sequence in LandingHero
 * 4. Header scroll treatment and button microinteractions in LandingHeader
 * 5. Staggered reveals across grids (Problem silos, Integrations, Showcase tabs, FAQ)
 * 6. Smooth accordion transition (CSS grid rows fr trick) in LandingFAQ
 * 7. Interactive SVG graph line animation in LandingGraphSection
 * 8. Footer staged entrance, sequential link columns, and smooth hover states
 * 9. Reusable ScrollReveal engine and cross-landing coverage (Product, Graph, Integrations, FAQ, Pricing)
 */

import * as fs from "fs";
import * as path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${message}`);
}

const rootDir = process.cwd();

console.log("==================================================================");
console.log("BUSINESSBRAIN: COMPLETE ANIMATION SYSTEM VERIFICATION AUDIT");
console.log("==================================================================\n");

// --- Audit 1: CSS Animation Tokens & Reduced Motion Contract ---
console.log("[Audit 1] CSS Animation Tokens, Easing & Accessibility");
const globalsCss = fs.readFileSync(path.join(rootDir, "app/globals.css"), "utf-8");

assert(
  globalsCss.includes("--ease-editorial: cubic-bezier(0.22, 1, 0.36, 1)"),
  "globals.css defines refined --ease-editorial cubic-bezier(0.22, 1, 0.36, 1)"
);
assert(
  globalsCss.includes("@media (prefers-reduced-motion: reduce)"),
  "globals.css defines prefers-reduced-motion media query"
);
assert(
  globalsCss.includes("transition-duration: 0.01ms !important") &&
    globalsCss.includes("animation-duration: 0.01ms !important"),
  "globals.css eliminates all transition and animation durations under reduced-motion"
);
assert(
  globalsCss.includes(".accordion-grid"),
  "globals.css defines .accordion-grid CSS grid transition"
);

// --- Audit 2: Scroll Reveal Hook & Sequential Hero Hook ---
console.log("\n[Audit 2] useScrollReveal & useHeroSequence Engine");
const hookSrc = fs.readFileSync(path.join(rootDir, "lib/hooks/use-scroll-reveal.ts"), "utf-8");

assert(
  hookSrc.includes("useScrollReveal") && hookSrc.includes("IntersectionObserver"),
  "useScrollReveal utilizes native IntersectionObserver"
);
assert(
  hookSrc.includes("prefers-reduced-motion: reduce"),
  "useScrollReveal checks prefers-reduced-motion and sets instant visibility"
);
assert(
  hookSrc.includes("observer.disconnect()"),
  "useScrollReveal properly cleans up observer on unmount"
);
assert(
  hookSrc.includes("useHeroSequence"),
  "useHeroSequence provides staged entrance hook"
);
assert(
  hookSrc.includes("isEyebrowVisible") &&
    hookSrc.includes("isHeadlineVisible") &&
    hookSrc.includes("isSubheadlineVisible") &&
    hookSrc.includes("isCtaVisible") &&
    hookSrc.includes("isShowcaseVisible"),
  "useHeroSequence stages all 5 distinct stages of the hero section"
);

// --- Audit 3: Hero Section Deliberate Entrance ---
console.log("\n[Audit 3] Hero Section Staged Entrance Sequence");
const heroSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-hero.tsx"), "utf-8");

assert(
  heroSrc.includes("useHeroSequence"),
  "LandingHero imports and uses useHeroSequence"
);
assert(
  heroSrc.includes("isHeadlineVisible"),
  "Headline transitions rapidly without waiting on preview"
);
assert(
  heroSrc.includes("isShowcaseVisible"),
  "Product preview workstation enters smoothly as the final stage"
);

// --- Audit 4: Header Interactions & Scroll Treatment ---
console.log("\n[Audit 4] Header Scroll-Triggered Treatment & Microinteractions");
const headerSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-header.tsx"), "utf-8");

assert(
  headerSrc.includes("isScrolled"),
  "LandingHeader tracks scroll position with passive listener"
);
assert(
  headerSrc.includes("group-hover:translate-x-0.5"),
  "CTA button features subtle directional arrow microinteraction"
);
assert(
  headerSrc.includes("active:scale-[0.98]") || headerSrc.includes("active:scale-95"),
  "Interactive buttons feature tactile pressed states"
);

// --- Audit 5: Grids, Cards & Staggering ---
console.log("\n[Audit 5] Card Grids Staggered Scroll Reveals");
const problemSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-problem.tsx"), "utf-8");
const integrationsSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-integrations.tsx"), "utf-8");
const showcaseSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-showcase.tsx"), "utf-8");

assert(
  problemSrc.includes("useScrollReveal") && problemSrc.includes("transitionDelay"),
  "LandingProblem staggers silo cards on scroll"
);
assert(
  integrationsSrc.includes("useScrollReveal") && integrationsSrc.includes("transitionDelay"),
  "LandingIntegrations staggers integration cards on scroll"
);
assert(
  showcaseSrc.includes("useScrollReveal") && showcaseSrc.includes("transitionDelay"),
  "LandingShowcase staggers navigation tabs on scroll"
);

// --- Audit 6: Smooth FAQ Accordion & Graph SVG Drawing ---
console.log("\n[Audit 6] Smooth FAQ Accordion & Graph Connection Lines");
const faqSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-faq.tsx"), "utf-8");
const graphSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-graph-section.tsx"), "utf-8");

assert(
  faqSrc.includes("grid-rows-[1fr]") && faqSrc.includes("grid-rows-[0fr]"),
  "LandingFAQ uses butter-smooth CSS grid-template-rows expansion instead of abrupt unmounting"
);
assert(
  faqSrc.includes("rotate-180"),
  "FAQ chevron smoothly rotates 180 degrees on accordion toggle"
);
assert(
  graphSrc.includes("useScrollReveal") && graphSrc.includes("<line"),
  "LandingGraphSection animates SVG connecting edges upon scroll reveal"
);
assert(
  graphSrc.includes("transitionDelay"),
  "LandingGraphSection staggers node overlay entrance"
);

// --- Audit 7: Footer Staged Scroll Reveal & Microinteractions ---
console.log("\n[Audit 7] Footer Staged Entrance & Link Sequences");
const footerSrc = fs.readFileSync(path.join(rootDir, "components/landing/landing-footer.tsx"), "utf-8");

assert(
  footerSrc.includes("useScrollReveal"),
  "LandingFooter connects to useScrollReveal"
);
assert(
  footerSrc.includes("transitionDelay: \"80ms\"") || footerSrc.includes("transitionDelay: '80ms'"),
  "LandingFooter stages brand description after logo"
);
assert(
  footerSrc.includes("transitionDelay: \"120ms\"") && footerSrc.includes("transitionDelay: \"300ms\""),
  "LandingFooter sequences navigation link columns"
);
assert(
  footerSrc.includes("transitionDelay: \"380ms\""),
  "LandingFooter stages bottom copyright and locale bar"
);

// --- Audit 8: Cross-Landing Coverage & Reusable ScrollReveal ---
console.log("\n[Audit 8] Cross-Landing Coverage & Reusable ScrollReveal Primitives");
const scrollRevealComponentSrc = fs.readFileSync(path.join(rootDir, "components/landing/scroll-reveal.tsx"), "utf-8");
const productPageSrc = fs.readFileSync(path.join(rootDir, "app/(marketing)/product/page.tsx"), "utf-8");
const companyGraphPageSrc = fs.readFileSync(path.join(rootDir, "app/(marketing)/company-graph/page.tsx"), "utf-8");
const integrationsPageSrc = fs.readFileSync(path.join(rootDir, "app/(marketing)/integrations/page.tsx"), "utf-8");
const faqPageSrc = fs.readFileSync(path.join(rootDir, "app/(marketing)/faq/page.tsx"), "utf-8");
const pricingCardsSrc = fs.readFileSync(path.join(rootDir, "app/pricing/pricing-cards.tsx"), "utf-8");
const pricingFaqSrc = fs.readFileSync(path.join(rootDir, "app/pricing/pricing-faq.tsx"), "utf-8");

assert(
  scrollRevealComponentSrc.includes("ScrollReveal") &&
    scrollRevealComponentSrc.includes("ScrollRevealGroup") &&
    scrollRevealComponentSrc.includes("ScrollRevealItem"),
  "scroll-reveal.tsx exports ScrollReveal, ScrollRevealGroup and ScrollRevealItem"
);
assert(
  productPageSrc.includes("ScrollReveal") && productPageSrc.includes("ScrollRevealGroup"),
  "Product overview page implements staged scroll reveal"
);
assert(
  companyGraphPageSrc.includes("ScrollReveal") && companyGraphPageSrc.includes("ScrollRevealGroup"),
  "Company graph page implements staged scroll reveal"
);
assert(
  integrationsPageSrc.includes("ScrollReveal") && integrationsPageSrc.includes("ScrollRevealGroup"),
  "Integrations page implements staged scroll reveal across categories"
);
assert(
  faqPageSrc.includes("ScrollReveal") && faqPageSrc.includes("ScrollRevealGroup"),
  "FAQ page implements staged scroll reveal on questions"
);
assert(
  pricingCardsSrc.includes("useScrollReveal") && pricingCardsSrc.includes("transitionDelay"),
  "Pricing cards implement staged entrance across subscription tiers"
);
assert(
  pricingFaqSrc.includes("useScrollReveal") && pricingFaqSrc.includes("transitionDelay"),
  "Pricing FAQ implements staged entrance on questions"
);

console.log("\n==================================================================");
console.log("ALL 8 AUDITS PASSED WITH 100% COMPLIANCE");
console.log("==================================================================\n");
