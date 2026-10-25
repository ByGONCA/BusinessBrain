/**
 * BusinessBrain Marketing & Landing Page Configuration
 * 
 * Centralizes editable design assumptions, provisional pricing, showcase definitions,
 * and verified ecosystem integrations without tampering with Stripe live configurations.
 */

export interface ProvisionalPlan {
  id: "provisional_monthly" | "provisional_annual";
  monthlyPriceEur: number;
  annualPriceEur: number;
  trialDays: number;
  currencySymbol: string;
}

export const PROVISIONAL_PRICING: ProvisionalPlan = {
  id: "provisional_monthly",
  monthlyPriceEur: 19,
  annualPriceEur: 190, // ~15.83€/month (save 2 months)
  trialDays: 3,
  currencySymbol: "€",
};

export interface MarketingIntegration {
  id: string;
  name: string;
  category: "engineering" | "commerce" | "communication";
  status: "active" | "roadmap";
  logoUrl: string;
  description: string;
}

export const MARKETING_INTEGRATIONS: MarketingIntegration[] = [
  {
    id: "github",
    name: "GitHub",
    category: "engineering",
    status: "active",
    logoUrl: "/Logos/github-icon.svg",
    description: "Link commits, pull requests, and repositories directly to strategic initiatives and decision records.",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "commerce",
    status: "active",
    logoUrl: "/Logos/stripe.svg",
    description: "Real-time MRR, customer subscription events, settled net revenue, and dunning churn tracking.",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "communication",
    status: "active",
    logoUrl: "/Logos/google-drive.svg",
    description: "Import, sync, and index spreadsheets, slides, and shared documents into unified workspace pages.",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "communication",
    status: "active",
    logoUrl: "/Logos/google-calendar.svg",
    description: "Sync executive meetings, sprint reviews, and retrospective action items to project timelines.",
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    status: "active",
    logoUrl: "/Logos/slack-icon.svg",
    description: "Capture critical discussions and convert threads into permanent architectural decision records.",
  },
  {
    id: "linear",
    name: "Linear",
    category: "engineering",
    status: "roadmap",
    logoUrl: "/Logos/linear-icon.svg",
    description: "Bi-directional sync between engineering issue cycles and high-level company roadmap goals.",
  },
  {
    id: "notion",
    name: "Notion Importer",
    category: "communication",
    status: "roadmap",
    logoUrl: "/Logos/notion-icon.svg",
    description: "High-fidelity lossless workspace migration for pages, tables, callouts, and hierarchical trees.",
  },
  {
    id: "figma",
    name: "Figma",
    category: "engineering",
    status: "roadmap",
    logoUrl: "/Logos/figma-icon.svg",
    description: "Embed live canvas frames and design tokens directly into product specification documents.",
  },
];

export interface GraphNodeDemo {
  id: string;
  title: string;
  type: "page" | "decision" | "project" | "meeting" | "repo";
  typeLabel: string;
  connections: string[];
  summary: string;
  x: number; // Percentage coordinate (0 - 100)
  y: number; // Percentage coordinate (0 - 100)
}

export const DEMO_GRAPH_NODES: GraphNodeDemo[] = [
  {
    id: "node-1",
    title: "ADR-014: Monetization Engine",
    type: "decision",
    typeLabel: "Decision (ADR)",
    connections: ["node-2", "node-3", "node-5"],
    summary: "Decision to consolidate multi-currency billing and trial gating onto Stripe Connect.",
    x: 35,
    y: 35,
  },
  {
    id: "node-2",
    title: "Stripe Billing Infrastructure",
    type: "project",
    typeLabel: "Project",
    connections: ["node-1", "node-4"],
    summary: "Active migration implementing webhook handlers, idempotency locks, and customer portal.",
    x: 65,
    y: 28,
  },
  {
    id: "node-3",
    title: "Q3 Pricing Strategy Spec",
    type: "page",
    typeLabel: "Workspace Page",
    connections: ["node-1", "node-5"],
    summary: "Executive document detailing €19/mo paid-only pricing and 7-day full access free trial.",
    x: 20,
    y: 65,
  },
  {
    id: "node-4",
    title: "github.com/acme/core-api",
    type: "repo",
    typeLabel: "Repository",
    connections: ["node-2"],
    summary: "Main backend repository with 14 connected pull requests addressing billing webhooks.",
    x: 82,
    y: 55,
  },
  {
    id: "node-5",
    title: "Executive Revenue Review",
    type: "meeting",
    typeLabel: "Meeting",
    connections: ["node-1", "node-3"],
    summary: "Bi-weekly executive alignment on MRR growth, unit economics, and churn reduction.",
    x: 50,
    y: 75,
  },
];
