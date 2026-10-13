-- ==============================================================================
-- Company Brain: Hardened Granular Permissions Engine & RLS Synchronization
-- Migration: 00023_permissions_hardening_and_rls.sql
-- Description:
--   1. Introduces the canonical database-level public.has_permission() RPC that
--      precisely mirrors the TypeScript resolver precedence rules:
--        Rule 1: Organization Owner -> unconditional root authority (ALLOW)
--        Rule 2: Explicit Individual DENY -> immediate rejection (DENY)
--        Rule 3: Explicit Individual ALLOW -> individual override (ALLOW)
--        Rule 4: Team-level Permissions -> team-granted capabilities (ALLOW)
--        Rule 5: Default fallback -> closed by default (DENY)
--   2. Hardens Row Level Security (RLS) across all administrative tenant tables:
--      - public.organization_teams (teams.create, teams.edit, teams.delete)
--      - public.organization_team_members (teams.manage_members)
--      - public.team_permissions (teams.manage_permissions)
--      - public.member_permission_overrides (people.manage_permissions)
--      - public.organization_invitations (people.invite, people.remove with explicit DENY enforcement)
--      - public.organization_members (people.edit, people.remove, self-profile update)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CANONICAL DATABASE-LEVEL PERMISSION EVALUATION FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.has_permission(
  target_org_id uuid,
  required_key text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_override_effect text;
begin
  -- Null safety check
  if v_uid is null or target_org_id is null or required_key is null or trim(required_key) = '' then
    return false;
  end if;

  -- 1. Check workspace membership & system role
  select role into v_role
  from public.organization_members
  where organization_id = target_org_id
    and user_id = v_uid;

  if v_role is null then
    return false;
  end if;

  -- Rule 1: Organization Owner has unconditional root access to all keys
  if v_role = 'owner' then
    return true;
  end if;

  -- Rule 2 & 3: Check explicit individual overrides
  select effect into v_override_effect
  from public.member_permission_overrides
  where organization_id = target_org_id
    and user_id = v_uid
    and permission_key = required_key;

  if v_override_effect = 'deny' then
    return false; -- Rule 2: Explicit individual DENY overrides any team grant
  elsif v_override_effect = 'allow' then
    return true;  -- Rule 3: Explicit individual ALLOW grants access
  end if;

  -- Rule 4: Check if any team the member belongs to grants the permission
  if exists (
    select 1
    from public.organization_team_members otm
    join public.team_permissions tp
      on tp.team_id = otm.team_id
     and tp.organization_id = target_org_id
    where otm.organization_id = target_org_id
      and otm.user_id = v_uid
      and tp.permission_key = required_key
  ) then
    return true;
  end if;

  -- Rule 5: Default closed
  return false;
end;
$$;

grant execute on function public.has_permission(uuid, text) to authenticated, anon, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 2. HARDENED RLS POLICIES FOR ORGANIZATION TEAMS
-- ------------------------------------------------------------------------------
drop policy if exists "Members with team permissions can insert teams" on public.organization_teams;
drop policy if exists "Owners and admins can insert teams" on public.organization_teams;
create policy "Owners and authorized members can insert teams"
  on public.organization_teams for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.create')
  );

drop policy if exists "Members with team permissions can update teams" on public.organization_teams;
drop policy if exists "Owners and admins can update teams" on public.organization_teams;
create policy "Owners and authorized members can update teams"
  on public.organization_teams for update
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.edit')
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.edit')
  );

drop policy if exists "Members with team permissions can delete teams" on public.organization_teams;
drop policy if exists "Owners and admins can delete teams" on public.organization_teams;
create policy "Owners and authorized members can delete teams"
  on public.organization_teams for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.delete')
  );

-- ------------------------------------------------------------------------------
-- 3. HARDENED RLS POLICIES FOR TEAM MEMBERSHIPS
-- ------------------------------------------------------------------------------
drop policy if exists "Authorized members can manage team memberships" on public.organization_team_members;
drop policy if exists "Owners and admins can manage team memberships" on public.organization_team_members;
create policy "Owners and authorized members can manage team memberships"
  on public.organization_team_members for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.manage_members')
  );

drop policy if exists "Authorized members can remove team memberships" on public.organization_team_members;
drop policy if exists "Owners and admins can remove team memberships" on public.organization_team_members;
create policy "Owners and authorized members can remove team memberships"
  on public.organization_team_members for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.manage_members')
  );

-- ------------------------------------------------------------------------------
-- 4. HARDENED RLS POLICIES FOR TEAM PERMISSIONS
-- ------------------------------------------------------------------------------
drop policy if exists "Authorized members can insert team permissions" on public.team_permissions;
drop policy if exists "Owners and admins can insert team permissions" on public.team_permissions;
create policy "Owners and authorized members can insert team permissions"
  on public.team_permissions for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.manage_permissions')
  );

drop policy if exists "Authorized members can delete team permissions" on public.team_permissions;
drop policy if exists "Owners and admins can delete team permissions" on public.team_permissions;
create policy "Owners and authorized members can delete team permissions"
  on public.team_permissions for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'teams.manage_permissions')
  );

-- ------------------------------------------------------------------------------
-- 5. HARDENED RLS POLICIES FOR MEMBER PERMISSION OVERRIDES
-- ------------------------------------------------------------------------------
drop policy if exists "Authorized members can insert permission overrides" on public.member_permission_overrides;
drop policy if exists "Owners and admins can insert permission overrides" on public.member_permission_overrides;
create policy "Owners and authorized members can insert permission overrides"
  on public.member_permission_overrides for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.manage_permissions')
  );

drop policy if exists "Authorized members can update permission overrides" on public.member_permission_overrides;
drop policy if exists "Owners and admins can update permission overrides" on public.member_permission_overrides;
create policy "Owners and authorized members can update permission overrides"
  on public.member_permission_overrides for update
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.manage_permissions')
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.manage_permissions')
  );

drop policy if exists "Authorized members can delete permission overrides" on public.member_permission_overrides;
drop policy if exists "Owners and admins can delete permission overrides" on public.member_permission_overrides;
create policy "Owners and authorized members can delete permission overrides"
  on public.member_permission_overrides for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.manage_permissions')
  );

-- ------------------------------------------------------------------------------
-- 6. HARDENED RLS POLICIES FOR INVITATIONS (RESOLVING EXPLICIT DENY DEFECT)
-- ------------------------------------------------------------------------------
drop policy if exists "authorized_members_insert_invitations" on public.organization_invitations;
create policy "authorized_members_insert_invitations"
  on public.organization_invitations for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.invite')
  );

drop policy if exists "authorized_members_update_invitations" on public.organization_invitations;
create policy "authorized_members_update_invitations"
  on public.organization_invitations for update
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.invite')
  );

drop policy if exists "owners_admins_delete_invitations" on public.organization_invitations;
create policy "authorized_members_delete_invitations"
  on public.organization_invitations for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.remove')
  );

-- ------------------------------------------------------------------------------
-- 7. HARDENED RLS POLICIES FOR ORGANIZATION MEMBERS
-- ------------------------------------------------------------------------------
-- Update: Owners/admins can update roles & info; members with people.edit can update info;
-- individual members can update their own informational title/department.
drop policy if exists "Owners and admins can update member roles" on public.organization_members;
create policy "Authorized members can update member info"
  on public.organization_members for update
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.edit')
    or user_id = auth.uid()
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.edit')
    or user_id = auth.uid()
  );

-- Delete: Owners/admins can remove members; members with people.remove can remove; or member can leave
drop policy if exists "Owners/admins can remove members or user can leave" on public.organization_members;
create policy "Authorized members can remove members or user can leave"
  on public.organization_members for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or public.has_permission(organization_id, 'people.remove')
    or user_id = auth.uid()
  );

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
