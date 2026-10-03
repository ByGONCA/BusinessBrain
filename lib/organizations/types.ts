export type MemberRole = "owner" | "admin" | "member";
export type OrganizationRole = MemberRole;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  status: "active" | "suspended" | "archived";
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface OrganizationWithRole extends Organization {
  role: MemberRole;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}
