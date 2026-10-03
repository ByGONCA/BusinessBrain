-- ==============================================================================
-- Company Brain: Row Level Security (RLS) & Multi-Tenant Isolation
-- Migration: 00002_rls_policies.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER SECURITY DEFINER FUNCTIONS
-- Bypasses recursive RLS lookups while strictly bounding tenant authorization
-- ------------------------------------------------------------------------------

-- Check if current authenticated user is a member of the specified organization
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

-- Check if current authenticated user has one of the allowed roles in the organization
create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

-- Check if two users share at least one common organization
create or replace function public.shares_organization_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid()
      and m2.user_id = target_user_id
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. PROFILES ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Read: Users can view their own profile, or profiles of colleagues in their shared organizations
drop policy if exists "Profiles are viewable by self and workspace peers" on public.profiles;
create policy "Profiles are viewable by self and workspace peers"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or public.shares_organization_with(id)
  );

-- Insert: Users can only insert their own profile
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Update: Users can only update their own profile
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATIONS ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
alter table public.organizations enable row level security;

-- Read: Members can view organizations they belong to
drop policy if exists "Organizations are viewable by active members" on public.organizations;
create policy "Organizations are viewable by active members"
  on public.organizations
  for select
  using (
    public.is_org_member(id)
    or created_by = auth.uid()
  );

-- Insert: Authenticated users can create new organizations
drop policy if exists "Authenticated users can create organizations" on public.organizations;
create policy "Authenticated users can create organizations"
  on public.organizations
  for insert
  with check (auth.role() = 'authenticated');

-- Update: Only Owners and Admins can update organization metadata
drop policy if exists "Owners and admins can update organization" on public.organizations;
create policy "Owners and admins can update organization"
  on public.organizations
  for update
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

-- Delete: Only Owners can delete an organization
drop policy if exists "Only owners can delete organization" on public.organizations;
create policy "Only owners can delete organization"
  on public.organizations
  for delete
  using (public.has_org_role(id, array['owner']));

-- ------------------------------------------------------------------------------
-- 4. ORGANIZATION MEMBERS ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
alter table public.organization_members enable row level security;

-- Read: Members can view the member directory of organizations they belong to
drop policy if exists "Members can view membership in their organizations" on public.organization_members;
create policy "Members can view membership in their organizations"
  on public.organization_members
  for select
  using (public.is_org_member(organization_id));

-- Insert: Owners/Admins can add members, OR the user is inserting themselves as the initial owner
drop policy if exists "Admins/Owners can add members or creator can add self" on public.organization_members;
create policy "Admins/Owners can add members or creator can add self"
  on public.organization_members
  for insert
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or (user_id = auth.uid() and role = 'owner')
  );

-- Update: Only Owners and Admins can update member roles
drop policy if exists "Owners and admins can update member roles" on public.organization_members;
create policy "Owners and admins can update member roles"
  on public.organization_members
  for update
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- Delete: Owners/Admins can remove members, or a member can leave an organization
drop policy if exists "Owners/admins can remove members or user can leave" on public.organization_members;
create policy "Owners/admins can remove members or user can leave"
  on public.organization_members
  for delete
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or user_id = auth.uid()
  );
