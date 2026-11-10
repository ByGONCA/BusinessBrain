-- ==============================================================================
-- Company Brain: Organization Website or Application URL
-- Migration: 00032_organization_website_url.sql
-- ==============================================================================

alter table public.organizations
  add column if not exists website_url text;

comment on column public.organizations.website_url is 'Company website or live application URL (e.g. https://wareva.com)';
