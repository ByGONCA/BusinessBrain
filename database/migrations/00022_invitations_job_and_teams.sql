-- ==============================================================================
-- Migration 00022: Optional Job Title & Initial Teams for Invitations
-- Description:
--   Extends public.organization_invitations to optionally store a suggested
--   job title and initial team assignments when inviting new members.
--   These assignments are non-mandatory and automatically applied upon
--   cryptographic acceptance of the invitation.
--
-- Security:
--   - Strict multi-tenancy: team assignments must belong to the invitation's organization.
--   - System roles (owner, admin, member) remain strictly separated from informational job titles.
-- ==============================================================================

alter table public.organization_invitations
  add column if not exists job_title text default '',
  add column if not exists initial_team_ids jsonb default '[]'::jsonb;

-- Optional index for auditing / lookup
create index if not exists idx_org_invitations_job_title
  on public.organization_invitations(organization_id, job_title)
  where job_title <> '';

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
