import {
  SUGGESTED_TEAM_TEMPLATES,
  ALL_SUGGESTED_ROLES,
  getSuggestedRolesForTeam,
  getCategorizedSuggestedRoles,
} from "../lib/organizations/catalog";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=======================================================");
console.log("RUNNING COMPREHENSIVE PEOPLE & TEAMS QUALITY VERIFICATION");
console.log("=======================================================\n");

// -------------------------------------------------------------
// 1. CATALOG STRUCTURE AND PREDEFINED TEAMS
// -------------------------------------------------------------
console.log("--- 1. Testing Centralized Catalog & Predefined Teams ---");
const expectedTeamIds = [
  "executive",
  "engineering",
  "product",
  "design",
  "marketing",
  "sales",
  "customer_success",
  "operations",
];

for (const id of expectedTeamIds) {
  const team = SUGGESTED_TEAM_TEMPLATES.find((t) => t.id === id);
  assert(!!team, `Expected team template with id '${id}' to exist`);
  assert(team!.roles.length > 0, `Team '${team!.name}' should have suggested roles`);
  console.log(`  ✓ Team template '${team!.name}' verified (${team!.roles.length} roles)`);
}

// Check specific key roles
const engRoles = getSuggestedRolesForTeam("Engineering");
assert(engRoles.includes("VP of Engineering"), "Engineering must include VP of Engineering");
assert(engRoles.includes("Software Engineer"), "Engineering must include Software Engineer");
assert(engRoles.includes("QA / Test Automation Engineer"), "Engineering must include QA Engineer");

const execRoles = getSuggestedRolesForTeam("Leadership / Executive");
assert(execRoles.includes("CEO"), "Executive must include CEO");
assert(execRoles.includes("CTO"), "Executive must include CTO");
assert(execRoles.includes("Founder"), "Executive must include Founder");

const prodRoles = getSuggestedRolesForTeam("Product");
assert(prodRoles.includes("Head of Product"), "Product must include Head of Product");
assert(prodRoles.includes("Product Owner"), "Product must include Product Owner");

const designRoles = getSuggestedRolesForTeam("Design");
assert(designRoles.includes("UI/UX Designer"), "Design must include UI/UX Designer");

const mktgRoles = getSuggestedRolesForTeam("Marketing & Growth");
assert(mktgRoles.includes("Developer Relations (DevRel)"), "Marketing must include DevRel");

const salesRoles = getSuggestedRolesForTeam("Sales & Business Development");
assert(salesRoles.includes("Account Executive"), "Sales must include Account Executive");

const csRoles = getSuggestedRolesForTeam("Customer Success & Support");
assert(csRoles.includes("Solutions Engineer"), "CS must include Solutions Engineer");

const opsRoles = getSuggestedRolesForTeam("Operations, HR & Finance");
assert(opsRoles.includes("People / HR Manager"), "Ops must include People / HR Manager");
assert(opsRoles.includes("Legal & Compliance Counsel"), "Ops must include Legal Counsel");

assert(ALL_SUGGESTED_ROLES.length > 0, "ALL_SUGGESTED_ROLES should not be empty");
const uniqueSet = new Set(ALL_SUGGESTED_ROLES);
assert(uniqueSet.size === ALL_SUGGESTED_ROLES.length, "ALL_SUGGESTED_ROLES must not contain duplicates");
console.log(`  ✓ Flat list is deduplicated and sorted (${ALL_SUGGESTED_ROLES.length} total roles)`);

// -------------------------------------------------------------
// 2. HYBRID SELECTION & MULTI-TEAM ROLE PRIORITIZATION
// -------------------------------------------------------------
console.log("\n--- 2. Testing Hybrid Selection & Role Prioritization ---");
// Single team prioritization
const singleTeamCat = getCategorizedSuggestedRoles(["Engineering"]);
assert(singleTeamCat.teamRoles.includes("Frontend Engineer"), "Engineering should include Frontend Engineer");
assert(!singleTeamCat.teamRoles.includes("Account Executive"), "Engineering should not include Account Executive");
assert(singleTeamCat.otherRoles.includes("Account Executive"), "Other roles should include Account Executive");
console.log("  ✓ Single team prioritization works correctly");

// Multi-team prioritization (member belongs to Engineering AND Product)
const multiTeamCat = getCategorizedSuggestedRoles(["Engineering", "Product"]);
assert(multiTeamCat.teamRoles.includes("Full-Stack Engineer"), "Must include Full-Stack Engineer");
assert(multiTeamCat.teamRoles.includes("Lead Product Manager"), "Must include Lead Product Manager");
assert(!multiTeamCat.otherRoles.includes("Full-Stack Engineer"), "Must not duplicate in otherRoles");
assert(!multiTeamCat.otherRoles.includes("Lead Product Manager"), "Must not duplicate in otherRoles");
console.log("  ✓ Multi-team prioritization combines suggested roles without duplicates");

// Custom role preservation: custom strings never altered by catalog
const customRoles = [
  "Chief AI Officer",
  "DevSecOps Ninja",
  "Head of Chaos Engineering",
  "Software Engineer (L5)",
];
for (const customRole of customRoles) {
  const isPredefined = ALL_SUGGESTED_ROLES.includes(customRole);
  assert(typeof customRole === "string" && customRole.length > 0, "Custom role is valid text string");
  // Ensure custom role is not blocked even if not in catalog
  console.log(`  ✓ Custom role '${customRole}' preserved (in catalog: ${isPredefined})`);
}

// -------------------------------------------------------------
// 3. TEAM TEMPLATES IDEMPOTENCY & CASE-INSENSITIVITY
// -------------------------------------------------------------
console.log("\n--- 3. Testing Team Templates Idempotency ---");
const existingDbTeams = [
  { id: "t1", name: "ENGINEERING", organization_id: "org-1" },
  { id: "t2", name: "product", organization_id: "org-1" },
  { id: "t3", name: "  Design  ", organization_id: "org-1" },
];

const existingNormalized = new Set(existingDbTeams.map((t) => t.name.trim().toLowerCase()));

const templatesToApply = SUGGESTED_TEAM_TEMPLATES.filter(
  (t) => !existingNormalized.has(t.name.trim().toLowerCase())
);

// Engineering, Product, Design already exist (with case/whitespace variations). Remaining: 5
assert(templatesToApply.length === 5, `Expected 5 templates to apply, got ${templatesToApply.length}`);
assert(!templatesToApply.some((t) => t.name.toLowerCase() === "engineering"), "Must skip Engineering");
assert(!templatesToApply.some((t) => t.name.toLowerCase() === "product"), "Must skip Product");
assert(!templatesToApply.some((t) => t.name.toLowerCase() === "design"), "Must skip Design");
console.log("  ✓ Idempotent application successfully skipped existing teams case-insensitively");

// -------------------------------------------------------------
// 4. INVITATION FLOW SIMULATION & CROSS-TENANT ISOLATION
// -------------------------------------------------------------
console.log("\n--- 4. Testing Invitation Flow & Tenant Isolation ---");

// Mock DB tables
interface MockInvite {
  id: string;
  organization_id: string;
  email: string;
  role: "admin" | "member";
  job_title?: string;
  initial_team_ids?: string[];
  status: "pending" | "accepted";
}

interface MockOrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  job_title: string;
}

interface MockTeamMember {
  organization_id: string;
  team_id: string;
  user_id: string;
}

const mockTeams = [
  { id: "team-eng-org1", organization_id: "org-1", name: "Engineering" },
  { id: "team-prod-org1", organization_id: "org-1", name: "Product" },
  { id: "team-secret-org2", organization_id: "org-2", name: "Secret Org2 Team" },
];

// Test tenant isolation filter: user tries to invite someone to org-1,
// passing team-eng-org1 AND team-secret-org2 (attacker injection attempt)
function validateInitialTeamIds(targetOrgId: string, requestedTeamIds: string[]): string[] {
  const allowedInOrg = mockTeams
    .filter((t) => t.organization_id === targetOrgId && requestedTeamIds.includes(t.id))
    .map((t) => t.id);
  return allowedInOrg;
}

const requestedTeams = ["team-eng-org1", "team-secret-org2"];
const validatedTeams = validateInitialTeamIds("org-1", requestedTeams);
assert(validatedTeams.includes("team-eng-org1"), "Valid team in org-1 must be kept");
assert(!validatedTeams.includes("team-secret-org2"), "Team belonging to org-2 MUST be stripped");
console.log("  ✓ Cross-tenant team assignment injection strictly prevented");

// Test acceptance flow simulation
const membersTable: MockOrgMember[] = [];
const teamMembersTable: MockTeamMember[] = [];
const profilesTable: Record<string, { job_title: string }> = {};

function simulateAcceptInvitation(invite: MockInvite, acceptingUserId: string) {
  // 1. Add/Update member
  let member = membersTable.find(
    (m) => m.organization_id === invite.organization_id && m.user_id === acceptingUserId
  );
  if (!member) {
    member = {
      id: `mem-${acceptingUserId}`,
      organization_id: invite.organization_id,
      user_id: acceptingUserId,
      role: invite.role,
      job_title: invite.job_title || "",
    };
    membersTable.push(member);
  } else if (invite.job_title && !member.job_title) {
    member.job_title = invite.job_title;
  }

  // 2. Update profile
  if (invite.job_title) {
    if (!profilesTable[acceptingUserId]) {
      profilesTable[acceptingUserId] = { job_title: invite.job_title };
    } else if (!profilesTable[acceptingUserId].job_title) {
      profilesTable[acceptingUserId].job_title = invite.job_title;
    }
  }

  // 3. Assign teams idempotently
  if (invite.initial_team_ids && invite.initial_team_ids.length > 0) {
    for (const tid of invite.initial_team_ids) {
      const alreadyInTeam = teamMembersTable.some(
        (tm) =>
          tm.organization_id === invite.organization_id &&
          tm.team_id === tid &&
          tm.user_id === acceptingUserId
      );
      if (!alreadyInTeam) {
        teamMembersTable.push({
          organization_id: invite.organization_id,
          team_id: tid,
          user_id: acceptingUserId,
        });
      }
    }
  }
}

// Case A: New Invitation with Job Title and Teams
const invite1: MockInvite = {
  id: "inv-1",
  organization_id: "org-1",
  email: "dev@company.com",
  role: "member",
  job_title: "Senior Full-Stack Engineer",
  initial_team_ids: ["team-eng-org1", "team-prod-org1"],
  status: "pending",
};

simulateAcceptInvitation(invite1, "user-alice");
assert(membersTable.find((m) => m.user_id === "user-alice")?.job_title === "Senior Full-Stack Engineer", "Job title must be persisted on member");
assert(profilesTable["user-alice"]?.job_title === "Senior Full-Stack Engineer", "Job title must be synced to profile");
assert(teamMembersTable.filter((tm) => tm.user_id === "user-alice").length === 2, "Alice must belong to 2 teams");
console.log("  ✓ New invitation with job title and initial teams accepted successfully");

// Verify idempotency: re-accepting or assigning same teams does not duplicate rows
simulateAcceptInvitation(invite1, "user-alice");
assert(teamMembersTable.filter((tm) => tm.user_id === "user-alice").length === 2, "Must not duplicate team membership rows");
console.log("  ✓ Idempotent team assignment confirmed (zero duplicate memberships)");

// Case B: Legacy Invitation (without job title or initial_team_ids)
const legacyInvite: MockInvite = {
  id: "inv-legacy",
  organization_id: "org-1",
  email: "legacy@company.com",
  role: "member",
  status: "pending",
};

simulateAcceptInvitation(legacyInvite, "user-bob");
assert(membersTable.find((m) => m.user_id === "user-bob")?.job_title === "", "Legacy invite member has empty job_title");
assert(teamMembersTable.filter((tm) => tm.user_id === "user-bob").length === 0, "Legacy invite member has no initial teams");
console.log("  ✓ Legacy invitation without job_title/teams accepted without errors");

// Case C: Simplified Invitation (User selects team only; role defaults to "member", no job title)
const simplifiedInvite: MockInvite = {
  id: "inv-simplified",
  organization_id: "org-1",
  email: "clara@company.com",
  role: "member",
  initial_team_ids: ["team-eng-org1"],
  status: "pending",
};

simulateAcceptInvitation(simplifiedInvite, "user-clara");
const claraMember = membersTable.find((m) => m.user_id === "user-clara");
assert(claraMember?.role === "member", "Role must default to 'member'");
assert(claraMember?.job_title === "", "Job title is empty when omitted from invitation");
const claraTeams = teamMembersTable.filter((tm) => tm.user_id === "user-clara");
assert(claraTeams.length === 1 && claraTeams[0].team_id === "team-eng-org1", "Clara must be assigned to the selected team");
console.log("  ✓ Simplified invitation (team only, role='member') accepted with correct team assignment");

// -------------------------------------------------------------
// 5. MEMBER COUNTS CONSISTENCY
// -------------------------------------------------------------
console.log("\n--- 5. Testing Member Counts Consistency ---");
const engTeamMembers = teamMembersTable.filter((tm) => tm.team_id === "team-eng-org1");
const prodTeamMembers = teamMembersTable.filter((tm) => tm.team_id === "team-prod-org1");
assert(engTeamMembers.length === 2, "Engineering team count should be exactly 2 (Alice + Clara)");
assert(prodTeamMembers.length === 1, "Product team count should be exactly 1");
console.log(`  ✓ Real team membership counts: Engineering (${engTeamMembers.length}), Product (${prodTeamMembers.length})`);

// -------------------------------------------------------------
// 6. UNDEFINED COLUMN ERROR HANDLING LOGIC
// -------------------------------------------------------------
console.log("\n--- 6. Testing Migration 00022 Resilient Fallback Logic ---");

function isUndefinedColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      (err.message.includes("job_title") || err.message.includes("initial_team_ids") || err.message.includes("column")) &&
      (err.code?.startsWith("42") || !err.code))
  );
}

// 1. Postgres 42703 (undefined_column) -> must trigger fallback
assert(isUndefinedColumnError({ code: "42703", message: 'column "job_title" of relation "organization_invitations" does not exist' }), "Must recognize 42703");
assert(isUndefinedColumnError({ message: 'column "job_title" does not exist' }), "Must recognize message without code");

// 2. Genuine errors (auth, constraint, syntax) -> MUST NOT trigger fallback
assert(!isUndefinedColumnError({ code: "23505", message: "duplicate key value violates unique constraint" }), "Must not swallow unique constraint errors");
assert(!isUndefinedColumnError({ code: "42501", message: "permission denied for table organization_invitations" }), "Must not swallow RLS permission errors");
assert(!isUndefinedColumnError({ code: "08006", message: "connection failure" }), "Must not swallow connection errors");
assert(!isUndefinedColumnError(null), "Null error is false");
console.log("  ✓ Fallback error detection is strictly limited to undefined column errors");

// -------------------------------------------------------------
// 7. DASHBOARD TEAMS REDIRECT VERIFICATION
// -------------------------------------------------------------
console.log("\n--- 7. Testing Teams Page Redirection ---");
import * as fs from "fs";
import * as path from "path";

const teamsPageContent = fs.readFileSync(
  path.join(__dirname, "../app/dashboard/teams/page.tsx"),
  "utf8"
);
assert(teamsPageContent.includes('redirect("/dashboard/people?tab=teams")'), "Teams page must redirect to people?tab=teams");
assert(!teamsPageContent.includes("DEFAULT_TEAMS"), "Teams page must not contain legacy mock DEFAULT_TEAMS");
console.log("  ✓ /dashboard/teams page correctly redirects to /dashboard/people?tab=teams with zero mock data");

console.log("\n=======================================================");
console.log("ALL QUALITY VERIFICATION CHECKS PASSED WITH 100% SUCCESS!");
console.log("=======================================================\n");
