-- ==============================================================================
-- Company Brain: Performance — Missing Composite Indexes
-- Migration: 00019_performance_indexes.sql
-- Description:
--   Adds three composite indexes identified as missing by the performance audit.
--   All indexes are additive and non-destructive. CONCURRENTLY avoids table locks.
--
--   Run in Supabase Dashboard → SQL Editor.
--   Safe to apply while the application is live.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. organization_team_members (organization_id, user_id)
--
-- Hot path: lib/permissions/resolver.ts — Step 2 (resolveUserPermissions)
-- Query:    .eq("organization_id", orgId).eq("user_id", userId)
-- Gap:      Current indexes are idx_team_members_org (org_id only) and
--           idx_team_members_user (user_id only). The resolver filters by BOTH
--           columns simultaneously. PostgreSQL must choose one index and filter
--           the other column in memory. A composite index allows a single
--           index scan for this exact predicate combination.
-- ------------------------------------------------------------------------------
create index concurrently if not exists idx_team_members_org_user
  on public.organization_team_members(organization_id, user_id);

-- ------------------------------------------------------------------------------
-- 2. team_permissions (organization_id, team_id)
--
-- Hot path: lib/permissions/resolver.ts — Step 3 (resolveUserPermissions)
-- Query:    .eq("organization_id", orgId).in("team_id", userTeamIds)
-- Gap:      Current indexes are idx_team_perms_org (org_id only) and
--           idx_team_perms_team (team_id only). The IN predicate on team_id is
--           combined with an org_id equality filter. A composite index lets
--           PostgreSQL resolve both predicates with a single index scan.
-- ------------------------------------------------------------------------------
create index concurrently if not exists idx_team_perms_org_team
  on public.team_permissions(organization_id, team_id);

-- ------------------------------------------------------------------------------
-- 3. organization_integrations (organization_id, status)
--
-- Hot path: lib/timeline/queries.ts — integrations fetch
--           lib/calendar/actions.ts — getOrganizationIntegrations call
-- Query:    .eq("organization_id", orgId).eq("status", "connected")
-- Gap:      Current indexes are idx_org_integrations_org (org_id) and
--           idx_org_integrations_status (status) on separate columns. Both
--           filters apply simultaneously; a composite index avoids a double scan.
-- ------------------------------------------------------------------------------
create index concurrently if not exists idx_org_integrations_org_status
  on public.organization_integrations(organization_id, status);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
