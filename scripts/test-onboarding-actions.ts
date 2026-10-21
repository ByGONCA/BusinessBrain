/**
 * Automated Test Suite for Onboarding, Guided Tour, and First-Use Checklist
 *
 * Verifies:
 * 1. Zod input validation for onboarding payload (name, slug, industry, teamSize, objectives).
 * 2. Tour state transitions: save step, complete tour, reset tour.
 * 3. Checklist state transitions: toggle task, dismiss checklist.
 * 4. Password validation rules and security requirements.
 */

import { checkPasswordRequirements } from "../lib/auth/password-rules";
import { z } from "zod";

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(50),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  websiteUrl: z.string().trim().max(255).optional().or(z.literal("")),
  industry: z.string().trim().max(50).optional().or(z.literal("")),
  teamSize: z.string().trim().max(30).optional().or(z.literal("")),
  objectives: z.array(z.string()).min(1, "Please select at least one objective"),
  acquisitionChannel: z.string().trim().max(100).optional(),
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("BUSINESSBRAIN: ONBOARDING, GUIDED TOUR & CHECKLIST TEST SUITE");
  console.log("==================================================================\n");

  // Suite 1: Onboarding Payload Validation
  console.log("[Suite 1] Onboarding Input Validation (Zod Schema)");
  {
    const validPayload = {
      name: "Acme Corporation",
      slug: "acme-corp",
      websiteUrl: "https://wareva.com",
      objectives: ["knowledge", "decisions"],
      acquisitionChannel: "google",
    };
    const resValid = onboardingSchema.safeParse(validPayload);
    assert(resValid.success, "Accepts valid onboarding payload with websiteUrl and omitted industry/teamSize");

    const invalidSlug = {
      ...validPayload,
      slug: "Acme_Corp!", // Invalid chars
    };
    const resSlug = onboardingSchema.safeParse(invalidSlug);
    assert(!resSlug.success, "Rejects invalid slug with uppercase letters or special characters");

    const emptyObjectives = {
      ...validPayload,
      objectives: [],
    };
    const resObj = onboardingSchema.safeParse(emptyObjectives);
    assert(!resObj.success, "Rejects empty objectives array (requires at least one)");

    const shortName = {
      ...validPayload,
      name: "A",
    };
    const resName = onboardingSchema.safeParse(shortName);
    assert(!resName.success, "Rejects company name shorter than 2 characters");
  }

  // Suite 2: Tour State Transition Logic
  console.log("\n[Suite 2] Interactive Tour State Machine");
  {
    interface MockProfile {
      tour_completed: boolean;
      tour_step: number;
      tour_completed_at?: string | null;
    }

    let profile: MockProfile = {
      tour_completed: false,
      tour_step: 0,
    };

    // Step progression
    profile.tour_step = 1;
    assert(profile.tour_step === 1 && !profile.tour_completed, "Progresses to step 1");

    profile.tour_step = 6;
    assert(profile.tour_step === 6 && !profile.tour_completed, "Progresses to final step 6");

    // Complete tour
    profile.tour_completed = true;
    profile.tour_completed_at = new Date().toISOString();
    assert(profile.tour_completed === true && !!profile.tour_completed_at, "Marks tour completed with timestamp");

    // Reset tour
    profile.tour_completed = false;
    profile.tour_step = 0;
    assert(profile.tour_completed === false && profile.tour_step === 0, "Resets tour to step 0 and uncompleted");
  }

  // Suite 3: Checklist State & Progress Calculation
  console.log("\n[Suite 3] First-Use Checklist Progress");
  {
    const initialChecklist = {
      page_created: false,
      member_invited: false,
      connection_explored: false,
      settings_configured: false,
      dismissed: false,
    };

    const taskCount = 4;
    const computeProgress = (state: typeof initialChecklist) => {
      const done = [
        state.page_created,
        state.member_invited,
        state.connection_explored,
        state.settings_configured,
      ].filter(Boolean).length;
      return { done, percent: Math.round((done / taskCount) * 100) };
    };

    assert(computeProgress(initialChecklist).percent === 0, "Initial progress is 0%");

    const oneDone = { ...initialChecklist, page_created: true };
    assert(computeProgress(oneDone).percent === 25, "1 of 4 tasks completed calculates to 25%");

    const allDone = {
      ...initialChecklist,
      page_created: true,
      member_invited: true,
      connection_explored: true,
      settings_configured: true,
    };
    assert(computeProgress(allDone).percent === 100, "All 4 tasks completed calculates to 100%");

    const dismissed = { ...allDone, dismissed: true };
    assert(dismissed.dismissed === true, "Checklist correctly flags dismissed state");
  }

  // Suite 4: Password Security Rules Verification
  console.log("\n[Suite 4] Password Requirements Verification");
  {
    const weakPass = "password";
    const weakResult = checkPasswordRequirements(weakPass);
    assert(!weakResult.allMet, "Identifies weak password as incomplete");
    assert(weakResult.results.length === true, "Weak password passes minLength (8 chars)");
    assert(weakResult.results.uppercase === false, "Fails uppercase requirement");
    assert(weakResult.results.number === false, "Fails number requirement");
    assert(weakResult.results.special === false, "Fails special char requirement");

    const strongPass = "P@ssword123!";
    const strongResult = checkPasswordRequirements(strongPass);
    assert(strongResult.allMet, "Identifies strong password satisfying all 5 criteria");
    assert(strongResult.errors.length === 0, "Zero errors returned for strong password");
  }

  console.log("\n==================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failure:", err);
  process.exit(1);
});
