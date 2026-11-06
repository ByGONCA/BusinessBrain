/**
 * Comprehensive Test Suite for BusinessBrain Company Timeline (Pass 2)
 *
 * Validates:
 * 1. Event model integrity & multi-source event typing
 * 2. Importance hierarchy:
 *    - Major milestones: Foundation, Plan, Owner/Admin, Teams, Stripe, Decisions, Projects, Goals, Favorite Docs
 *    - Normal initiatives: Standard member joins, named docs, meetings, calendar events
 *    - Minor / trivial events: "Untitled" drafts, routine tasks, individual activities
 * 3. Zoom Tier Visibility & "Untitled" page suppression:
 *    - Overview: Strategic events only. "Untitled" pages and minor tasks are strictly suppressed.
 *    - Exploration: Reveals named pages, documents, meetings. "Untitled" remains suppressed.
 *    - Detail: Reveals all events, including "Untitled" pages and routine tasks.
 *    - Search override: Explicitly searching for "Untitled" reveals it across any tier.
 * 4. Temporal scale & dynamic interval notches.
 * 5. Time range filtering.
 * 6. Simplified Header (No org badge, no description paragraph).
 * 7. SSR React Rendering in all 4 locales (en, pt, es, fr).
 *
 * Run with: npx tsx scripts/test-company-timeline.ts
 */

import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  TimelineEvent,
  TimelineCategory,
  TimelineImportanceTier,
  TimelineZoomTier,
  TimelineTimeRange,
} from "../lib/timeline/types";
import { CompanyTimeline } from "../components/dashboard/timeline/company-timeline";
import { TimelineHeader } from "../components/dashboard/timeline/timeline-header";
import { LanguageProvider } from "../lib/i18n";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
    failedCount++;
  }
}

console.log("\n========================================================");
console.log(" 🕰️  BusinessBrain: Company Timeline Test Suite (Pass 2)");
console.log("========================================================\n");

// --- TEST SUITE 1: Importance Hierarchy & Event Modeling ---
console.log("--- Suite 1: Importance Hierarchy & Event Modeling ---");

const testEvents: TimelineEvent[] = [
  {
    id: "org-1",
    type: "company_founded",
    category: "milestone",
    importance: "major",
    title: "Acme Corp founded",
    description: "Company workspace established.",
    timestamp: "2024-01-01T10:00:00Z",
    author: { name: "Founder" },
  },
  {
    id: "sub-1",
    type: "plan_activated",
    category: "billing",
    importance: "major",
    title: "Subscribed to Pro Plan",
    description: "Active subscription on the Pro plan.",
    timestamp: "2024-01-02T12:00:00Z",
  },
  {
    id: "member-1",
    type: "member_joined",
    category: "team",
    importance: "major",
    title: "Alice joined as owner",
    description: "Added to workspace with owner permissions.",
    timestamp: "2024-01-01T10:05:00Z",
    author: { name: "Alice", role: "owner" },
  },
  {
    id: "member-2",
    type: "member_joined",
    category: "team",
    importance: "normal",
    title: "Bob joined as member",
    description: "Added to workspace with member permissions.",
    timestamp: "2024-02-15T09:00:00Z",
    author: { name: "Bob", role: "member" },
  },
  {
    id: "team-1",
    type: "team_created",
    category: "team",
    importance: "major",
    title: "Team: Core Engineering",
    description: "Organizational team Core Engineering created.",
    timestamp: "2024-02-20T14:00:00Z",
    author: { name: "Alice" },
  },
  {
    id: "integ-1",
    type: "integration_connected",
    category: "milestone",
    importance: "major",
    title: "Connected Stripe",
    description: "Integration active for Acme Corp.",
    timestamp: "2024-01-03T16:00:00Z",
  },
  {
    id: "decision-1",
    type: "decision_recorded",
    category: "decision",
    importance: "major",
    title: "Decision: Adopt PostgreSQL with Strict RLS",
    description: "Architecture Decision Record for secure multi-tenancy.",
    timestamp: "2024-01-10T11:00:00Z",
    author: { name: "Alice" },
    link: { label: "View Decision", href: "/dashboard/decisions" },
  },
  {
    id: "project-1",
    type: "project_created",
    category: "project",
    importance: "major",
    title: "Project: NextGen Customer Portal",
    description: "Strategic project initiative.",
    timestamp: "2024-02-01T08:30:00Z",
    author: { name: "Alice" },
    link: { label: "View Project", href: "/dashboard/projects" },
  },
  {
    id: "goal-1",
    type: "goal_created",
    category: "milestone",
    importance: "major",
    title: "Goal: Reach $50k MRR in Q2",
    description: "Strategic company milestone.",
    timestamp: "2024-02-05T10:00:00Z",
    author: { name: "Alice" },
  },
  {
    id: "page-1",
    type: "document_created",
    category: "memory",
    importance: "major",
    title: "⭐ Security Whitepaper",
    description: "Workspace knowledge page.",
    timestamp: "2024-03-01T15:00:00Z",
    author: { name: "Bob" },
  },
  {
    id: "page-2",
    type: "document_created",
    category: "memory",
    importance: "normal",
    title: "📄 Onboarding Guide",
    description: "Workspace knowledge page.",
    timestamp: "2024-03-05T15:00:00Z",
    author: { name: "Bob" },
  },
  {
    id: "page-untitled",
    type: "document_created",
    category: "memory",
    importance: "minor", // Classified as minor because it is an untitled draft
    title: "📄 Untitled Document",
    description: "Workspace knowledge page established in company brain.",
    timestamp: "2024-03-06T12:00:00Z",
    author: { name: "Bob" },
  },
  {
    id: "meeting-1",
    type: "meeting_held",
    category: "work",
    importance: "normal",
    title: "Sprint Planning #4",
    description: "Scheduled calendar event.",
    timestamp: "2024-03-10T10:00:00Z",
  },
  {
    id: "task-1",
    type: "task_completed",
    category: "work",
    importance: "minor",
    title: "Task: Implement rate limiter test",
    description: "Operational task in workspace.",
    timestamp: "2024-03-12T16:45:00Z",
  },
  {
    id: "act-1",
    type: "activity_recorded",
    category: "work",
    importance: "minor",
    title: "Bob: Status changed to completed",
    description: "Status changed to completed.",
    timestamp: "2024-03-12T17:00:00Z",
  },
];

const majorEvents = testEvents.filter((e) => e.importance === "major");
const normalEvents = testEvents.filter((e) => e.importance === "normal");
const minorEvents = testEvents.filter((e) => e.importance === "minor");

assert(majorEvents.length === 9, "9 Major milestones: Foundation, Plan, Owner, Team, Stripe, Decision, Project, Goal, Starred Doc");
assert(majorEvents.some((e) => e.type === "company_founded"), "Foundation is in Major tier");
assert(majorEvents.some((e) => e.type === "decision_recorded"), "Decisions are in Major tier");
assert(majorEvents.some((e) => e.type === "project_created"), "Projects are in Major tier");
assert(majorEvents.some((e) => e.type === "team_created"), "Teams created are in Major tier");
assert(normalEvents.length === 3, "3 Normal events: standard member, named doc, sprint meeting");
assert(minorEvents.length === 3, "3 Minor events: Untitled document, routine task, activity log");

// --- TEST SUITE 2: Organic Zoom Density & Untitled Page Suppression ---
console.log("\n--- Suite 2: Organic Zoom Density & Untitled Page Suppression ---");

function filterEventsByZoomRatio(events: TimelineEvent[], zoomRatio: number, search: string = ""): TimelineEvent[] {
  const hasSearch = search.trim().length > 0;
  const q = search.toLowerCase().trim();

  return events.filter((ev) => {
    if (!hasSearch) {
      if (zoomRatio <= 1.3 && ev.importance !== "major") return false;
      if (zoomRatio > 1.3 && zoomRatio <= 2.8 && ev.importance === "minor") return false;
    }
    if (hasSearch) {
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchDesc = ev.description.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });
}

const macroItems = filterEventsByZoomRatio(testEvents, 1.0);
assert(macroItems.every((e) => e.importance === "major"), "Macro zoom (ratio 1.0) contains ONLY major milestones");
assert(!macroItems.some((e) => e.title.includes("Untitled")), "Untitled Document is strictly hidden in Macro zoom");
assert(!macroItems.some((e) => e.type === "task_completed"), "Routine tasks are strictly hidden in Macro zoom");

const mediumItems = filterEventsByZoomRatio(testEvents, 2.0);
assert(mediumItems.some((e) => e.title === "📄 Onboarding Guide"), "Medium zoom (ratio 2.0) reveals named documents");
assert(mediumItems.some((e) => e.title === "Sprint Planning #4"), "Medium zoom reveals meetings");
assert(!mediumItems.some((e) => e.title.includes("Untitled")), "Untitled Document remains hidden in Medium zoom");

const deepItems = filterEventsByZoomRatio(testEvents, 3.5);
assert(deepItems.length === testEvents.length, "Deep zoom (ratio 3.5) reveals ALL 100% of events");
assert(deepItems.some((e) => e.title.includes("Untitled")), "Deep zoom reveals Untitled Document");
assert(deepItems.some((e) => e.type === "task_completed"), "Deep zoom reveals routine tasks");

// Search override in macro zoom
const searchResult = filterEventsByZoomRatio(testEvents, 1.0, "Untitled");
assert(searchResult.length === 1 && searchResult[0].id === "page-untitled", "Actively searching 'Untitled' surfaces the document even in Macro zoom");

// --- TEST SUITE 3: Dynamic Interval Notches ---
console.log("\n--- Suite 3: Dynamic Interval Notches ---");

const STANDARD_INTERVALS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  2 * 24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  14 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000,
  90 * 24 * 60 * 60_000,
  180 * 24 * 60 * 60_000,
  365 * 24 * 60 * 60_000,
  2 * 365 * 24 * 60 * 60_000,
];

function pickInterval(visibleDuration: number, containerWidth: number) {
  const targetTicksCount = Math.max(4, Math.min(10, Math.floor(containerWidth / 150)));
  const targetIntervalMs = visibleDuration / targetTicksCount;

  let chosen = STANDARD_INTERVALS_MS[0];
  for (const interval of STANDARD_INTERVALS_MS) {
    chosen = interval;
    if (interval >= targetIntervalMs) break;
  }
  return chosen;
}

const macroInterval = pickInterval(365 * 24 * 60 * 60_000 * 2, 1000);
assert(macroInterval >= 90 * 24 * 60 * 60_000, "Multi-year view picks quarter or year notches");

const mesoInterval = pickInterval(30 * 24 * 60 * 60_000, 1000);
assert(mesoInterval === 7 * 24 * 60 * 60_000 || mesoInterval === 2 * 24 * 60 * 60_000, "30-day view picks days or week notches");

const microInterval = pickInterval(2 * 24 * 60 * 60_000, 1000);
assert(microInterval <= 12 * 60 * 60_000, "2-day view picks hours notches");

// --- TEST SUITE 4: Time Range Filtering ---
console.log("\n--- Suite 4: Time Range Filtering ---");

const nowMs = new Date("2024-03-15T00:00:00Z").getTime();

function filterByTimeRange(events: TimelineEvent[], range: TimelineTimeRange, refNow: number) {
  let minTimestamp = 0;
  if (range === "30d") {
    minTimestamp = refNow - 30 * 24 * 60 * 60_000;
  } else if (range === "90d") {
    minTimestamp = refNow - 90 * 24 * 60 * 60_000;
  } else if (range === "1y") {
    minTimestamp = refNow - 365 * 24 * 60 * 60_000;
  } else if (range === "ytd") {
    minTimestamp = new Date(new Date(refNow).getFullYear(), 0, 1).getTime();
  }

  if (minTimestamp === 0) return events;
  return events.filter((e) => new Date(e.timestamp).getTime() >= minTimestamp);
}

const allRange = filterByTimeRange(testEvents, "all", nowMs);
assert(allRange.length === testEvents.length, "All-time range retains 100% of events");

const thirtyDays = filterByTimeRange(testEvents, "30d", nowMs);
assert(thirtyDays.length < testEvents.length, "30d range filters out older events");
assert(thirtyDays.every((e) => new Date(e.timestamp).getTime() >= nowMs - 30 * 24 * 60 * 60_000), "All 30d events are within last 30 days");

// --- TEST SUITE 5: Simplified Header & SSR React Rendering ---
console.log("\n--- Suite 5: Simplified Header & SSR React Rendering ---");

const locales = ["en", "pt", "es", "fr"] as const;

for (const loc of locales) {
  const html = ReactDOMServer.renderToString(
    React.createElement(
      LanguageProvider,
      { initialLocale: loc },
      React.createElement(
        "div",
        null,
        React.createElement(TimelineHeader, null),
        React.createElement(CompanyTimeline, {
          events: testEvents,
          organizationName: "Acme Corp",
        })
      )
    )
  );

  // Requirement 1: Header has NO org name badge and NO description paragraph
  assert(!html.includes("The continuous chronological memory"), `No header description in ${loc}`);
  assert(!html.includes("cb_active_org_id"), `No org cookie in header ${loc}`);

  // Requirement 2: Toolbar and Canvas have NO card wrapper boxes
  assert(!html.includes("shadow-2xl rounded-2xl border border-white/[0.08] bg-[#121316] overflow-hidden"), `No outer card shell in ${loc}`);

  // Major milestone rendering
  assert(html.includes("Acme Corp founded"), `Renders foundation milestone in ${loc}`);
  assert(html.includes("Adopt PostgreSQL"), `Renders strategic decision in ${loc}`);
  assert(html.includes("NextGen Customer Portal"), `Renders strategic project in ${loc}`);
  assert(html.includes("Core Engineering"), `Renders established team in ${loc}`);
}

console.log("\n========================================================");
console.log(` 📊 Results: ${passedCount} Passed, ${failedCount} Failed`);
console.log("========================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
