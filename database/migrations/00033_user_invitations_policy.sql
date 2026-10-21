-- ==============================================================================
-- Migration 00033: User Invitations Discovery & Secure RPC Gateway
-- Enables authenticated users to discover invitations addressed strictly to their
-- verified email address without exposing organization table internals or metadata.
-- ==============================================================================

-- 1. RLS Policy on public.organization_invitations:
-- Allow authenticated users to view pending, valid invitations addressed strictly to their email.
drop policy if exists "invitees_select_own_invitations" on public.organization_invitations;
create policy "invitees_select_own_invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(email) = lower(trim(auth.jwt() ->> 'email'))
    and status = 'pending'
    and expires_at > now()
  );

-- 2. Remove any permissive SELECT policy for invitees on public.organizations.
-- Table-level SELECT on organizations exposes sensitive columns (stripe_customer_id,
-- billing_email, onboarding_metadata) because RLS is row-level, not column-level.
drop policy if exists "invitees_select_organization_preview" on public.organizations;

-- 3. Dedicated SECURITY DEFINER RPC: public.get_my_pending_invitations
-- Securely returns ONLY safe scalar fields (name, slug) of the inviting organization
-- strictly bounded to the authenticated caller's verified email.
create or replace function public.get_my_pending_invitations()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select
    oi.id,
    oi.organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    oi.email,
    oi.role,
    oi.status,
    oi.expires_at,
    oi.created_at
  from public.organization_invitations oi
  join public.organizations o on o.id = oi.organization_id
  where nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(oi.email) = lower(trim(auth.jwt() ->> 'email'))
    and oi.status = 'pending'
    and oi.expires_at > now();
$$;

comment on function public.get_my_pending_invitations() is
  'Returns safe preview fields for invitations addressed to the calling authenticated user, without exposing sensitive organization columns.';

-- 4. RPC Execution Privileges (Explicit Least Privilege)
revoke all on function public.get_my_pending_invitations() from public, anon;
grant execute on function public.get_my_pending_invitations() to authenticated, service_role;
