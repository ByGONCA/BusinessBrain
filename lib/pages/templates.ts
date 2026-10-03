// ==============================================================================
// Company Brain: Page Templates
// ==============================================================================

import { PageTemplate, EditorBlock } from "./types";

function createBlock(type: EditorBlock["type"], content: string, properties?: EditorBlock["properties"]): EditorBlock {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
    type,
    content,
    properties,
  };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank",
    name: "Blank Page",
    description: "Start from scratch with a completely blank canvas.",
    icon: "📄",
    blocks: [
      createBlock("paragraph", ""),
    ],
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Structure meeting agenda, participants, discussion points, and action items.",
    icon: "👥",
    blocks: [
      createBlock("callout", "Quick tip: Document key takeaways immediately during the meeting to keep action items aligned.", { calloutIcon: "💡" }),
      createBlock("heading_2", "Details"),
      createBlock("bullet_list", "Date: " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })),
      createBlock("bullet_list", "Attendees: @Team"),
      createBlock("bullet_list", "Objective: Align on Q3 roadmap milestones"),
      createBlock("divider", ""),
      createBlock("heading_2", "Agenda"),
      createBlock("numbered_list", "Topic 1: Review current sprint progress"),
      createBlock("numbered_list", "Topic 2: Address blockers and dependency risks"),
      createBlock("numbered_list", "Topic 3: Key decisions and next steps"),
      createBlock("divider", ""),
      createBlock("heading_2", "Discussion & Notes"),
      createBlock("paragraph", "Key points discussed during the sync..."),
      createBlock("divider", ""),
      createBlock("heading_2", "Action Items"),
      createBlock("checklist", "Finalize architecture design", { checked: false }),
      createBlock("checklist", "Share update with stakeholders", { checked: false }),
      createBlock("checklist", "Schedule follow-up review", { checked: false }),
    ],
  },
  {
    id: "project-plan",
    name: "Project Plan",
    description: "Outline project goals, scope, timeline milestones, and deliverables.",
    icon: "🎯",
    blocks: [
      createBlock("callout", "Project Mission: Define clear deliverables and measurable success criteria.", { calloutIcon: "🎯" }),
      createBlock("heading_2", "Executive Summary"),
      createBlock("paragraph", "Brief overview of what this project aims to accomplish and why it matters to the organization."),
      createBlock("divider", ""),
      createBlock("heading_2", "Goals & Success Metrics"),
      createBlock("bullet_list", "Primary Goal: Establish durable knowledge layer across teams"),
      createBlock("bullet_list", "Key Metric: 90% team adoption within 30 days"),
      createBlock("bullet_list", "Target Completion Date: End of quarter"),
      createBlock("divider", ""),
      createBlock("heading_2", "Sprint Kanban Board"),
      createBlock("board", "", {
        boardData: {
          columns: [
            {
              id: "col-todo",
              title: "To Do",
              cards: [
                { id: "c-1", text: "Design database schemas and RLS" },
                { id: "c-2", text: "Define API response contracts" },
              ],
            },
            {
              id: "col-progress",
              title: "In Progress",
              cards: [{ id: "c-3", text: "Build block editor core components" }],
            },
            {
              id: "col-done",
              title: "Done",
              cards: [{ id: "c-4", text: "Setup multi-tenant authentication" }],
            },
          ],
        },
      }),
      createBlock("divider", ""),
      createBlock("heading_2", "Milestones & Timeline"),
      createBlock("table", "", {
        tableData: {
          headers: ["Milestone", "Owner", "Target Date", "Status"],
          rows: [
            ["Phase 1: Architecture", "Engineering", "Week 1", "Completed"],
            ["Phase 2: Core Editor", "Product & Dev", "Week 2", "In Progress"],
            ["Phase 3: Rollout", "Operations", "Week 4", "Planned"],
          ],
        },
      }),
    ],
  },
  {
    id: "decision-record",
    name: "Decision Record (ADR)",
    description: "Capture architectural and strategic decisions, context, and consequences.",
    icon: "⚖️",
    blocks: [
      createBlock("callout", "Status: Proposed / Accepted / Superseded", { calloutIcon: "📌" }),
      createBlock("heading_2", "Context"),
      createBlock("paragraph", "What is the context of this decision? What problem or opportunity does it address?"),
      createBlock("divider", ""),
      createBlock("heading_2", "Decision"),
      createBlock("quote", "We decided to adopt PostgreSQL with row-level security and JSONB block persistence."),
      createBlock("divider", ""),
      createBlock("heading_2", "Consequences & Trade-offs"),
      createBlock("bullet_list", "Positive: Strong tenant isolation and immediate query flexibility"),
      createBlock("bullet_list", "Negative / Trade-off: JSONB schema migrations require careful versioning"),
      createBlock("bullet_list", "Mitigation: Strict TypeScript interfaces and regression test suites"),
    ],
  },
  {
    id: "weekly-planning",
    name: "Weekly Planning",
    description: "Organize weekly objectives, day-to-day focus, and review retrospective.",
    icon: "📅",
    blocks: [
      createBlock("callout", "Focus of the week: Deliver high-impact priorities without distractions.", { calloutIcon: "🚀" }),
      createBlock("heading_2", "Top Priorities"),
      createBlock("checklist", "Priority 1: Complete block editor feature set", { checked: true }),
      createBlock("checklist", "Priority 2: Verify zero TypeScript errors and run end-to-end tests", { checked: false }),
      createBlock("checklist", "Priority 3: Review team feedback and optimize interactions", { checked: false }),
      createBlock("divider", ""),
      createBlock("heading_2", "Key Schedule"),
      createBlock("calendar", "", {
        calendarData: {
          events: [
            { id: "e-1", title: "Sprint Kickoff", date: new Date().toISOString().split("T")[0] },
            { id: "e-2", title: "Mid-Sprint Sync", date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0] },
            { id: "e-3", title: "Demo & Retrospective", date: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0] },
          ],
        },
      }),
    ],
  },
];
