-- ==============================================================================
-- Migration 00024: Cryptographic Invitation Tokens & Secure Single-Use Gateway
-- Resolves SEC-01:
-- 1. Adds token_hash (SHA-256) column and backfills existing plaintext tokens.
-- 2. Redacts plaintext tokens on non-pending invitations.
-- 3. Makes legacy token column nullable in preparation for 00025 drop.
-- 4. Provides get_invitation_details RPC (SECURITY DEFINER with strict server guard).
-- 5. Provides accept_organization_invitation RPC (Atomic FOR UPDATE, email validation,
--    role guard, and tenant-isolated team assignment).
-- ==============================================================================

-- 1. Add token_hash column
alter table public.organization_invitations
  add column if not exists token_hash text;

-- 2. Deterministic backfill of existing legacy tokens to SHA-256 using native PostgreSQL sha256(bytea)
update public.organization_invitations
set token_hash = encode(sha256(token::bytea), 'hex')
where token_hash is null and token is not null;

-- 4. Create unique partial index on token_hash
create unique index if not exists idx_org_invitations_token_hash
  on public.organization_invitations(token_hash)
  where token_hash is not null;

-- 5. Redact plaintext tokens for invitations that are no longer pending
update public.organization_invitations
set token = null
where status in ('accepted', 'expired', 'revoked') and token is not null;

-- 6. Make legacy token column nullable
alter table public.organization_invitations
  alter column token drop not null;

-- ------------------------------------------------------------------------------
-- 6.5. System Table: public.internal_system_secrets
-- Dedicated isolated storage for server-to-database cryptographic authentication secrets.
-- Accessible strictly by postgres and SECURITY DEFINER routines; completely blocked from anon and authenticated.
-- ------------------------------------------------------------------------------
create table if not exists public.internal_system_secrets (
  key text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internal_system_secrets enable row level security;
revoke all on table public.internal_system_secrets from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.internal_system_secrets to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 7. Helper: public.hmac_sha256
-- Genuine RFC 2104 compliant HMAC-SHA-256 in pure PostgreSQL (zero external C extensions required)
-- ------------------------------------------------------------------------------
create or replace function public.hmac_sha256(p_key text, p_message text)
returns text
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  v_key bytea;
  v_msg bytea;
  v_k0 bytea;
  v_ipad bytea;
  v_opad bytea;
  v_k_ipad bytea;
  v_k_opad bytea;
  v_i int;
  v_inner_hash bytea;
  v_outer_hash bytea;
begin
  v_key := convert_to(p_key, 'UTF8');
  v_msg := convert_to(p_message, 'UTF8');

  -- RFC 2104 Step 1: Pre-process key if length > 64 bytes (SHA-256 block size)
  if length(v_key) > 64 then
    v_k0 := sha256(v_key);
  else
    v_k0 := v_key;
  end if;

  -- Pad key with zeros to block size (64 bytes)
  if length(v_k0) < 64 then
    v_k0 := v_k0 || decode(repeat('00', 64 - length(v_k0)), 'hex');
  end if;

  v_ipad := decode(repeat('36', 64), 'hex');
  v_opad := decode(repeat('5c', 64), 'hex');
  v_k_ipad := decode(repeat('00', 64), 'hex');
  v_k_opad := decode(repeat('00', 64), 'hex');

  -- XOR key with inner (0x36) and outer (0x5c) padding constants
  for v_i in 0..63 loop
    v_k_ipad := set_byte(v_k_ipad, v_i, get_byte(v_k0, v_i) # get_byte(v_ipad, v_i));
    v_k_opad := set_byte(v_k_opad, v_i, get_byte(v_k0, v_i) # get_byte(v_opad, v_i));
  end loop;

  -- Inner hash: H((K0 ^ ipad) || message)
  v_inner_hash := sha256(v_k_ipad || v_msg);

  -- Outer hash: H((K0 ^ opad) || inner_hash)
  v_outer_hash := sha256(v_k_opad || v_inner_hash);

  return encode(v_outer_hash, 'hex');
end;
$$;

revoke all on function public.hmac_sha256(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.hmac_sha256(text, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.hmac_sha256(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.hmac_sha256(text, text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 8. Helper: public.timing_safe_equal_hex
-- Constant-time comparison for 64-character hex digests to eliminate timing side-channels
-- ------------------------------------------------------------------------------
create or replace function public.timing_safe_equal_hex(a text, b text)
returns boolean
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  v_a bytea;
  v_b bytea;
  v_diff int := 0;
  v_i int;
begin
  if a is null or b is null or length(a) <> 64 or length(b) <> 64 then
    return false;
  end if;
  begin
    v_a := decode(a, 'hex');
    v_b := decode(b, 'hex');
  exception when others then
    return false;
  end;
  for v_i in 0..31 loop
    v_diff := v_diff | (get_byte(v_a, v_i) # get_byte(v_b, v_i));
  end loop;
  return v_diff = 0;
end;
$$;

revoke all on function public.timing_safe_equal_hex(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.timing_safe_equal_hex(text, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.timing_safe_equal_hex(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.timing_safe_equal_hex(text, text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 9. RPC: public.get_invitation_details
-- Secure read gateway for invite links without exposing entire invitations table
-- ------------------------------------------------------------------------------
create or replace function public.get_invitation_details(
  p_token_hash text,
  p_server_token text default null
)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invitation record;
  v_org record;
  v_token_ts bigint;
  v_token_sig text;
  v_now_epoch bigint;
  v_secret text;
  v_expected_sig text;
begin
  -- Validação prévia de formato: Hash SHA-256 deve ser hexadecimal estrito de 64 caracteres
  if p_token_hash is null or length(p_token_hash) <> 64 or p_token_hash !~* '^[0-9a-f]{64}$' then
    return;
  end if;

  -- Defesa em Profundidade: Se o utilizador não for service_role,
  -- exige validação criptográfica estrita do token emitido pelo servidor Next.js.
  -- Isto impede consultas arbitrárias diretamente à API PostgREST por clientes anónimos ou maliciosos.
  if coalesce(auth.role(), '') <> 'service_role' then
    if p_server_token is null or position('.' in p_server_token) = 0 then
      raise exception 'Access denied: cryptographic server token required for public gateway'
        using errcode = '42501';
    end if;

    begin
      v_token_ts := split_part(p_server_token, '.', 1)::bigint;
      v_token_sig := split_part(p_server_token, '.', 2);
    exception when others then
      raise exception 'Access denied: malformed server token format'
        using errcode = '42501';
    end;

    -- Proteção contra replay: janela máxima de 120 segundos
    v_now_epoch := extract(epoch from now())::bigint;
    if abs(v_now_epoch - v_token_ts) > 120 then
      raise exception 'Access denied: server token expired or timestamp desynchronized'
        using errcode = '42501';
    end if;

    -- Resolução do segredo do servidor dedicado
    -- Mecanismo 1 (Primário): Tabela com RLS public.internal_system_secrets (independente de connection pooler e persistente)
    if to_regclass('public.internal_system_secrets') is not null then
      begin
        execute 'select secret from public.internal_system_secrets where key = ''server_auth'' limit 1'
          into v_secret;
      exception when others then
        v_secret := null;
      end;
    end if;

    -- Mecanismo 2 (Alternativo): Parâmetro GUC app.settings.server_auth_secret
    if v_secret is null then
      v_secret := nullif(current_setting('app.settings.server_auth_secret', true), '');
    end if;

    -- Fail-closed estrito: Se o segredo não estiver configurado ou for inferior a 32 caracteres (256 bits), rejeita imediatamente
    if v_secret is null or length(trim(v_secret)) < 32 then
      raise exception 'Access denied: server authentication secret is unconfigured or invalid'
        using errcode = '42501';
    end if;

    -- Verificação da assinatura HMAC-SHA-256 (RFC 2104) calculada sobre invitation-details:token_hash:timestamp
    v_expected_sig := public.hmac_sha256(
      v_secret,
      'invitation-details:' || lower(trim(p_token_hash)) || ':' || v_token_ts
    );

    -- Comparação em tempo constante para eliminar canais laterais de temporização
    if not public.timing_safe_equal_hex(v_token_sig, v_expected_sig) then
      raise exception 'Access denied: invalid cryptographic server token signature'
        using errcode = '42501';
    end if;
  end if;

  -- Pesquisa pelo hash determinístico
  select oi.* into v_invitation
  from public.organization_invitations oi
  where oi.token_hash = lower(p_token_hash);

  if not found then
    return;
  end if;

  -- Obter dados públicos da organização
  select o.name, o.slug into v_org
  from public.organizations o
  where o.id = v_invitation.organization_id;

  -- Devolução de dados estritamente sanitizados (sem IDs de terceiros ou tokens)
  return query
  select
    v_invitation.id,
    v_invitation.organization_id,
    coalesce(v_org.name, 'Workspace'),
    coalesce(v_org.slug, ''),
    v_invitation.email,
    v_invitation.role,
    v_invitation.status,
    v_invitation.expires_at,
    (v_invitation.expires_at < now());
end;
$$;

revoke all on function public.get_invitation_details(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_invitation_details(text, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.get_invitation_details(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_invitation_details(text, text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 8. RPC: public.accept_organization_invitation
-- Atomic transaction with row lock, strict identity validation and team assignment
-- ------------------------------------------------------------------------------
create or replace function public.accept_organization_invitation(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth_user_id uuid;
  v_auth_email text;
  v_invitation record;
  v_org_status text;
  v_team_id uuid;
begin
  -- 1. Validação de Sessão Autenticada
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to accept an invitation.'
    );
  end if;

  -- Obter e-mail verificado do utilizador em auth.users
  select lower(trim(email)) into v_auth_email
  from auth.users
  where id = v_auth_user_id;

  if v_auth_email is null or v_auth_email = '' then
    return jsonb_build_object(
      'success', false,
      'code', 'NO_EMAIL',
      'error', 'Authenticated user does not have a verified email address.'
    );
  end if;

  -- 2. Validação do Formato do Hash
  if p_token_hash is null or length(p_token_hash) <> 64 or p_token_hash !~* '^[0-9a-f]{64}$' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_TOKEN',
      'error', 'Invalid invitation token format.'
    );
  end if;

  -- 3. Bloqueio Pessimista de Linha (FOR UPDATE) para Prevenção de Concorrência e Single-Use
  select * into v_invitation
  from public.organization_invitations
  where token_hash = lower(p_token_hash)
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'error', 'Invitation not found or link has expired.'
    );
  end if;

  -- 4. Verificação de Utilização Única e Estado
  if v_invitation.status = 'accepted' then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_ACCEPTED',
      'error', 'This invitation has already been accepted.'
    );
  elsif v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATUS',
      'error', 'This invitation is no longer active (' || v_invitation.status || ').'
    );
  end if;

  -- 5. Verificação de Expiração
  if v_invitation.expires_at < now() then
    update public.organization_invitations
    set status = 'expired', updated_at = now()
    where id = v_invitation.id;

    return jsonb_build_object(
      'success', false,
      'code', 'EXPIRED',
      'error', 'This invitation has expired. Please request a new invite.'
    );
  end if;

  -- 6. Validação Estrita de Identidade (Prevenção Crítica de Escalada de Privilégios)
  if lower(trim(v_invitation.email)) <> v_auth_email then
    raise exception 'Access denied: This invitation was issued to % but you are signed in as %',
      v_invitation.email, v_auth_email
      using errcode = '42501';
  end if;

  -- 7. Validação de Papel Autorizado
  if v_invitation.role not in ('admin', 'member') then
    raise exception 'Invalid invitation role: %', v_invitation.role
      using errcode = '22023';
  end if;

  -- 8. Validação e Bloqueio da Organização
  select status into v_org_status
  from public.organizations
  where id = v_invitation.organization_id
  for update;

  if v_org_status <> 'active' then
    return jsonb_build_object(
      'success', false,
      'code', 'ORG_INACTIVE',
      'error', 'The workspace is no longer active.'
    );
  end if;

  -- 9. Inserção Idempotente do Membro na Organização
  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    job_title,
    created_at,
    updated_at
  ) values (
    v_invitation.organization_id,
    v_auth_user_id,
    v_invitation.role,
    v_invitation.job_title,
    now(),
    now()
  )
  on conflict (organization_id, user_id) do update
    set job_title = coalesce(organization_members.job_title, excluded.job_title),
        updated_at = now();

  -- 10. Atribuição de Equipas Iniciais com Isolamento Estrito de Tenant
  if v_invitation.initial_team_ids is not null and array_length(v_invitation.initial_team_ids, 1) > 0 then
    foreach v_team_id in array v_invitation.initial_team_ids loop
      -- Valida explicitamente se a equipa pertence à MESMA organização do convite
      if exists (
        select 1 from public.organization_teams
        where id = v_team_id and organization_id = v_invitation.organization_id
      ) then
        insert into public.organization_team_members (
          organization_id,
          team_id,
          user_id,
          created_at
        ) values (
          v_invitation.organization_id,
          v_team_id,
          v_auth_user_id,
          now()
        )
        on conflict (team_id, user_id) do nothing;
      end if;
    end loop;
  end if;

  -- 11. Transição Atómica de Estado para 'accepted'
  update public.organization_invitations
  set status = 'accepted', updated_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.accept_organization_invitation(text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.accept_organization_invitation(text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 9. Defesa em Profundidade: Isolamento Rigoroso de Segredos Internos
-- Garante que internal_system_secrets está inacessível a anon, authenticated e public
-- ------------------------------------------------------------------------------
do $$ begin
  if to_regclass('public.internal_system_secrets') is not null then
    execute 'alter table public.internal_system_secrets enable row level security';
    execute 'revoke all on table public.internal_system_secrets from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'grant select, insert, update on table public.internal_system_secrets to service_role';
    end if;
  end if;
end $$;
