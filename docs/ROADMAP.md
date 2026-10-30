# Product Roadmap: Company Brain (BusinessBrain)

> **Documento Canónico de Evolução e Estado de Entrega**  
> **Critério de Classificação**: Baseado estritamente em evidência inspecionada no código, suites de testes determinísticos executadas e estado de validação operacional em ambientes reais (staging/produção).

---

## Legenda de Classificação de Estado

Para garantir rigor técnico e evitar a confusão entre código desenvolvido, testes locais e funcionamento em produção, cada funcionalidade é avaliada segundo as seguintes categorias:

- 🟢 **Implementado e verificado no código**: O código existe, foi inspecionado nos módulos `app/` e `lib/` e cumpre a arquitetura estabelecida.
- 🧪 **Testes automatizados aprovados**: Coberto por suites determinísticas executadas com sucesso (`npm test` ou scripts dedicados).
- 🚀 **Validado operacionalmente**: Confirmado em ambiente real (staging ou produção) com tráfego real ou chamadas externas verificadas.
- 🟡 **Parcialmente implementado**: Existem módulos e lógica funcional, mas faltam integrações, persistência ou fluxos completos.
- ⚪ **Pendente**: Não iniciado; documentado apenas ao nível de especificação de produto.
- ⚠️ **Não confirmado**: Existem menções em relatórios históricos ou documentação anterior, mas sem evidência verificável no estado atual do repositório ou infraestrutura remota.

---

## Phase 0: Foundation (Fundação Multi-Tenant)
*Estado Global: Concluído e Verificado no Código*

- [x] **Arquitetura Multi-Tenant Next.js App Router**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/`, `lib/supabase/`, `lib/organizations/`) | 🧪 Testes automatizados aprovados (`npm test`, `npm run typecheck`, `npm run lint`).
  - Isolamento estrito por organização via middleware, cookies seguros (`cb_active_org_id`) e cabeçalho `x-organization-id`.
- [x] **Schema Relacional Supabase PostgreSQL**
  - *Classificação*: 🟢 Implementado e verificado no código (`database/migrations/00001` a `00028`) | 🧪 Testes automatizados aprovados (PGlite em `scripts/test-runner.ts`).
  - Tabelas base: `profiles`, `organizations`, `organization_members`.
- [x] **Políticas de Isolamento Row Level Security (RLS)**
  - *Classificação*: 🟢 Implementado e verificado no código | 🧪 Testes automatizados aprovados (`scripts/test-permissions-system.ts`).
  - Prevenção rigorosa de vazamento entre tenants com funções `SECURITY DEFINER`.
- [x] **Gestão de Sessão Baseada em Cookies**
  - *Classificação*: 🟢 Implementado e verificado no código (`@supabase/ssr` em `lib/supabase/server.ts` e `lib/supabase/middleware.ts`).
- [x] **Shell da Aplicação e Navegação**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/dashboard/layout.tsx`, sidebar, alternador de workspace).

---

## Phase 0.5: Authentication, Pricing & Trial Gating
*Estado Global: Implementado em Código com Validação Operacional Stripe Pendente*

- [x] **Autenticação Multi-Provedor (Supabase Auth)**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/(auth)/login`, `app/(auth)/signup`, `app/(auth)/auth/forgot-password`).
  - Suporte a Email/Password e GitHub OAuth. Google OAuth mantido diferido para fase posterior.
- [x] **Modelo de Consentimento Conforme RGPD**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/(auth)/signup/page.tsx`, `database/migrations/00001_initial_schema.sql`).
  - Termos de Serviço e Privacidade obrigatórios separados de consentimento de marketing opcional e desmarcado por defeito.
- [x] **Arquitetura de Planos e Período de Avaliação (Trial)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/stripe/config.ts`, `SUBSCRIPTION_PLANS`).
  - Planos Starter ($29/mês), Pro ($79/mês) e Enterprise ($299/mês). Trial de 7 dias sem custos iniciais.
- [x] **Guarda Central de Entitlement (`verifyAccessOrRedirect`)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/organizations/entitlements.ts`).
  - Desacoplamento estrito entre estar autenticado e ter direito de acesso: utilizadores sem plano ativo ou trial válido são redirecionados para `/pricing`.
- [ ] **Stripe Checkout & Sincronização de Webhooks Ponta-a-Ponta**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/stripe/actions.ts`, `app/api/webhooks/stripe/route.ts`) | 🧪 Testes locais de API com `price_data` aprovados | ⚠️ Validação operacional pendente.
  - *Bloqueio / Critério de Aceitação*: Necessária prova de execução em staging de um checkout real com ativação do webhook `checkout.session.completed` e transição do registo na tabela `public.subscriptions`.
- [x] **Portal de Definições de Faturação**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/dashboard/settings/billing/page.tsx`).
  - Apresentação do plano atual, contagem regressiva de dias de trial e data de renovação.

---

## Phase 1: Company Workspace & Operational Engine
*Estado Global: Parcialmente Implementado (Módulos Críticos no Código; Tarefas/Projetos Pendentes)*

- [x] **Sistema de Convites Seguros e Governação (SEC-01)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/invitations/actions.ts`, `lib/invitations/utils.ts`, `database/migrations/00024_secure_invitations_and_hashing.sql`) | 🧪 Testes automatizados aprovados (40/40 asserções em `scripts/test-invitations-security.ts`).
  - Hashing SHA-256 de tokens, assinaturas HMAC-SHA-256 no gateway, expiração em 7 dias, aceitação atómica e descarte de equipas extraterritoriais.
- [ ] **Envio Real de Emails Transacionais (Resend)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/email/resend.ts`, `lib/email/template-transactional.ts`) | ⚠️ Validação operacional pendente.
  - *Bloqueio / Critério de Aceitação*: Depende de chave de API real (`RESEND_API_KEY`) e domínio remetente verificado em ambiente de staging.
- [x] **Motor de Permissões RBAC (Estilo Discord)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/permissions/resolver.ts`, `lib/permissions/registry.ts`) | 🧪 Testes automatizados aprovados (46 testes em `scripts/test-permissions-system.ts`).
  - Precedência rigorosa: Owner (autoridade raiz) -> Explicit DENY -> Explicit ALLOW -> Permissões de Equipa -> Default Deny.
- [x] **Onboarding e Workspace Provisioning**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/onboarding/page.tsx`, `lib/onboarding/actions.ts`, `database/migrations/00031` a `00034`).
  - Criação guiada de workspace, provisionamento passo-a-passo e deteção automática de convites pendentes por email.
- [x] **Sessão do Stripe Customer Billing Portal**
  - *Classificação*: 🟢 Implementado e verificado no código (`createCustomerPortalSessionAction` em `lib/stripe/actions.ts`).
  - Permite aos administradores/owners gerir métodos de pagamento diretamente na Stripe.
- [ ] **Registo de Auditoria Operacional (Audit Logging)**
  - *Classificação*: 🟡 Parcialmente implementado (`lib/security/logger.ts` e limitação de taxa registam eventos estruturados; falta tabela dedicada `audit_logs` para todas as ações do workspace).
- [ ] **Gestão de Projetos (Kanban / Listas / Metas)**
  - *Classificação*: ⚪ Pendente (especificado em `docs/PRODUCT.md`).
- [ ] **Acompanhamento de Tarefas e Atribuição de Responsáveis**
  - *Classificação*: ⚪ Pendente (especificado em `docs/PRODUCT.md`).
- [ ] **Registo Formal de Decisões Estratégicas (ADRs)**
  - *Classificação*: ⚪ Pendente (especificado em `docs/PRODUCT.md`).
- [ ] **Gestão e Notas de Reuniões com Atribuição de Ações**
  - *Classificação*: ⚪ Pendente (especificado em `docs/PRODUCT.md`).

---

## Phase 2: Knowledge, Memory & Connections Graph
*Estado Global: Implementado em Código com Testes Determinísticos Aprovados*

- [x] **Editor de Blocos com Controlo Otimista de Concorrência (OCC Monotónico)**
  - *Classificação*: 🟢 Implementado e verificado no código (`components/dashboard/pages/block-editor.tsx`, `lib/pages/actions.ts`, `lib/pages/queries.ts`) | 🧪 Testes automatizados aprovados (8 suites completas em `scripts/test-runner.ts`: `test-revision-occ.ts`, `test-concurrency-occ.ts`, `test-dedup-surgical.ts`, etc.).
  - Proteção contra substituição acidental de texto através do token monotónico `revision_id`, snapshots transacionais e preservação de rascunhos locais em caso de conflito (`STALE_WRITE`).
- [x] **Grafo Interativo de Ligações Empresariais (Company Graph Engine)**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/dashboard/connections/page.tsx`, `components/dashboard/connections/interactive-graph-canvas.tsx`, `lib/connections/graph-algorithms.ts`) | 🧪 Testes automatizados aprovados (3 suites em `scripts/test-runner.ts`, incluindo benchmark $O(V + E)$ em 2.000 nós em < 50ms).
  - Algoritmo determinístico de BFS à prova de ciclos, cálculo de caminhos mínimos e visualização interativa em canvas HTML5.
- [x] **Hardening de Segurança do Supabase Storage (Migration 00030)**
  - *Classificação*: 🟢 Implementado e verificado no código (`database/migrations/00030_storage_granular_permissions_hardening.sql`, `lib/storage/validation.ts`) | 🧪 Testes automatizados aprovados (17 asserções em `scripts/test-storage-security.ts`).
  - Isolamento estrito de buckets por organização com validação de prefixo UUID RFC 4122, lista branca de tipos MIME (sem SVG executável) e teto de 25 MB por anexo.
- [x] **Pesquisa Multilíngue de Páginas e Documentos**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/pages/queries.ts`) | 🧪 Testes automatizados aprovados (`scripts/test-search-comprehensive.ts`).
  - Sanitização de carateres de controlo sintático PostgREST e suporte a transliteração multilíngue (PT/ES/FR/DE).
- [ ] **Extrator Automático de Factos e Memória Institucional**
  - *Classificação*: ⚪ Pendente (planeado em conjunto com a camada de IA).

---

## Phase 3: Financial Analytics & AI Company Brain

### Vertente A: Analytics Financeiros e Reconciliação Stripe (SaaS Metrics)
*Estado: Implementado no Código; Validação Operacional Pendente*

- [x] **Cálculo Determinístico de Métricas SaaS (MRR, Churn, ARR, Cohorts)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/integrations/stripe/analytics.ts`) | 🧪 Testes automatizados aprovados (13 suites em `scripts/test-stripe-connect-analytics.ts`).
  - Normalização monetária, isolamento cambial, janela de dunning de 14 dias e deteção de anomalias.
- [x] **Motor de Reconciliação Bidirecional Stripe vs. Base de Dados Local**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/stripe/reconciliation.ts`).
  - Diagnóstico em modo de leitura estrita que deteta discrepâncias de estado (`trialing`, `active`, `canceled`), desvios de plano e subscrições órfãs sem mutações destrutivas.
- [ ] **Ingestão Operacional de Webhooks Stripe Connect em Tempo Real**
  - *Classificação*: ⚠️ Validação operacional pendente em staging/produção.

### Vertente B: Camada de Inteligência Artificial (AI Company Brain)
*Estado: Pendente (Restrição Estrita de Âmbito Mantida)*

- [ ] **Geração de Embeddings Vetoriais (Modelos de Embeddings Gemini)**
  - *Classificação*: ⚪ Pendente.
- [ ] **Pesquisa Híbrida (Busca Vetorial pgvector + Palavras-Chave tsvector)**
  - *Classificação*: ⚪ Pendente.
- [ ] **Assistente Conversacional com Citações e Atribuição Verificável**
  - *Classificação*: ⚪ Pendente. Apenas interfaces estruturais preparatórias existem (`lib/ai/gemini.ts`). Chamadas de API reais continuam estritamente interditas nesta fase.
- [ ] **Transcrição Automática de Reuniões e Deteção de Ações**
  - *Classificação*: ⚪ Pendente.
- [ ] **Deteção de Contradições e Inconsistências Decisórias**
  - *Classificação*: ⚪ Pendente.
- [ ] **Medição de Quotas e Créditos de IA por Organização**
  - *Classificação*: ⚪ Pendente.

---

## Phase 4: Integrações & Ecossistema
*Estado Global: Implementado no Código; 51 Testes Determinísticos Aprovados; Validação Operacional Pendente*

- [x] **Integração com GitHub**
  - *Classificação*: 🟢 Implementado e verificado no código (`app/api/integrations/github/`, `lib/integrations/github/sync.ts`, `app/api/webhooks/github/route.ts`).
  - Sincronização contínua de PRs/Issues para `external_discussions`, verificação de assinaturas HMAC-SHA256 em tempo constante, matching estrito de repositório/conta contra contaminação multi-tenant e auditoria de jobs em `integration_sync_logs`.
- [x] **Integração com Google Workspace (Drive, Calendar, Meet)**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/integrations/google/drive.ts`, `lib/integrations/google/meet.ts`, `lib/integrations/google/sync.ts`).
  - Descoberta e extração de ficheiros Google Docs/Drive com hashing SHA-256 para `imported_documents`; captura de eventos Google Meet com links de conferência e participantes para `external_discussions`.
- [x] **Integração com Slack**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/integrations/slack/`, `app/api/integrations/slack/`, `app/api/webhooks/slack/route.ts`).
  - OAuth v2 com parâmetros de estado anti-CSRF, ingestão contínua de canais e mensagens para `external_discussions`, verificação criptográfica de assinaturas `v0` com proteção anti-replay (< 300s) e isolamento multi-tenant por `team_id`.
- [x] **Importadores One-Click de Confluence e Notion**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/integrations/importers/confluence.ts`, `lib/integrations/importers/notion.ts`, `lib/integrations/importers/actions.ts`).
  - Transpilação de formato de armazenamento Confluence (XHTML) e blocos Notion para Markdown padrão, preservação de hierarquia de páginas ancestrais, deduplicação determinística baseada em hash SHA-256 e persistência em `imported_documents`.
- [x] **API Pública com Scopes de Chaves de API para Clientes Enterprise**
  - *Classificação*: 🟢 Implementado e verificado no código (`lib/api-keys/`, `app/api/v1/`, `database/migrations/00036_phase_4_integrations_and_api.sql`).
  - Emissão de chaves prefixadas `cb_live_` com hashing criptográfico irreversível (SHA-256), guarda de scopes (`read:projects`, `write:documents`, `read:metrics`, etc.), RPC `validate_api_key` endurecida contra vazamento de metadados em chaves revogadas/expiradas, rate-limiting com cabeçalhos HTTP e especificação OpenAPI 3.1 (`/api/v1/openapi.json`).

---

## Phase 5: Chief of Staff Autónomo & Automações
*Estado Global: Pendente*

- [ ] **Resumos Executivos Semanais e Síntese de Velocidade de Projetos** (⚪ Pendente).
- [ ] **Deteção Preditiva de Bloqueios e Riscos de Cronograma** (⚪ Pendente).
- [ ] **Atribuição Autónoma e Acompanhamento Proativo de Tarefas** (⚪ Pendente).
- [ ] **Curriculum de Onboarding de Novos Colaboradores Ajustado por Papel** (⚪ Pendente).

---

## Phase 6: Clientes Mobile & Desktop
*Estado Global: Pendente*

- [ ] **Aplicações Nativas iOS e Android (React Native / Expo)** (⚪ Pendente).
- [ ] **Leitura e Consulta Offline de Documentos e Decisões** (⚪ Pendente).
- [ ] **Companheiro Desktop macOS e Windows com Acesso Global por Atalho (Estilo Raycast/Spotlight)** (⚪ Pendente).
- [ ] **Widget de Gravação Rápida de Notas de Voz e Reuniões** (⚪ Pendente).

---

## Matriz de Validação e Rastreabilidade Técnica

| Domínio Funcional | Implementação em Código | Testes Determinísticos | Validação Operacional Staging/Prod | Ficheiros de Referência no Repositório |
| :--- | :--- | :--- | :--- | :--- |
| **Isolamento Multi-Tenant & RLS** | ✅ 100% | ✅ 46 testes PGlite | ⚠️ Não confirmada em nuvem | `lib/supabase/`, `database/migrations/` |
| **Autenticação & Consentimento** | ✅ 100% | ✅ Typecheck & Lint | ⚠️ Não confirmada em nuvem | `app/(auth)/`, `lib/auth/` |
| **Trial Gating & Entitlements** | ✅ 100% | ✅ Testes de rotas | ⚠️ Pendente validação live | `lib/organizations/entitlements.ts` |
| **Convites Seguros (SEC-01)** | ✅ 100% | ✅ 40/40 testes aprovados | ⚠️ Pendente chave Resend | `lib/invitations/`, `scripts/test-invitations-security.ts` |
| **Permissões RBAC** | ✅ 100% | ✅ 46 testes aprovados | ⚠️ Não confirmada em nuvem | `lib/permissions/resolver.ts` |
| **Editor de Páginas & OCC** | ✅ 100% | ✅ 8 suites (100% pass) | ⚠️ Pendente teste com carga de utilizadores | `components/dashboard/pages/block-editor.tsx`, `lib/pages/` |
| **Company Graph Engine** | ✅ 100% | ✅ 3 suites (< 50ms) | ⚠️ Pendente teste em browser móvel | `lib/connections/`, `components/dashboard/connections/` |
| **Storage Security & RLS** | ✅ 100% | ✅ 17 testes aprovados | ⚠️ Pendente bucket real Supabase | `database/migrations/00030*`, `lib/storage/` |
| **Analytics Stripe & MRR** | ✅ 100% | ✅ 13 suites aprovadas | ⚠️ Pendente eventos reais Stripe | `lib/integrations/stripe/analytics.ts` |
| **Stripe Checkout Session** | ✅ 100% | ✅ Teste de API local | ⚠️ Pendente validação de fluxo live | `lib/stripe/actions.ts` |
| **Integração GitHub & Sync** | ✅ 100% | ✅ Aprovado (51 testes) | ⚠️ Pendente webhook live | `lib/integrations/github/`, `app/api/webhooks/github/` |
| **Google Workspace & Meet** | ✅ 100% | ✅ Aprovado (51 testes) | ⚠️ Pendente credenciais live | `lib/integrations/google/` |
| **Integração Slack & Eventos** | ✅ 100% | ✅ Aprovado (51 testes) | ⚠️ Pendente app Slack live | `lib/integrations/slack/`, `app/api/webhooks/slack/` |
| **Importadores Confluence/Notion** | ✅ 100% | ✅ Aprovado (51 testes) | ⚠️ Pendente export de clientes | `lib/integrations/importers/` |
| **Dashboards Personalizáveis (CAS)** | ✅ 100% | ✅ 145 testes workspace + 34 testes PG 16 | 🟡 VALIDADO COM LIMITAÇÕES (RPC Staging ativa; escrita remota pendente de credenciais de teste) | `lib/widgets/`, `database/migrations/00037_dashboard_layout_cas.sql` |
| **API Pública Enterprise** | ✅ 100% | ✅ Aprovado (51 testes) | ⚠️ Pendente rota de produção | `lib/api-keys/`, `app/api/v1/` |
| **IA, RAG & Gemini** | ❌ Apenas contratos | N/A | N/A (Estritamente interdito) | `lib/ai/gemini.ts` |
