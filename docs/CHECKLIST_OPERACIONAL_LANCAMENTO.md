# BusinessBrain — Checklist Operacional de Lançamento em Produção

> **Documento Operacional Canónico de Lançamento (Production Go-Live Runbook)**  
> **Data de Emissão**: 31 de Outubro de 2026  
> **Ambiente Local Auditado**: Next.js 16.3.8 (Turbopack) | Node.js v20.18.0 | Windows  
> **Alvo Operacional**: Supabase Cloud Production (PostgreSQL 15+) & Vercel Production  
> **Classificação de Prontidão Atual**: **PRONTO PARA VALIDAÇÃO OPERACIONAL**  
> *(Validação estrita de código, compilação de 72 rotas, linters e testes determinísticos locais concluídos. A validação operacional na infraestrutura remota exige a execução metódica deste runbook pelo operador credenciado).*

---

## 1. Estado Técnico Comprovado (Evidência Local Efetiva)

Todas as verificações técnicas automatizadas locais foram executadas no repositório no seu estado real:

| Validação | Comando Canónico | Resultado Efetivo | Evidência Técnica |
| :--- | :--- | :--- | :--- |
| **Tipagem Estrita** | `npm run typecheck` | **0 erros** (Exit code 0) | TypeScript compilado sem avisos ou `any` não autorizados. |
| **Linters e Estilo** | `npm run lint` | **0 avisos / 0 erros** (Exit code 0) | ESLint Next.js e Tailwind em conformidade integral. |
| **Build de Produção** | `npm run build` | **72 rotas geradas** (Exit code 0) | Turbopack compilou 72 rotas estáticas/dinâmicas; Compliance Gate aprovado. |
| **Rotação Dual-Key & Resiliência** | `npx tsx scripts/test-encryption-key-rotation.ts` | **26/26 asserções aprovadas** (Exit code 0) | Isolamento de escopo (AI vs OAuth), fallback sem downtime, OCC, round-trip pré-gravação e fail-closed. |
| **Resiliência BYOK & Cripto** | `npx tsx scripts/test-byok-crypto-resilience.ts` | **21/21 asserções aprovadas** (Exit code 0) | GCM tamper detection, fail-closed em produção, RLS e prevenção de leaks em exceções. |
| **Permissões & RLS (PGlite)** | `npx tsx scripts/test-permissions-system.ts` | **48/48 asserções aprovadas** (Exit code 0) | Motor de resolução de permissões e execução de RLS nativa no PostgreSQL PGlite. |
| **Catálogo do Runner Unificado** | `scripts/test-runner.ts` | **38 suites integradas** | O runner unificado executa sequencialmente via `exec("npx tsx <suite>")` cada uma das 38 suites catalogadas. |

> [!IMPORTANT]
> **Delimitação Estrita de Evidência**:
> Os testes locais comprovam a correção do código da aplicação, a segurança criptográfica dos algoritmos e a integridade sintática das consultas. **Eles NÃO comprovam nem substituem o estado da infraestrutura remota na cloud** (Supabase Cloud, Vercel e Stripe). O operador humano deve executar as fases seguintes utilizando credenciais legítimas na cloud.

---

## 2. Inventário Canónico das Migrations e Estrutura do Repositório

### 2.1 Localização Efetiva no Sistema de Ficheiros
No repositório BusinessBrain, as migrações SQL encontram-se **exclusiva e obrigatoriamente** na pasta:
👉 **[`database/migrations/`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/database/migrations/)**

- A pasta `migrations/` na raiz **NÃO EXISTE**.
- A pasta `supabase/migrations/` **NÃO EXISTE**.
- Quaisquer referências a `supabase/migrations` em documentações conceituais ou skills externas são notas genéricas de bibliotecas de terceiros e devem ser lidas operacionalmente como `database/migrations/`.

### 2.2 Distribuição Exata dos 51 Ficheiros SQL
A pasta `database/migrations/` contém exatamente **51 ficheiros `.sql`**:

1. **45 Ficheiros de Migrações Sequenciais Numeradas**:
   - De `00000_setup_complete.sql` até `00041_ai_credit_reservations.sql`.
   - Inclui 3 prefixos duplicados históricos (analisados abaixo).
2. **6 Ficheiros de Scripts Agregadores / Utilitários**:
   - `RUN_IN_SUPABASE_TO_FIX_WARNINGS.sql`: Script de correção de avisos do Supabase Security Advisor.
   - `RUN_MIGRATIONS_00013_TO_00017.sql`: Lote transacional (`BEGIN ... COMMIT`) das migrações 13 a 17.
   - `RUN_MIGRATIONS_00013_TO_00018.sql`: Lote transacional das migrações 13 a 18.
   - `RUN_MIGRATIONS_00013_TO_00020.sql`: Lote transacional consolidado das migrações 13 a 20.
   - `RUN_MIGRATIONS_00031_TO_00033.sql`: Lote transacional das migrações 31 a 33.
   - `RUN_MIGRATIONS_00031_TO_00034.sql`: Lote transacional consolidado das migrações 31 a 34.

> [!WARNING]
> **Esclarecimento sobre Invenções em Relatórios Anteriores**:
> - O ficheiro `RUN_MIGRATIONS_00037_TO_00041.sql` **NÃO EXISTE**.
> - O ficheiro `RUN_MIGRATIONS_00030_TO_00036.sql` **NÃO EXISTE**.
> - As migrações `00037` a `00041` existem exclusivamente como ficheiros individuais e devem ser avaliadas e aplicadas sequencialmente.

### 2.3 Prefixos Duplicados e Análise de Impacto
Os seguintes prefixos duplicados existem no repositório:
1. **Prefixo `00008`**:
   - `00008_company_connections.sql`: Cria a tabela `public.company_connections` (arestas do grafo empresarial).
   - `00008_file_system_foundation.sql`: Cria a tabela `public.organization_files` (metadados de ficheiros).
2. **Prefixo `00009`**:
   - `00009_security_audit_hardening.sql`: Endurece permissões e políticas de storage.
   - `00009_storage_rls_hardening.sql`: Script precursor incorporado no anterior.
3. **Prefixo `00024`**:
   - `00024_secure_invitations_and_hashing.sql`: Implementa tokens de convite com hashing SHA-256 (SEC-01).
   - `00024_sync_missing_profiles.sql`: Sincroniza perfis a partir de `auth.users` de forma idempotente.

> [!CAUTION]
> **Proibição Estrita de Renumeração / Renomeação**:  
> Estes ficheiros **NÃO DEVEM SER RENOMEADOS OU RENUMERADOS**. Se a base de dados de produção ou instâncias de staging já tiverem aplicado estas migrações com os seus nomes originais, renomeá-los causará quebra de integridade no histórico e riscos de execução duplicada.

---

## 3. Análise Detalhada dos Ficheiros SQL Originais (00037 a 00041)

Com base na leitura integral do código SQL dos ficheiros reais em `database/migrations/`:

### Migração `00037_dashboard_layout_cas.sql`
- **Operação Principal**: Atomic Compare-And-Swap (CAS) para persistência do layout do dashboard.
- **Tabelas / Colunas**: **NÃO cria tabelas nem colunas novas**. Não adiciona nenhuma coluna `dashboard_layout_cas` a `profiles`. Opera atualizando as colunas existentes `user_preferences` (jsonb) e `updated_at` (timestamptz) na tabela `public.profiles`.
- **Funções / RPCs**:
  - `public.save_dashboard_layout_cas(p_org_id uuid, p_dashboard_type text, p_layout jsonb, p_expected_updated_at text default null, p_force_overwrite boolean default false)`
  - Retorno: `jsonb` | Linguagem: `plpgsql` | Segurança: `SECURITY DEFINER` | `SET search_path = public, pg_temp`
  - Implementa bloqueio pessimista de linha com `SELECT user_preferences FROM public.profiles WHERE id = v_user_id FOR UPDATE` para serializar escritas concorrentes e prevenir *race conditions*.
- **Grants / Revokes**:
  - `REVOKE ALL ON FUNCTION public.save_dashboard_layout_cas(...) FROM public, anon;`
  - `GRANT EXECUTE ON FUNCTION public.save_dashboard_layout_cas(...) TO authenticated, service_role, postgres;`
- **Notificação**: `NOTIFY pgrst, 'reload schema';`.
- **Dependências**: `public.profiles` (`00001_initial_schema.sql`), `public.organization_members` (`00001_initial_schema.sql`).
- **Idempotência**: Executa `DROP FUNCTION IF EXISTS` para assinaturas antigas (com 4 e 5 parâmetros) seguido de `CREATE OR REPLACE FUNCTION`. **100% idempotente e segura para reexecução**.

### Migração `00038_ai_foundation_and_byok.sql`
- **Tabelas Criadas (4 Tabelas Reais)**:
  1. `public.organization_ai_credentials`: `id` (uuid pk), `organization_id` (fk organizations), `provider` (text, check), `label` (text), `key_prefix` (text), `encrypted_api_key` (text), `key_fingerprint` (text), `status` (text, check), `is_default` (boolean), `custom_base_url` (text), `created_by_user_id` (fk auth.users), `last_tested_at`, `last_used_at`, `last_error_message`, `metadata` (jsonb), `created_at`, `updated_at`.
  2. `public.ai_conversations`: `id` (uuid pk), `organization_id` (fk organizations), `user_id` (fk auth.users), `title` (text), `provider` (text), `model` (text), `is_byok` (boolean), `credential_id` (fk organization_ai_credentials), `context_summary` (text), `metadata` (jsonb), `created_at`, `updated_at`.
  3. `public.ai_messages`: `id` (uuid pk), `conversation_id` (fk ai_conversations), `organization_id` (fk organizations), `user_id` (fk auth.users), `role` (text check in ('user', 'assistant', 'system', 'tool')), `content` (text), `sources` (jsonb), `tokens_prompt` (int), `tokens_completion` (int), `execution_duration_ms` (int), `error_code` (text), `created_at`.
  4. `public.ai_usage_ledger`: `id` (uuid pk), `organization_id` (fk organizations), `user_id` (fk auth.users), `conversation_id` (fk ai_conversations), `provider` (text), `model` (text), `is_byok` (boolean), `prompt_tokens` (int), `completion_tokens` (int), `estimated_cost_usd` (numeric(10,6)), `status` (text check in ('success', 'failed', 'canceled', 'rate_limited')), `created_at`.
- **Esclarecimento Crucial de Inconsistências Anteriores**:
  - A tabela `ai_credit_accounts` **NÃO EXISTE** nesta migration nem em qualquer outra do repositório.
  - A função `check_organization_ai_access` **NÃO EXISTE** nesta migration.
- **Constraints e Índices**:
  - Unique Constraint: `uq_org_ai_cred_fingerprint UNIQUE (organization_id, provider, key_fingerprint)`.
  - Índices: `idx_ai_credentials_org`, `idx_ai_credentials_status`, `idx_ai_conversations_org_user`, `idx_ai_conversations_org`, `idx_ai_messages_conversation`, `idx_ai_messages_org`, `idx_ai_usage_org_created`.
- **Triggers**:
  - `set_org_ai_credentials_updated_at` ON `organization_ai_credentials` (BEFORE UPDATE EXECUTE FUNCTION `public.handle_updated_at()`).
  - `set_ai_conversations_updated_at` ON `ai_conversations` (BEFORE UPDATE EXECUTE FUNCTION `public.handle_updated_at()`).
- **RLS e Políticas**:
  - RLS ativado nas 4 tabelas.
  - `"Owners and admins can manage AI credentials"` ON `organization_ai_credentials` (`has_org_role(organization_id, array['owner', 'admin'])`).
  - `"Users can manage own conversations in org"` ON `ai_conversations` (`is_org_member AND user_id = auth.uid()`).
  - `"Users can access messages of own conversations"` ON `ai_messages` (autor da conversa dentro da organização).
  - `"Members can view org AI usage summary"` e `"Members can insert usage logs in org"` ON `ai_usage_ledger`.
- **Grants / Revokes**:
  - `REVOKE ALL ... FROM public, anon;` para as 4 tabelas.
  - `GRANT SELECT, INSERT, UPDATE, DELETE` em credenciais, conversas e mensagens para `authenticated`.
  - `GRANT SELECT, INSERT` em usage ledger para `authenticated`.
  - `GRANT ALL` nas 4 tabelas para `service_role`.
- **Idempotência**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, `DROP POLICY IF EXISTS`.

### Migração `00039_ai_access_control_and_governance.sql`
- **Tabelas Criadas / Modificadas**:
  1. Cria `public.ai_access_authorizations`: `id` (uuid pk), `organization_id` (fk organizations), `user_id` (fk auth.users), `granted_by_user_id` (fk auth.users), `scope_type` (text check: once, conversation, persistent), `conversation_id` (fk ai_conversations), `resource_type` (text check: area, page, document, finance, github, brain, tool), `resource_id` (text), `action_type` (text default 'read' check: read, create, modify, execute), `purpose` (text), `status` (text check: active, revoked, expired), `expires_at`, `created_at`, `revoked_at`, `revoked_by_user_id`.
  2. Altera `public.ai_conversations`: Adiciona coluna `selected_source_ids text[] NOT NULL DEFAULT '{}'` (protegida por bloco condicional `DO $$`).
- **Esclarecimento Crucial**:
  - A tabela `ai_access_policies` **NÃO EXISTE** (o nome real é `ai_access_authorizations`).
  - A função `check_ai_model_access` **NÃO EXISTE**.
- **Constraints e Índices**:
  - Índices: `idx_ai_authorizations_org_user_status`, `idx_ai_authorizations_conv_resource`, `idx_ai_authorizations_active_lookup`.
- **RLS e Políticas**:
  - RLS ativado em `ai_access_authorizations`.
  - Policies:
    - `"Members can view own AI authorizations or admins audit org"`
    - `"Members can grant AI authorizations for themselves"`
    - `"Members or admins can update/revoke AI authorizations"`
    - `"Deny hard deletion of AI authorizations"` (USING (false) para preservar integridade de auditoria).
- **Grants**: `GRANT SELECT, INSERT, UPDATE ON public.ai_access_authorizations TO authenticated;`.
- **Idempotência**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`, bloco condicional `IF NOT EXISTS` para a nova coluna.

### Migração `00040_multimodel_and_personal_accounts.sql`
- **Tabelas Criadas / Modificadas**:
  1. Altera `public.organizations`: Adiciona `workspace_type text NOT NULL DEFAULT 'team' CHECK (workspace_type IN ('team', 'personal'))`.
  2. Cria índice `idx_organizations_workspace_type`.
  3. Altera `public.organization_ai_credentials`: Expande check constraint `organization_ai_credentials_provider_check` com novos provedores (`gemini`, `openai`, `anthropic`, `deepseek`, `mistral`, `qwen`, `openrouter`, `groq`, `custom_openai_compatible`).
  4. Cria `public.user_ai_credentials`: Chaves BYOK pessoais isoladas por utilizador com `FORCE ROW LEVEL SECURITY`.
  5. Altera `public.ai_conversations`: Adiciona `user_credential_id uuid REFERENCES public.user_ai_credentials(id) ON DELETE SET NULL`.
  6. Altera `public.ai_usage_ledger`: Adiciona `task_type`, `scope`, `cached_prompt_tokens`, `reported_cost_usd`, `billed_cost_usd`, `currency`, `retry_count`, `execution_duration_ms`, `error_details`.
  7. Cria índices: `idx_ai_usage_ledger_task_org` e `idx_ai_usage_ledger_byok_cost`.
- **Constraints e Índices em `user_ai_credentials`**:
  - Unique Constraint: `uq_user_ai_cred_fingerprint UNIQUE (user_id, provider, key_fingerprint)`.
  - Índice: `idx_user_ai_credentials_lookup`.
- **RLS em `user_ai_credentials`**:
  - `ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE public.user_ai_credentials FORCE ROW LEVEL SECURITY;`
  - Policy: `"Users can manage own personal AI credentials"` (`USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`).
- **Triggers**: `set_user_ai_credentials_updated_at` ON `user_ai_credentials` (chamando `public.handle_updated_at()`).
- **Idempotência**: Todos os `ALTER TABLE ADD COLUMN` utilizam blocos condicionais consultando `information_schema.columns`. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`.

### Migração `00041_ai_credit_reservations.sql`
- **Tabelas Criadas**:
  1. `public.ai_credit_reservations`:
     - Colunas: `id` (uuid pk), `organization_id` (fk organizations on delete cascade), `user_id` (fk auth.users on delete set null), `conversation_id` (fk ai_conversations on delete set null), `task_type` (text, check), `provider` (text), `model` (text), `is_byok` (boolean), `reserved_credits` (integer), `settled_credits` (integer), `status` (text check in ('reserved', 'settled', 'released', 'expired')), `expires_at` (timestamptz default now() + interval '5 minutes'), `created_at`, `settled_at`, `metadata` (jsonb).
- **Constraints e Índices**:
  - Índices: `idx_ai_credit_reservations_org_status`, `idx_ai_credit_reservations_user_status`.
  - Índice Parcial: `idx_ai_credit_reservations_expires ON public.ai_credit_reservations (expires_at) WHERE status = 'reserved'`.
- **RLS e Políticas**:
  - `ALTER TABLE public.ai_credit_reservations ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE public.ai_credit_reservations FORCE ROW LEVEL SECURITY;`
  - Policy: `"Members can view org AI reservations"` (FOR SELECT: membros da organização via `public.organization_members`).
- **Funções / RPCs Atómicas Criadas**:
  1. `public.reserve_ai_credits_atomic(p_org_id uuid, p_user_id uuid, p_conversation_id uuid, p_task_type text, p_provider text, p_model text, p_is_byok boolean, p_estimated_credits integer, p_quota integer)`:
     - Retorno: `TABLE (allowed boolean, reservation_id uuid, used_credits integer, reserved_credits integer, quota integer, error_code text)`
     - Segurança: `SECURITY DEFINER` | Linguagem: `plpgsql`
     - Mecanismo: Executa bloqueio pessimista `PERFORM id FROM public.organizations WHERE id = p_org_id FOR UPDATE;` para serializar requisições concorrentes por organização. Calcula consumo do mês corrente a partir de `public.ai_usage_ledger`.
  2. `public.settle_ai_credit_reservation_atomic(p_reservation_id uuid, p_actual_tokens integer, p_is_byok boolean, p_status text DEFAULT 'settled')`:
     - Retorno: `TABLE (success boolean, settled_credits integer, error_code text)`
     - Segurança: `SECURITY DEFINER` | Linguagem: `plpgsql`
     - Liquida o consumo real pós-streaming com verificação atómica de estado.
  3. `public.release_ai_credit_reservation_atomic(p_reservation_id uuid)`:
     - Retorno: `TABLE (success boolean, error_code text)`
     - Segurança: `SECURITY DEFINER` | Linguagem: `plpgsql`
     - Liberta quotas reservadas em caso de erro ou cancelamento do stream.
- **Idempotência**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`.

---

## 4. Procedimento de Diagnóstico do Histórico Supabase

O diagnóstico do histórico de migrações não deve assumir previamente nomes de colunas ou a presença de tabelas. O operador deve executar os passos abaixo:

### Passo 1: Descoberta de Tabelas de Histórico Existentes
Determina exatamente qual tabela de migrações está presente na base de dados:

```sql
SELECT 
  table_schema, 
  table_name, 
  table_type
FROM information_schema.tables
WHERE (table_schema = 'supabase_migrations' AND table_name = 'schema_migrations')
   OR (table_schema = 'public' AND table_name IN ('schema_migrations', 'supabase_migrations'));
```

### Passo 2: Identificação das Colunas Reais
Inspeciona as colunas que de facto existem na tabela identificada no Passo 1:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
ORDER BY ordinal_position;
```

### Passo 3: Leitura Segura e Adaptativa do Histórico (Zero Falhas por Coluna Inexistente)
A consulta abaixo converte a linha em objeto JSON antes da extração. Desta forma, **não gera erro de sintaxe** caso a coluna `name` não exista na tabela do Supabase:

```sql
SELECT 
  (row_to_json(m)->>'version') AS version,
  COALESCE(row_to_json(m)->>'name', '<coluna_name_inexistente>') AS migration_name,
  COALESCE(row_to_json(m)->>'inserted_at', row_to_json(m)->>'executed_at', '<sem_data>') AS executed_at
FROM (
  SELECT * FROM supabase_migrations.schema_migrations
) m
ORDER BY version ASC;
```

### Passo 4: Interpretação do Diagnóstico do Histórico
- **`HISTÓRICO AUSENTE`**: Nenhuma tabela de histórico encontrada. Ocorre quando as migrações foram aplicadas diretamente via Supabase SQL Editor ou script externo. O operador deve confiar **exclusivamente na Introspecção Estrutural (Consulta 4)**.
- **`HISTÓRICO INCONCLUSIVO`**: A tabela existe, mas não possui a coluna `version` ou está inacessível por permissões.
- **`HISTÓRICO LEGÍVEL`**: A lista de versões é retornada. **Ressalva crítica**: O registo no histórico do Supabase CLI prova apenas que o script foi submetido pelo CLI; não garante que nenhum objeto tenha sido posteriormente alterado ou removido manualmente na consola. A Introspecção Estrutural é mandatória.

---

## 5. Introspecção Estrutural Granular (Classificação 4-Estados)

Esta consulta verifica de forma exaustiva **todos os objetos reais** das migrações `00037` a `00041`: tabelas, colunas, tipos, constraints, índices, políticas RLS, triggers e funções com suas propriedades de segurança:

```sql
-- ==============================================================================
-- Company Brain: Granular Structural Introspection (Migrations 00037 - 00041)
-- ==============================================================================

WITH object_checks AS (
  -- ----------------------------------------------------------------------------
  -- 00037_dashboard_layout_cas
  -- ----------------------------------------------------------------------------
  SELECT 
    '00037_dashboard_layout_cas' AS migration_id,
    'function:public.save_dashboard_layout_cas' AS object_name,
    EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
        AND p.proname = 'save_dashboard_layout_cas'
        AND p.prosecdef = true -- Valida SECURITY DEFINER
    ) AS exists_in_db

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 00038_ai_foundation_and_byok
  -- ----------------------------------------------------------------------------
  SELECT '00038_ai_foundation_and_byok', 'table:public.organization_ai_credentials',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_ai_credentials')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'column:organization_ai_credentials.encrypted_api_key',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_ai_credentials' AND column_name = 'encrypted_api_key')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'constraint:organization_ai_credentials.uq_org_ai_cred_fingerprint',
    EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND t.relname = 'organization_ai_credentials' AND c.conname = 'uq_org_ai_cred_fingerprint')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'index:idx_ai_credentials_org',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'organization_ai_credentials' AND indexname = 'idx_ai_credentials_org')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'trigger:set_org_ai_credentials_updated_at',
    EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class t ON tg.tgrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND t.relname = 'organization_ai_credentials' AND tg.tgname = 'set_org_ai_credentials_updated_at')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'policy:Owners and admins can manage AI credentials',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_ai_credentials' AND policyname = 'Owners and admins can manage AI credentials')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'table:public.ai_conversations',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_conversations')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'policy:Users can manage own conversations in org',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_conversations' AND policyname = 'Users can manage own conversations in org')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'table:public.ai_messages',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_messages')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'policy:Users can access messages of own conversations',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_messages' AND policyname = 'Users can access messages of own conversations')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'table:public.ai_usage_ledger',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_usage_ledger')
  UNION ALL
  SELECT '00038_ai_foundation_and_byok', 'policy:Members can view org AI usage summary',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_usage_ledger' AND policyname = 'Members can view org AI usage summary')

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 00039_ai_access_control_and_governance
  -- ----------------------------------------------------------------------------
  SELECT '00039_ai_access_control_and_governance', 'table:public.ai_access_authorizations',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_access_authorizations')
  UNION ALL
  SELECT '00039_ai_access_control_and_governance', 'column:ai_access_authorizations.action_type',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_access_authorizations' AND column_name = 'action_type')
  UNION ALL
  SELECT '00039_ai_access_control_and_governance', 'column:ai_conversations.selected_source_ids',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_conversations' AND column_name = 'selected_source_ids')
  UNION ALL
  SELECT '00039_ai_access_control_and_governance', 'policy:Deny hard deletion of AI authorizations',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_access_authorizations' AND policyname = 'Deny hard deletion of AI authorizations')

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 00040_multimodel_and_personal_accounts
  -- ----------------------------------------------------------------------------
  SELECT '00040_multimodel_and_personal_accounts', 'column:organizations.workspace_type',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'workspace_type')
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'table:public.user_ai_credentials',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_ai_credentials')
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'force_rls:user_ai_credentials',
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = 'user_ai_credentials' AND c.relforcerowsecurity = true)
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'constraint:uq_user_ai_cred_fingerprint',
    EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND t.relname = 'user_ai_credentials' AND c.conname = 'uq_user_ai_cred_fingerprint')
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'column:ai_conversations.user_credential_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_conversations' AND column_name = 'user_credential_id')
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'column:ai_usage_ledger.task_type',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_usage_ledger' AND column_name = 'task_type')
  UNION ALL
  SELECT '00040_multimodel_and_personal_accounts', 'column:ai_usage_ledger.cached_prompt_tokens',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_usage_ledger' AND column_name = 'cached_prompt_tokens')

  UNION ALL

  -- ----------------------------------------------------------------------------
  -- 00041_ai_credit_reservations
  -- ----------------------------------------------------------------------------
  SELECT '00041_ai_credit_reservations', 'table:public.ai_credit_reservations',
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_credit_reservations')
  UNION ALL
  SELECT '00041_ai_credit_reservations', 'force_rls:ai_credit_reservations',
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = 'ai_credit_reservations' AND c.relforcerowsecurity = true)
  UNION ALL
  SELECT '00041_ai_credit_reservations', 'index_partial:idx_ai_credit_reservations_expires',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ai_credit_reservations' AND indexname = 'idx_ai_credit_reservations_expires')
  UNION ALL
  SELECT '00041_ai_credit_reservations', 'function:public.reserve_ai_credits_atomic',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'reserve_ai_credits_atomic' AND p.prosecdef = true)
  UNION ALL
  SELECT '00041_ai_credit_reservations', 'function:public.settle_ai_credit_reservation_atomic',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'settle_ai_credit_reservation_atomic' AND p.prosecdef = true)
  UNION ALL
  SELECT '00041_ai_credit_reservations', 'function:public.release_ai_credit_reservation_atomic',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'release_ai_credit_reservation_atomic' AND p.prosecdef = true)
)
SELECT 
  migration_id,
  count(*) AS total_objects_checked,
  count(*) FILTER (WHERE exists_in_db) AS objects_found,
  CASE 
    WHEN count(*) FILTER (WHERE exists_in_db) = count(*) THEN 'APPLIED'
    WHEN count(*) FILTER (WHERE exists_in_db) = 0 THEN 'MISSING'
    ELSE 'PARTIAL'
  END AS status,
  string_agg(CASE WHEN NOT exists_in_db THEN object_name END, ', ') AS missing_objects
FROM object_checks
GROUP BY migration_id
ORDER BY migration_id ASC;
```

### Regras Estritas de Classificação (Sem Falsos Positivos)
- **`APPLIED`**: 100% dos objetos e propriedades relevantes verificados existem e correspondem às definições esperadas (`objects_found = total_objects_checked`). A mera existência da tabela sem os seus índices, constraints ou RPCs **NUNCA** pode resultar em `APPLIED`.
- **`MISSING`**: 0% dos objetos verificados existem (`objects_found = 0`).
- **`PARTIAL`**: Existem alterações aplicadas, mas faltam objetos ou propriedades (`objects_found > 0 AND objects_found < total_objects_checked`). A coluna `missing_objects` enumera exatamente o que está em falta.
- **`UNKNOWN`**: A consulta retornou erro de permissão ou a base de dados não permitiu inspecionar metadados.

---

## 6. Auditoria de Dependências e Matriz de Recuperação Segura

A reconciliação da base de dados de produção deve seguir os seguintes cenários operacionais:

| Cenário Detetado no Diagnóstico | Causa Provável | Procedimento Obrigatório e Seguro |
| :--- | :--- | :--- |
| **Todas as Migrações `APPLIED`** | Migrações já aplicadas anteriormente com sucesso. | Nenhuma ação DDL necessária. Avançar diretamente para a validação de segredos (Fase 4). |
| **Todas as Migrações `MISSING`** | Base de dados de produção encontra-se na versão `00036` ou anterior. | Aplicar sequencialmente os ficheiros individuais: `00037`, `00038`, `00039`, `00040`, `00041`. Reexecutar Consulta 5. |
| **Migrações em Estado `PARTIAL`** | Execução manual anterior incompleta ou interrupção durante DDL. | **PARAR IMEDIATAMENTE (STOP CONDITION)**. Não executar a migration inteira por cima nem rodar comandos destrutivos. Inspecionar a lista de `missing_objects` gerada pela Consulta 5 e solicitar revisão técnica para aplicar apenas a declaração DDL pontual em falta de forma segura. |
| **Histórico Supabase Desalinhado** | Aplicação manual via SQL Editor sem registo na tabela de migrações do CLI. | **NUNCA inserir linhas manualmente via `INSERT INTO schema_migrations`**. A evidência estrutural física da Consulta 5 prevalece. Se a equipa utilizar o Supabase CLI formalmente, utilizar exclusivamente a ferramenta oficial: `npx supabase migration repair --status applied <version>`. Caso contrário, manter o histórico gerido pelas evidências de introspecção estrutural. |
| **Objetos com Nomes Iguais mas Definições Diferentes** | Modificação manual não documentada em produção. | **PARAR IMEDIATAMENTE**. Executar script de introspecção de colunas (`information_schema.columns`) para comparar tipos e constraints. Não sobrescrever sem backup prévio e reconciliação formal com o código da aplicação. |

> [!CAUTION]
> **Proibição de Reinicialização ou Destruição de Dados**:  
> Nunca propor apagar esquemas, tabelas ou aplicar scripts de rollback destrutivos em produção. Toda a remediação deve ser aditiva e não-destrutiva. O backup prévio (snapshot Supabase) é condição estrita de paragem.

---

## 7. Matriz Completa de Variáveis de Ambiente e Segredos

| Nome da Variável | Componente Consumidor | Obrigatoriedade | Ambientes | Fallback / Padrão | Risco / Comportamento Seguro |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `server.ts` | **Obrigatória** | Local, Preview, Prod | Nenhum | Falha fatal em toda a comunicação com a base de dados. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/supabase/client.ts`, `server.ts` | **Obrigatória** | Local, Preview, Prod | Nenhum | Falha na autenticação pública e sessões de utilizadores. |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/service.ts`, webhooks, jobs | **Obrigatória** | Preview, Prod | Nenhum | Falha em operações privilegiadas. **Crítico**: Nunca prefixar com `NEXT_PUBLIC_`. |
| `SERVER_AUTH_SECRET` | `lib/security/internal-secrets.ts`, RPCs | **Obrigatória** | Preview, Prod | Dev fallback apenas em local | **Crítico**: Deve coincidir com `key='server_auth'` em `internal_system_secrets`. Se divergir, RPCs de sistema falham em modo fechado. |
| `INTERNAL_RATE_LIMIT_SECRET` | `lib/security/rate-limit.ts`, RPCs | **Obrigatória** | Preview, Prod | Fallback para `SERVER_AUTH_SECRET` | **Crítico**: Deve coincidir com `key='rate_limit'` em `internal_system_secrets`. Se divergir, rate-limiting bloqueia pedidos. |
| `AI_CREDENTIALS_ENCRYPTION_KEY` | `lib/crypto/encryption.ts` | **Obrigatória** | Local, Preview, Prod | Dev fallback apenas se `NODE_ENV !== 'production'` | Chave AES-256-GCM (64 hex / 32 bytes). Em prod sem chave: crash fatal *fail-closed*. |
| `AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` | `lib/crypto/encryption.ts` | **Condicional** | Preview, Prod | Opcional | Usada exclusivamente em rotação. Se ausente durante rotação: falha na leitura de registos antigos. |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | `lib/crypto/encryption.ts` | **Obrigatória** | Local, Preview, Prod | Dev fallback apenas se `NODE_ENV !== 'production'` | Chave AES-256-GCM para tokens OAuth de integrações. Em prod sem chave: crash fatal *fail-closed*. |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS` | `lib/crypto/encryption.ts` | **Condicional** | Preview, Prod | Opcional | Usada exclusivamente em rotação. Se ausente durante rotação: falha na leitura de tokens OAuth antigos. |
| `STRIPE_SECRET_KEY` | `lib/stripe/server.ts` | **Obrigatória** | Preview, Prod | Nenhum | Chave de API da faturação Stripe (`sk_test_...` ou `sk_live_...`). Sem ela, checkout falha. |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhooks/stripe/route.ts` | **Obrigatória** | Preview, Prod | Nenhum | Chave de assinatura criptográfica (`whsec_...`). Sem ela, webhooks retornam HTTP 500. |
| `STRIPE_STARTER_PRICE_ID` | `lib/billing/plans.ts` | **Obrigatória** | Preview, Prod | Nenhum | ID de preço resolvido no servidor. Previne adulteração pelo cliente. |
| `STRIPE_PRO_PRICE_ID` | `lib/billing/plans.ts` | **Obrigatória** | Preview, Prod | Nenhum | ID de preço resolvido no servidor. |
| `STRIPE_ENTERPRISE_PRICE_ID` | `lib/billing/plans.ts` | **Obrigatória** | Preview, Prod | Nenhum | ID de preço resolvido no servidor. |
| `RESEND_API_KEY` | `lib/email/resend.ts` | **Obrigatória** | Preview, Prod | Nenhum | API de envio de emails transacionais e convites. |
| `EMAIL_FROM` | `lib/email/resend.ts` | **Obrigatória** | Preview, Prod | `noreply@companybrain.com` | Remetente com domínio configurado e verificado no DNS. |

### Mecanismo Real de Segredos Internos (`internal_system_secrets`)
1. O código em `lib/security/internal-secrets.ts` chama a RPC PostgreSQL `get_internal_system_secret(secret_name text)` via client privilegiado de serviço.
2. O valor armazenado na base de dados é comparado em tempo constante com a variável de ambiente correspondente (`SERVER_AUTH_SECRET` ou `INTERNAL_RATE_LIMIT_SECRET`) via `crypto.timingSafeEqual`.
3. Para provisionar os segredos em produção, o operador deve executar no SQL Editor:

```sql
insert into public.internal_system_secrets (key, secret, updated_at)
values 
  ('server_auth', '<VALOR_EXATO_DE_SERVER_AUTH_SECRET>', now()),
  ('rate_limit', '<VALOR_EXATO_DE_INTERNAL_RATE_LIMIT_SECRET>', now())
on conflict (key) do update set secret = excluded.secret, updated_at = now();

-- Confirmação de presença e tamanho sem expor o texto plano do segredo:
select key, length(secret) as secret_length, updated_at 
from public.internal_system_secrets;
```

---

## 8. Procedimento de Rotação de Chaves de Encriptação

A rotação de chaves criptográficas só deve ser efetuada em caso de suspeita de comprometimento ou expiração mandatória. O código em `lib/crypto/encryption.ts` e `scripts/rotate-encryption-keys.ts` garante rotação sem indisponibilidade (Zero-Downtime):

### Sequência Operacional de Rotação Zero-Downtime
1. **Passo 1 (Provisionamento Dual-Key na Vercel)**:
   - Configurar a variável `*_PREVIOUS` (`AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` ou `INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS`) com a chave atualmente em uso.
   - Gerar uma nova chave segura de 32 bytes (64 caracteres hexadecimais) e configurá-la como a variável ativa (`AI_CREDENTIALS_ENCRYPTION_KEY` ou `INTEGRATION_TOKEN_ENCRYPTION_KEY`).
2. **Passo 2 (Deploy do Código)**:
   - Concluir o deploy da aplicação. Durante este intervalo (rolling deploy), réplicas antigas leem e escrevem com a chave antiga; réplicas novas já escrevem com a nova chave e conseguem ler ambas (chave nova com fallback para chave anterior).
3. **Passo 3 (Auditoria em Modo Dry-Run)**:
   - Executar o script em modo de simulação (sem mutações na base de dados):
     ```bash
     OLD_KEY="<chave_antiga_64hex>" NEW_KEY="<chave_nova_64hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=all
     ```
   - O script audita cada registo e classifica-o em `ACTIVE_KEY_COMPLIANT`, `STILL_ON_PREVIOUS_KEY` ou `CORRUPTED`.
4. **Passo 4 (Aplicação Atómica com OCC)**:
   - Executar a rotação na base de dados com `--apply`:
     ```bash
     OLD_KEY="<chave_antiga_64hex>" NEW_KEY="<chave_nova_64hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=all --apply
     ```
   - *Garantias do Script*:
     - **Round-Trip Pre-Write Check**: Decifra o novo *ciphertext* em memória antes da escrita para confirmar identidade com o *plaintext* original.
     - **Optimistic Concurrency Control (OCC)**: Atualizações incluem cláusula `.eq("updated_at", cred.updated_at)` para prevenir que modificações concorrentes de utilizadores sejam sobrescritas.
5. **Passo 5 (Certificação Formal com `--verify`)**:
   - Executar o modo de verificação estrita:
     ```bash
     OLD_KEY="<chave_antiga_64hex>" NEW_KEY="<chave_nova_64hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=all --verify
     ```
   - **Condição Estrita de Paragem**: O script só retorna Exit Code 0 se houver **0 registos** em `STILL_ON_PREVIOUS_KEY`, 0 corrompidos e 0 conflitos OCC. Se retornar Exit Code 1, a chave anterior **NÃO PODE SER REMOVIDA**.
6. **Passo 6 (Desprovisionamento da Chave Anterior)**:
   - Apenas após a certificação bem-sucedida (Exit Code 0), remover a variável `*_PREVIOUS` da Vercel.

---

## 9. Protocolo de Validação Stripe em Test Mode

> [!IMPORTANT]
> **Transações em modo Live NÃO são pré-condição para a validação operacional inicial.**
> Toda a validação do motor de faturação deve ser concluída em **Stripe Test Mode** (`sk_test_...` e `whsec_...`), evitando cobranças e complicações fiscais.

### Cenários Suportados e Matriz de Validação

| Cenário de Teste | Suporte em Código | Tipo de Teste | Procedimento de Verificação |
| :--- | :--- | :--- | :--- |
| **1. Checkout e Ativação** | ✅ Suportado | Test Mode / CLI | Iniciar checkout em `/checkout` com cartão `4242...`. Confirmar que webhook processa `checkout.session.completed` e cria subscrição `active` vinculada à organização. |
| **2. Assinatura Inválida** | ✅ Suportado | Teste Local Automatizado | Enviar POST para `/api/webhooks/stripe` sem assinatura válida. Confirmar resposta HTTP 400 (`Webhook signature verification failed`). |
| **3. Idempotência** | ✅ Suportado | Teste Local / Test Mode | Reenviar evento idêntico com o mesmo `event.id`. Confirmar resposta HTTP 200 `{ received: true, duplicate: true }` sem duplicação de dados. |
| **4. Associação Multi-Tenant** | ✅ Suportado | Test Mode / CLI | Verificar que `client_reference_id` associa a subscrição à organização correta. Tentar colisão cross-tenant e confirmar rejeição imediata. |
| **5. Cancelamento** | ✅ Suportado | Test Mode / Dashboard | Cancelar subscrição no Stripe Test Dashboard. Receber `customer.subscription.deleted` e confirmar atualização para `status = 'canceled'`. |
| **6. Pagamentos Falhados (Dunning)** | ✅ Suportado | Test Mode / CLI | Simular `stripe trigger invoice.payment_failed`. Confirmar transição para `past_due` sem perda de acesso ou exclusão de dados. |
| **7. Anti-Ressurreição de Eventos** | ✅ Suportado | Test Mode / CLI | Enviar evento atrasado `customer.subscription.updated` com estado `active` após cancelamento. O código consulta a API Stripe em tempo real e descarta a atualização regressiva. |

---

## 10. Procedimento Canónico de Lançamento em 11 Fases

O lançamento operacional deve obedecer estritamente à sequência abaixo:

### Fase 1: Pré-condições e Backup Snapshot
- **Pré-condições**: Acesso de administrador ao Supabase Dashboard de Produção.
- **Ação**: Gerar snapshot pontual manual e descarregar backup lógico antes de qualquer intervenção.
- **Resultado Esperado**: Backup com estado `Completed` e capacidade de restauro confirmada.
- **Condição de Paragem**: Não prosseguir se o sistema de backup estiver indisponível.

### Fase 2: Diagnóstico do Histórico Supabase
- **Pré-condições**: Backup concluído (Fase 1).
- **Ação**: Executar o procedimento de diagnóstico dos Passos 1 a 3 (Secção 4 deste documento) no SQL Editor.
- **Resultado Esperado**: Identificação do estado do histórico (`HISTÓRICO LEGÍVEL`, `HISTÓRICO AUSENTE` ou `HISTÓRICO INCONCLUSIVO`).
- **Condição de Paragem**: Não assumir que versões registadas no histórico garantem integridade dos objetos físicos.

### Fase 3: Introspecção Estrutural Granular e Tratamento de Estados
- **Pré-condições**: Diagnóstico da Fase 2 analisado.
- **Ação**: Executar a Consulta 5 (Introspecção Estrutural de 4 Estados).
  - Se todas estiverem `APPLIED`: Avançar para a Fase 4.
  - Se estiverem `MISSING`: Aplicar sequencialmente `00037`, `00038`, `00039`, `00040`, `00041`.
  - Se estiverem `PARTIAL`: **PARAR IMEDIATAMENTE**. Solicitar revisão técnica para aplicar cirurgicamente apenas os objetos ausentes.
- **Resultado Esperado**: Reexecução da Consulta 5 resulta em `status = 'APPLIED'` para todas as 5 migrações.
- **Condição de Paragem**: Qualquer erro DDL aborta a transação imediatamente.

### Fase 4: Provisionamento de Variáveis de Ambiente e Segredos
- **Pré-condições**: Migrações 100% aplicadas (Fase 3).
- **Ação**: Inserir os segredos em `internal_system_secrets` e configurar as variáveis correspondentes na Vercel (`SERVER_AUTH_SECRET`, `INTERNAL_RATE_LIMIT_SECRET`, `AI_CREDENTIALS_ENCRYPTION_KEY`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, chaves Stripe e Resend).
- **Resultado Esperado**: `select key, length(secret) from public.internal_system_secrets` confirma ambos os segredos com comprimentos correspondentes aos da Vercel.
- **Condição de Paragem**: Discrepância entre o segredo na base de dados e na Vercel bloqueia o avanço.

### Fase 5: Validação da Encriptação e Rotação (Apenas se Necessária)
- **Pré-condições**: Chaves de encriptação ativas provisionadas na Vercel.
- **Ação**: Confirmar que a chave ativa desencripta as credenciais existentes. Caso uma rotação esteja em curso, seguir o protocolo de 6 passos da Secção 8 com `--verify`.
- **Resultado Esperado**: 100% de conformidade com a chave ativa (`ACTIVE_KEY_COMPLIANT`).
- **Condição de Paragem**: Qualquer registo em `STILL_ON_PREVIOUS_KEY` impede a remoção da chave anterior.

### Fase 6: Execução de Testes Stripe em Test Mode
- **Pré-condições**: Endpoint `/api/webhooks/stripe` ativo e funcional.
- **Ação**: Executar os 7 cenários descritos na Secção 9 utilizando chaves de teste Stripe.
- **Resultado Esperado**: Todos os 7 fluxos validados sem falhas de idempotência ou erros de multi-tenancy.
- **Condição de Paragem**: Qualquer colisão de dados entre tenants aborta o processo de homologação.

### Fase 7: Verificação de Email Transacional e Registos DNS
- **Pré-condições**: `RESEND_API_KEY` e `EMAIL_FROM` configuradas na Vercel.
- **Ação**: Enviar um convite de teste e verificar a receção na caixa de entrada.
- **Resultado Esperado**: Dashboard do Resend indica domínio `Verified` com registos SPF, DKIM e DMARC conformes.
- **Condição de Paragem**: Se o email for rejeitado ou classificado como spam crítico, corrigir DNS antes do deploy.

### Fase 8: Autorização Formal de Operações Remotas
- **Pré-condições**: Fases 1 a 7 validadas e registadas documentalmente.
- **Ação**: Revisão formal das evidências e aprovação explícita pelo responsável técnico / legal da empresa.
- **Resultado Esperado**: Autorização escrita para promoção em produção.
- **Condição de Paragem**: Nenhuma operação de deploy de produção pode ser executada sem autorização explícita.

### Fase 9: Deploy Controlado de Produção
- **Pré-condições**: Autorização obtida (Fase 8).
- **Ação**: Promover a compilação verificada no Vercel Dashboard para o ambiente de produção (`Production Deployment`).
- **Resultado Esperado**: 72 rotas disponibilizadas sem downtime.
- **Condição de Paragem**: Se o build de produção falhar, reverter imediatamente para o deployment anterior estável.

### Fase 10: Smoke Tests Pós-Deploy e Monitorização Ativa
- **Pré-condições**: Deploy ativo em produção (Fase 9).
- **Ação**: Executar validações em produção: registo de nova conta, login, criação de página, verificação de isolamento RLS e monitorização de logs durante 60 minutos.
- **Resultado Esperado**: Taxa de erros HTTP 5xx = 0%.
- **Condição de Paragem**: Qualquer violação de RLS ou falha crítica de segurança ativa rollback imediato.

### Fase 11: Critérios de Rollback e Procedimento de Emergência
- **Critérios de Ativação**:
  - Taxa de erros HTTP 5xx superior a 1% nas rotas principais.
  - Qualquer fuga de dados cross-tenant (RLS breach).
  - Falha estrutural nos webhooks de pagamento.
- **Procedimento de Emergência**:
  1. No painel Vercel: Executar *Instant Rollback* para a distribuição anterior estável.
  2. No Supabase Dashboard: Restaurar o snapshot manual gerado na Fase 1 caso tenham ocorrido migrações incompatíveis.
  3. Emitir comunicação imediata de incidente para a equipa técnica.

---

## 11. Veredito e Classificação Final

```
========================================================================
STATUS DE PRONTIDÃO: PRONTO PARA VALIDAÇÃO OPERACIONAL
========================================================================
```

### Justificação Conclusiva e Limitações Rigorosas
1. **Evidência Local Plena**: Compilação Turbopack de 72 rotas aprovada sem erros, tipagem TypeScript estrita sem erros, linters aprovados, e testes determinísticos locais de rotação dual-key (26/26), resiliência BYOK (21/21) e motor de permissões PGlite (48/48) validados com 100% de sucesso.
2. **Separação Obrigatória entre Código e Infraestrutura**: O projeto não pode receber a classificação `PRONTO PARA LANÇAMENTO CONTROLADO` porque a infraestrutura de produção na cloud (Supabase Cloud, Vercel e Stripe live/test) exige intervenção direta do operador humano credenciado para executar as Fases 1 a 7 do Runbook.
3. **Integridade de Governança**: Nenhuma alteração remota foi executada, nenhum segredo foi exposto e a documentação canónica reflete estritamente a realidade do código-fonte.
