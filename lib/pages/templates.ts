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
      createBlock("bullet_list", "Objective: "),
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
      createBlock("bullet_list", "Primary Goal: "),
      createBlock("bullet_list", "Key Metric: "),
      createBlock("bullet_list", "Target Completion Date: "),
      createBlock("divider", ""),
      createBlock("heading_2", "Scope & Deliverables"),
      createBlock("checklist", "Core feature implementation", { checked: false }),
      createBlock("checklist", "Security audit and penetration verification", { checked: false }),
      createBlock("checklist", "Deployment pipeline setup", { checked: false }),
      createBlock("divider", ""),
      createBlock("heading_2", "Milestones & Timeline"),
      createBlock("numbered_list", "Phase 1: Architecture & Data Modeling (Week 1)"),
      createBlock("numbered_list", "Phase 2: Core Engine & UI Implementation (Week 2-3)"),
      createBlock("numbered_list", "Phase 3: Testing & Staging Rollout (Week 4)"),
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
      createBlock("quote", "We decided to adopt..."),
      createBlock("divider", ""),
      createBlock("heading_2", "Consequences & Trade-offs"),
      createBlock("bullet_list", "Positive: Improved performance and team clarity"),
      createBlock("bullet_list", "Negative / Trade-off: Learning curve for new team members"),
      createBlock("bullet_list", "Mitigation: Detailed documentation and internal guidelines"),
    ],
  },
  {
    id: "weekly-planning",
    name: "Weekly Planning",
    description: "Organize weekly objectives, day-to-day focus, and review retrospective.",
    icon: "📅",
    blocks: [
      createBlock("callout", "Focus of the week: Deliver high-impact priorities without distractions.", { calloutIcon: "🚀" }),
      createBlock("heading_2", "Top 3 Priorities"),
      createBlock("checklist", "Priority 1: ", { checked: false }),
      createBlock("checklist", "Priority 2: ", { checked: false }),
      createBlock("checklist", "Priority 3: ", { checked: false }),
      createBlock("divider", ""),
      createBlock("heading_2", "Daily Plan"),
      createBlock("heading_3", "Monday"),
      createBlock("bullet_list", "Sprint kickoff & backlog grooming"),
      createBlock("heading_3", "Tuesday - Thursday"),
      createBlock("bullet_list", "Deep work on primary deliverables"),
      createBlock("heading_3", "Friday"),
      createBlock("bullet_list", "Weekly review and progress retro"),
    ],
  },
];
