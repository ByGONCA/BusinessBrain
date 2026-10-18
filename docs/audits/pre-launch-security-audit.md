# BusinessBrain — Auditoria de Segurança Pré-Lançamento (20 Controlos) e Preparação para Staging

**Data da Auditoria**: 2026-10-18  
**Repositório**: BusinessBrain  
**Branch**: `main` (commit base `1ebec46`)  
**Responsável**: Antigravity (Advanced Agentic Coding)

---

## 1. Avaliação dos 20 Controlos de Segurança

| Nº | Controlo | Estado | Evidência / Ficheiros / Linhas |
| :--- | :--- | :--- | :--- |
| **1** | **API keys e segredos** | `PASS` | Nenhuma chave privada é exposta no cliente. As únicas variáveis com prefixo `NEXT_PUBLIC_` são `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_APP_URL` ([`lib/supabase/client.ts:9-10`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/supabase/client.ts#L9-L10)). `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` são restritas ao servidor ([`lib/stripe/client.ts:8-12`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/stripe/client.ts#L8-L12)). |
| **2** | **Segredos no Git** | `PASS` | Histórico Git inspecionado (`git log --all --name-only --oneline -- "**.env*"`). Apenas `.env.example` foi versionado, contendo exclusivamente valores fictícios e placeholders ([`.env.example:1-60`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/.env.example#L1-L60)). O ficheiro [`.gitignore:28`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/.gitignore#L28) exclui `.env*`. |
| **3** | **Chaves públicas do Supabase** | `PASS` | O cliente browser utiliza apenas a chave publicável anónima ([`lib/supabase/client.ts:18`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/supabase/client.ts#L18)). `SUPABASE_SERVICE_ROLE_KEY` é estritamente isolada em `createServiceClient()` no servidor ([`lib/supabase/server.ts:97-110`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/supabase/server.ts#L97-L110)). |
| **4** | **Row-Level Security (RLS)** | `PASS` | RLS ativado e forçado em todas as tabelas de negócio (`FORCE ROW LEVEL SECURITY`). Políticas validam `is_org_member(target_org_id)` e `has_permission(target_org_id, key)` ([`00023_permissions_hardening_and_rls.sql`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql), [`00025_supabase_security_advisor_hardening.sql`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/database/migrations/00025_supabase_security_advisor_hardening.sql)). |
| **5** | **Proteção de dados sensíveis** | `PASS` | Tokens de integração OAuth (GitHub, Google, Microsoft) são encriptados com AES-256-GCM via [`lib/crypto/encryption.ts:18-42`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/crypto/encryption.ts#L18-L42). As passwords são delegadas ao Supabase Auth. HMAC-SHA-256 protege a comunicação entre aplicação e RPCs internos. |
| **6** | **Autenticação e autorização no servidor** | `PASS` | Server Actions exigem `requireActiveOrganization()` e validam permissões canónicas com `hasPermission(user.id, org.id, key)` ([`lib/pages/actions.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/pages/actions.ts), [`lib/files/actions.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/files/actions.ts)). Rotas `/dashboard/*` protegidas por middleware ([`middleware.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/middleware.ts)). |
| **7** | **IDOR/BOLA e isolamento de tenant** | `PASS` | `activeOrg.id` é sempre resolvido no servidor e validado contra `organization_members` ([`lib/organizations/queries.ts:79-88`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/organizations/queries.ts#L79-L88)). Todas as operações de leitura, mutação e deleção filtram por `eq("organization_id", activeOrg.id)`. |
| **8** | **Manipulação de campos** | `PASS` | Schemas Zod sanitizam payloads de formulários. Identificadores de sistema (`organization_id`, `created_by`, `role`, `status`) são atribuídos exclusivamente pelo servidor. Proteção contra demotoção/remoção do último proprietário da organização ([`lib/organizations/actions.ts:250-320`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/organizations/actions.ts#L250-L320)). |
| **9** | **Cookies, sessões e CSRF** | `PASS` | Cookie de workspace `cb_active_org_id` configurado com `httpOnly: true`, `secure: isProd`, `sameSite: "lax"` ([`lib/organizations/actions.ts:153-159`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/organizations/actions.ts#L153-L159)). Sessões Supabase geridas por cookies seguros via `@supabase/ssr`. Server Actions possuem proteção nativa CSRF de origem. |
| **10** | **Passwords** | `PASS` | Passwords geridas pelo Supabase Auth. Mínimo de 6 caracteres verificado por schema Zod ([`lib/auth/actions.ts:11-14`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/auth/actions.ts#L11-L14)). Fluxo de recuperação com rate limiting e expiração segura. |
| **11** | **Rate limiting na autenticação** | `PASS` | Rate limiting com dupla camada (em memória + tabela HMAC segura): `signInAction` por `clientIp:email` (5 req / 5 min), `signUpAction` por `clientIp` (3 req / 10 min), `requestPasswordResetAction` por `clientIp:email` ([`lib/auth/actions.ts:50-54, 90-94, 200-204`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/auth/actions.ts#L50-L54)). |
| **12** | **Bots e abuso automatizado** | `PARTIAL` | Rate limiting agressivo em mutações e autenticação mitiga ataques volumétricos. Não existe atualmente serviço de CAPTCHA integrado (ex: Cloudflare Turnstile); recomendado avaliar pós-lançamento se houver abuso em registos. |
| **13** | **SQL injection e consultas** | `PASS` | Consultas PostgREST usam parâmetros indexados (`$1, $2`). RPCs PL/pgSQL são parametrizados com tipos estritos. Interpolações `.or()` em `lib/pages/actions.ts:892` e `lib/pages/queries.ts:198` sanitizam caracteres de injeção de filtro (`replace(/[,()\"\\\[\]{}]/g, "")`). `sanitize_tsquery_input` elimina operadores maliciosos de texto. |
| **14** | **Validação de inputs** | `PASS` | Validação Zod estrita em Server Actions e Route Handlers. UUIDs verificados com `isValidUuid` antes de passar à base de dados. `planId` validado contra lista permitida `["starter", "pro", "enterprise"]`. |
| **15** | **XSS e conteúdo do utilizador** | `PASS` | `dangerouslySetInnerHTML` é utilizado apenas para o script estático de tema em [`app/layout.tsx:53`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/app/layout.tsx#L53). Visualizador de e-mails em iframe com sandbox estrita (`sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"`, sem `allow-scripts`) e sanitização em [`email-view.tsx:470-520`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/components/dashboard/email/email-view.tsx#L470-L520). Ficheiros SVG excluídos de upload. |
| **16** | **Uploads e Storage** | `PASS` | Lista restrita de tipos MIME permitidos ([`lib/storage/validation.ts:6-23`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/storage/validation.ts#L6-L23)). Sanitização de nomes de ficheiro contra directory traversal. Limite de tamanho de 25MB. Políticas RLS em `storage.objects` validam que a pasta inicial pertence à organização do utilizador ([`00009_storage_rls_hardening.sql:22-40`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/database/migrations/00009_storage_rls_hardening.sql#L22-L40)). |
| **17** | **Respostas API** | `PASS` | Route handlers devolvem JSON estruturado. Erros de base de dados e RPC são mascarados ao cliente com mensagens genéricas ("Failed to save page", "Internal error") e registados no logger interno do servidor ([`lib/security/logger.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/security/logger.ts)). |
| **18** | **Security headers** | `PASS` | CSP restritiva em [`next.config.ts:15-58`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/next.config.ts#L15-L58) (`frame-ancestors 'none'`, `object-src 'none'`, `unsafe-eval` apenas em dev). `Strict-Transport-Security: max-age=63072000; includeSubDomains`. `X-Frame-Options: DENY`. `X-Content-Type-Options: nosniff`. `Referrer-Policy: strict-origin-when-cross-origin`. `Permissions-Policy`. |
| **19** | **HTTPS e callbacks** | `PASS` | Verificação de URLs de retorno via [`sanitizeRedirectUrl`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/security/redirects.ts) contra open redirects. OAuth callbacks validados contra `NEXT_PUBLIC_APP_URL` configurado. Tabela `oauth_nonce_ledger` com consumo único de nonces para proteção contra replay. |
| **20** | **Dependências e cadeia de fornecimento** | `PARTIAL` | `npm audit` reporta 10 vulnerabilidades de desenvolvimento/build em pacotes transitivos (`braces`, `postcss-selector-parser` em `tailwindcss` v3 / `postcss-nested`). Não são exploráveis em runtime de servidor. Atualização bloqueada pela migração de breaking change para Tailwind 4. |

---

## 2. Auditoria Específica do Stripe e Integrações

1. **Assinatura e Idempotência de Webhooks**:
   - `stripe.webhooks.constructEvent` valida a assinatura criptográfica com `STRIPE_WEBHOOK_SECRET` antes de ler o payload ([`app/api/webhooks/stripe/route.ts:27`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/app/api/webhooks/stripe/route.ts#L27)).
   - Registo idempotente em `record_stripe_webhook_event` RPC e tabela `stripe_webhook_events`. Eventos repetidos devolvem `{ received: true, duplicate: true }` sem reprocessamento.
2. **Separação de Preços e Autorização Server-Side**:
   - O cliente fornece apenas o identificador lógico do plano (`starter`, `pro`, `enterprise`).
   - O preço Stripe é resolvido no servidor via variáveis de ambiente ([`lib/stripe/config.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/stripe/config.ts)).
   - Verificação de autorização de billing (`billing.manage` ou role `owner`/`admin`) antes de abrir sessões de checkout ou portal ([`lib/stripe/actions.ts:49-58`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/lib/stripe/actions.ts#L49-L58)).
3. **Prevenção de Clientes Duplicados**:
   - Verificação prévia da tabela local `subscriptions` e pesquisa na API da Stripe por `metadata['organization_id']` antes de criar novo cliente Stripe.

---

## 3. Preparação para Homologação em Staging

### 3.1. Lista de Migrações e Sequência de Aplicação
Sequência ordenada:
- `00001_initial_schema.sql` até `00028_rate_limit_schema_alignment.sql` (base de dados estrutural existente).
- `00029_company_memory_and_multilingual_search.sql` (Fase 2: OCC `revision_id`, RPCs `save_page_content`, `restore_page_version`, pesquisa multilíngue `global_workspace_search`).

### 3.2. Procedimento de Aplicação da Migração 00029
1. Executar snapshot / backup da base de dados antes da migração (`pg_dump`).
2. Executar a consulta de validação prévia de duplicados:
   ```sql
   SELECT page_id, version_number, count(*)
   FROM public.page_versions
   GROUP BY page_id, version_number
   HAVING count(*) > 1;
   ```
3. Se a consulta retornar 0 linhas, aplicar `00029_company_memory_and_multilingual_search.sql`.
4. Em caso de erro `P0003` (`MIGRATION ABORTED`), a transação é abortada sem alterações.

### 3.3. Checklist de Validações em Staging
- [ ] Testar login por Email/Password e GitHub OAuth.
- [ ] Testar isolamento entre Org A e Org B: garantir que utilizador em Org A recebe 404/403 ao aceder a recurso de Org B.
- [ ] Testar edição concorrente em 2 separadores: abrir a mesma página em dois separadores, salvar no separador 1 e verificar se o separador 2 aciona o modal de conflito (`STALE_WRITE`) sem sobrescrever.
- [ ] Testar webhook de checkout Stripe em modo de teste: verificar criação correta da subscrição em `public.subscriptions` com status `trialing`.
- [ ] Testar upload de anexo e verificar que SVG é rejeitado e ficheiros permitidos são associados à organização.
