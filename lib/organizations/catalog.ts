/**
 * Centralized Catalog of Suggested Teams and Job Titles for BusinessBrain.
 * 
 * IMPORTANT ARCHITECTURAL PRINCIPLES:
 * 1. Suggestions only: Job titles and departments are purely informational metadata
 *    and NEVER grant system permissions or determine RBAC authorization.
 * 2. Non-rigid: Users can always input custom roles; this catalog is not a strict DB enum.
 * 3. Multi-team aware: Members can belong to multiple teams without their role being locked
 *    to any single team.
 */

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  color: "amber" | "blue" | "purple" | "rose" | "emerald" | "cyan" | "indigo" | "zinc";
  roles: string[];
}

export const SUGGESTED_TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: "executive",
    name: "Leadership / Executive",
    description: "Company executive officers, founders, and principal strategic leaders.",
    color: "amber",
    roles: [
      "CEO",
      "CTO",
      "CPO",
      "COO",
      "CFO",
      "Founder",
      "Co-Founder",
    ],
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Software engineering, systems architecture, infrastructure, and QA.",
    color: "blue",
    roles: [
      "VP of Engineering",
      "Engineering Manager",
      "Tech Lead",
      "Senior Software Engineer",
      "Software Engineer",
      "Frontend Engineer",
      "Backend Engineer",
      "Full-Stack Engineer",
      "DevOps / Cloud Engineer",
      "QA / Test Automation Engineer",
    ],
  },
  {
    id: "product",
    name: "Product",
    description: "Product management, user research, roadmap milestones, and technical specifications.",
    color: "purple",
    roles: [
      "Head of Product",
      "Lead Product Manager",
      "Senior Product Manager",
      "Product Manager",
      "Associate Product Manager",
      "Technical Product Manager",
      "Product Owner",
    ],
  },
  {
    id: "design",
    name: "Design",
    description: "Product design (UI/UX), design systems, user experience research, and brand identity.",
    color: "rose",
    roles: [
      "Head of Design",
      "Senior Product Designer",
      "Product Designer",
      "UI/UX Designer",
      "UX Researcher",
      "Brand / Graphic Designer",
    ],
  },
  {
    id: "marketing",
    name: "Marketing & Growth",
    description: "Branding, acquisition campaigns, content strategy, and developer relations.",
    color: "emerald",
    roles: [
      "Head of Growth",
      "Growth Marketing Manager",
      "Product Marketing Manager",
      "Content Strategist",
      "Performance Marketing Specialist",
      "Developer Relations (DevRel)",
      "Community Manager",
    ],
  },
  {
    id: "sales",
    name: "Sales & Business Development",
    description: "Revenue generation, client partnerships, business development, and enterprise accounts.",
    color: "cyan",
    roles: [
      "Head of Sales",
      "Account Executive",
      "Business Development Representative (BDR)",
      "Sales Development Representative (SDR)",
      "Partnerships Manager",
    ],
  },
  {
    id: "customer_success",
    name: "Customer Success & Support",
    description: "Client retention, onboarding, customer support, and solution engineering.",
    color: "indigo",
    roles: [
      "Head of Customer Success",
      "Customer Success Manager",
      "Customer Support Specialist",
      "Support Engineer",
      "Solutions Engineer",
    ],
  },
  {
    id: "operations",
    name: "Operations, HR & Finance",
    description: "Corporate administration, talent acquisition, financial planning, and legal compliance.",
    color: "zinc",
    roles: [
      "Head of Operations",
      "Operations Manager",
      "Financial Controller",
      "Accountant",
      "People / HR Manager",
      "Recruiter",
      "Legal & Compliance Counsel",
    ],
  },
];

/**
 * Deduplicated, alphabetically sorted list of all suggested roles across all teams.
 */
export const ALL_SUGGESTED_ROLES: string[] = Array.from(
  new Set(SUGGESTED_TEAM_TEMPLATES.flatMap((t) => t.roles))
).sort((a, b) => a.localeCompare(b));

/**
 * Normalizes a team name for fuzzy or case-insensitive matching.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Retrieves suggested roles for a single team name or id.
 */
export function getSuggestedRolesForTeam(teamNameOrId: string): string[] {
  if (!teamNameOrId) return [];
  const normalized = normalizeName(teamNameOrId);
  const found = SUGGESTED_TEAM_TEMPLATES.find(
    (t) =>
      t.id === teamNameOrId.toLowerCase() ||
      normalizeName(t.name) === normalized ||
      normalizeName(t.name).includes(normalized) ||
      normalized.includes(normalizeName(t.name))
  );
  return found ? [...found.roles] : [];
}

/**
 * Retrieves prioritized suggested roles based on one or more team names.
 * Returns { teamRoles: string[], otherRoles: string[] }
 */
export function getCategorizedSuggestedRoles(teamNames: string[] = []): {
  teamRoles: string[];
  otherRoles: string[];
} {
  const teamRolesSet = new Set<string>();

  for (const teamName of teamNames) {
    const roles = getSuggestedRolesForTeam(teamName);
    for (const r of roles) {
      teamRolesSet.add(r);
    }
  }

  const teamRoles = Array.from(teamRolesSet).sort((a, b) => a.localeCompare(b));
  const otherRoles = ALL_SUGGESTED_ROLES.filter((r) => !teamRolesSet.has(r));

  return { teamRoles, otherRoles };
}
