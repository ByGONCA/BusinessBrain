-- Migration 00020: Organization Member Invitations & Governance
-- Creates the public.organization_invitations table with strict multi-tenancy, RLS, and secure single-use token constraints.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')) default 'member',
  token text not null unique,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')) default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamp with time zone not null default (now() + interval '7 days'),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Performance & Lookup Indexes
create index if not exists idx_org_invitations_org_id on public.organization_invitations(organization_id);
create index if not exists idx_org_invitations_token on public.organization_invitations(token);
create index if not exists idx_org_invitations_email on public.organization_invitations(lower(email));
create unique index if not exists idx_org_invitations_pending_email 
  on public.organization_invitations(organization_id, lower(email)) 
  where status = 'pending';

-- Enable Row Level Security
alter table public.organization_invitations enable row level security;

-- RLS Policy: View Invitations
-- Members of the organization can view invitations
create policy "organization_members_select_invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

-- RLS Policy: Insert Invitations
-- Owners, admins, or users with people.invite permission can create invitations
create policy "authorized_members_insert_invitations"
  on public.organization_invitations
  for insert
  to authenticated
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role in ('owner', 'admin')
          or exists (
            select 1 from public.member_permission_overrides mpo
            where mpo.organization_id = om.organization_id
              and mpo.user_id = auth.uid()
              and mpo.permission_key = 'people.invite'
              and mpo.effect = 'allow'
          )
          or exists (
            select 1 from public.organization_team_members otm
            join public.team_permissions tp on tp.team_id = otm.team_id
            where otm.organization_id = om.organization_id
              and otm.user_id = auth.uid()
              and tp.permission_key = 'people.invite'
          )
        )
    )
  );

-- RLS Policy: Update Invitations
-- Owners, admins, or users with people.invite permission can update/revoke invitations
create policy "authorized_members_update_invitations"
  on public.organization_invitations
  for update
  to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and (
          om.role in ('owner', 'admin')
          or exists (
            select 1 from public.member_permission_overrides mpo
            where mpo.organization_id = om.organization_id
              and mpo.user_id = auth.uid()
              and mpo.permission_key = 'people.invite'
              and mpo.effect = 'allow'
          )
          or exists (
            select 1 from public.organization_team_members otm
            join public.team_permissions tp on tp.team_id = otm.team_id
            where otm.organization_id = om.organization_id
              and otm.user_id = auth.uid()
              and tp.permission_key = 'people.invite'
          )
        )
    )
  );

-- RLS Policy: Delete Invitations
-- Only organization owners and admins can permanently delete invitation records
create policy "owners_admins_delete_invitations"
  on public.organization_invitations
  for delete
  to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );
