/**
 * Test script for flexible Discord-style People / Teams / Permissions system.
 * Validates precedence rules, title independence, team inheritance, and owner authority.
 */

import {
  PERMISSION_KEYS,
  isValidPermissionKey,
  getPermissionsByCategory,
} from "../lib/permissions/registry";

interface MockMembership {
  user_id: string;
  organization_id: string;
  role: "owner" | "admin" | "member";
  job_title?: string;
}

interface MockTeamMembership {
  team_id: string;
  user_id: string;
}

interface MockTeamPermission {
  team_id: string;
  permission_key: string;
}

interface MockOverride {
  user_id: string;
  permission_key: string;
  effect: "allow" | "deny";
}

// Pure in-memory simulation of the resolver logic for verification
function resolveMockPermissions(params: {
  userId: string;
  membership: MockMembership;
  teamMemberships: MockTeamMembership[];
  teamPermissions: MockTeamPermission[];
  overrides: MockOverride[];
}) {
  const { userId, membership, teamMemberships, teamPermissions, overrides } = params;

  // 1. Owner has unconditional root access
  if (membership.role === "owner") {
    return {
      isOwner: true,
      hasPermission: (key: string) => true,
    };
  }

  // 2. Resolve user teams
  const userTeamIds = teamMemberships.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);

  // 3. Resolve team permissions
  const teamAllowed = new Set<string>();
  for (const tp of teamPermissions) {
    if (userTeamIds.includes(tp.team_id)) {
      teamAllowed.add(tp.permission_key);
    }
  }

  // 4. Resolve overrides
  const userOverrides = overrides.filter((o) => o.user_id === userId);
  const explicitDeny = new Set(userOverrides.filter((o) => o.effect === "deny").map((o) => o.permission_key));
  const explicitAllow = new Set(userOverrides.filter((o) => o.effect === "allow").map((o) => o.permission_key));

  return {
    isOwner: false,
    hasPermission: (key: string) => {
      // Rule 2: Explicit Deny wins
      if (explicitDeny.has(key)) return false;
      // Rule 3: Explicit Allow wins
      if (explicitAllow.has(key)) return true;
      // Rule 4: Team permission wins
      if (teamAllowed.has(key)) return true;
      // Rule 5: Default deny
      return false;
    },
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("RUNNING PERMISSION SYSTEM LOGIC TESTS");
console.log("=======================================================\n");

// 1. Owner Authority Test
const owner = resolveMockPermissions({
  userId: "u-owner",
  membership: { user_id: "u-owner", organization_id: "org-1", role: "owner", job_title: "Founder" },
  teamMemberships: [],
  teamPermissions: [],
  overrides: [],
});
assert(owner.hasPermission("pages.delete"), "Owner has pages.delete");
assert(owner.hasPermission("github.manage_connection"), "Owner has github.manage_connection");
assert(owner.hasPermission("billing.manage"), "Owner has billing.manage");

// 2. Job Title Independence Test (Two users with title 'CTO' have different permissions)
const cto1 = resolveMockPermissions({
  userId: "u-cto1",
  membership: { user_id: "u-cto1", organization_id: "org-1", role: "member", job_title: "CTO" },
  teamMemberships: [{ team_id: "t-eng", user_id: "u-cto1" }],
  teamPermissions: [{ team_id: "t-eng", permission_key: "github.view" }],
  overrides: [{ user_id: "u-cto1", permission_key: "github.manage_repositories", effect: "allow" }],
});

const cto2 = resolveMockPermissions({
  userId: "u-cto2",
  membership: { user_id: "u-cto2", organization_id: "org-1", role: "member", job_title: "CTO" },
  teamMemberships: [],
  teamPermissions: [],
  overrides: [],
});

assert(cto1.hasPermission("github.view") === true, "CTO 1 with Eng team has github.view");
assert(cto1.hasPermission("github.manage_repositories") === true, "CTO 1 with explicit grant has github.manage_repositories");
assert(cto2.hasPermission("github.view") === false, "CTO 2 with same job title but no team/grant has NO github.view");
assert(cto2.hasPermission("github.manage_repositories") === false, "CTO 2 has NO github.manage_repositories");

// 3. Team Inheritance & Removal Test
const engMember = resolveMockPermissions({
  userId: "u-dev",
  membership: { user_id: "u-dev", organization_id: "org-1", role: "member", job_title: "Developer" },
  teamMemberships: [{ team_id: "t-eng", user_id: "u-dev" }],
  teamPermissions: [
    { team_id: "t-eng", permission_key: "pages.create" },
    { team_id: "t-eng", permission_key: "tasks.create" },
  ],
  overrides: [],
});
assert(engMember.hasPermission("pages.create") === true, "Dev member inherits pages.create from team");

const devLeavingTeam = resolveMockPermissions({
  userId: "u-dev",
  membership: { user_id: "u-dev", organization_id: "org-1", role: "member", job_title: "Developer" },
  teamMemberships: [], // Removed from team
  teamPermissions: [{ team_id: "t-eng", permission_key: "pages.create" }],
  overrides: [],
});
assert(devLeavingTeam.hasPermission("pages.create") === false, "Dev loses pages.create after leaving team");

// 4. Precedence: Individual Deny Overrides Team Allow
const restrictedDev = resolveMockPermissions({
  userId: "u-restricted",
  membership: { user_id: "u-restricted", organization_id: "org-1", role: "member" },
  teamMemberships: [{ team_id: "t-eng", user_id: "u-restricted" }],
  teamPermissions: [{ team_id: "t-eng", permission_key: "github.view" }],
  overrides: [{ user_id: "u-restricted", permission_key: "github.view", effect: "deny" }], // Deny override
});
assert(restrictedDev.hasPermission("github.view") === false, "Explicit individual DENY overrides Team ALLOW");

// 5. Precedence: Individual Allow Grants Access Without Team
const soloMember = resolveMockPermissions({
  userId: "u-solo",
  membership: { user_id: "u-solo", organization_id: "org-1", role: "member" },
  teamMemberships: [],
  teamPermissions: [],
  overrides: [{ user_id: "u-solo", permission_key: "integrations.connect", effect: "allow" }],
});
assert(soloMember.hasPermission("integrations.connect") === true, "Explicit individual ALLOW grants access without team");
assert(soloMember.hasPermission("integrations.disconnect") === false, "Other ungranted permissions remain denied");

// 6. Registry Integrity
assert(PERMISSION_KEYS.length >= 30, `Registry contains comprehensive permissions count (${PERMISSION_KEYS.length})`);
assert(isValidPermissionKey("people.manage_permissions"), "people.manage_permissions is recognized");
assert(isValidPermissionKey("teams.manage_permissions"), "teams.manage_permissions is recognized");
assert(isValidPermissionKey("github.manage_connection"), "github.manage_connection is recognized");
assert(isValidPermissionKey("fake.permission") === false, "Invalid permission is rejected");

console.log("\n=======================================================");
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
