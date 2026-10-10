export type MemberRole = "owner" | "admin" | "member";
export type OrganizationRole = MemberRole;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone_number?: string | null;
  date_format?: string;
  time_format?: string;
  timezone?: string;
  first_day_of_week?: "monday" | "sunday";
  user_preferences?: Record<string, unknown>;
  typography_settings?: Record<string, unknown>;
  job_title?: string;
  department?: string;
  bio?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  industry?: string | null;
  company_size?: string | null;
  country?: string | null;
  default_timezone?: string;
  default_language?: string;
  default_currency?: string;
  workspace_defaults?: Record<string, unknown>;
  allow_user_email_dispatch?: boolean;
  branding_settings?: Record<string, unknown>;
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
  job_title?: string;
  department?: string;
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
