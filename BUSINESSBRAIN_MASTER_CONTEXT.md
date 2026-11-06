# BusinessBrain — Master Technical Context & Architecture Specification

> **Documento de Continuidade e Referência Técnica Global**  
> **Versão de Referência**: 1.0-RC (Preparação para Lançamento em 2 Semanas)  
> **Data de Emissão**: Novembro de 2026  
> **Documentos Canónicos Relacionados**:  
> - Contexto Canónico: [`docs/AI_CONTEXT.md`](./docs/AI_CONTEXT.md)  
> - Runbook de Lançamento: [`docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md`](./docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md)  
> - Roadmap de Fases: [`docs/ROADMAP.md`](./docs/ROADMAP.md)  
> - Regras de Agentes & Token Policy: [`AGENTS.md`](./AGENTS.md)  
> - Resumo Rápido para Novos Chats: [`BUSINESSBRAIN_QUICK_HANDOFF.md`](./BUSINESSBRAIN_QUICK_HANDOFF.md)

---

## 1. Visão Geral & Meta de Lançamento 1.0

O **BusinessBrain** (também denominado *Company Brain*) é o espaço de trabalho executivo e camada de memória e inteligência para empresas modernas. Reúne num ambiente unificado e multi-tenant:
- Memória institucional e registo de decisões técnicas/estratégicas (ADRs).
- Páginas e documentação viva com controlo otimista de concorrência monotónico (OCC).
- Grafo de ligações e dependências empresariais ($O(V + E)$ em canvas HTML5).
- Métricas financeiras e reconciliação SaaS em tempo real (MRR, ARR, Churn, Stripe).
- Motor de Inteligência Artificial multi-modelo com grounded context, preservação estrita de privacidade e orçamentação atómica.

**Meta de Lançamento da Versão 1.0 (Próximas 2 Semanas)**:
1. **AI Providers Prioritários para 1.0**: OpenAI, Google Gemini, Anthropic Claude e DeepSeek. (Mistral e xAI Grok mantêm-se adicionais).
2. **Integrações Críticas para 1.0**: Email (Gmail) e Calendário (Google Calendar & Microsoft Calendar) como fontes de contexto sem persistência não autorizada na BD.
3. **Arquitetura Dual Workspace Estabilizada**: Personal Workspace (100% privado) + Company Workspace (governança de equipa) operando em harmonia com RLS infalível.

---

## 2. Stack Tecnológica & Dependências

- **Framework**: [Next.js](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/package.json) 16.3.8 (App Router, Turbopack, Server Actions, Server Components).
- **Linguagem & Tipagem**: TypeScript 5 (Strict Mode, 0 `any` não autorizados).
- **Frontend & UI**: React 19, Tailwind CSS v4, Lucide React, Framer Motion (apenas micro-animações intencionais; respeita `prefers-reduced-motion`).
- **Base de Dados & Auth**: Supabase PostgreSQL 15+, Supabase Auth (`@supabase/ssr`), Supabase Storage.
- **Faturação & Subscrições**: Stripe API & Stripe Webhooks (cryptographically verified).
- **Validação de Schemas**: Zod.
- **Criptografia**: Node.js `crypto` nativo — AES-256-GCM para chaves de API com HMAC-SHA256 para fingerprints.
- **Motor de Teste Local**: PGlite (`@electric-sql/pglite`) para testes em memória 100% determinísticos do PostgreSQL e RLS.

---

## 3. Estrutura do Projeto & Mapeamento de Diretórios

```
BusinessBrain/
├── app/                                 # Next.js App Router
│   ├── (auth)/                          # Autenticação (login, signup, callback, reset)
│   ├── api/                             # Rotas de API e Webhooks
│   │   ├── ai/chat/route.ts             # Endpoint SSE de streaming com reserva de créditos
│   │   ├── integrations/                # Endpoints OAuth e webhooks (GitHub, Slack, Google)
│   │   └── webhooks/stripe/             # Webhooks criptografados da Stripe
│   ├── dashboard/                       # Shell do Dashboard corporativo
│   │   ├── brain/chat/                  # Interface do Chat com AI e Memória
│   │   ├── connections/                 # Grafo de nós e arestas empresariais
│   │   ├── pages/                       # Editor de blocos com OCC
│   │   ├── settings/billing/            # Gestão de faturação e planos
│   │   └── settings/keys/               # Gestão de chaves BYOK pessoais e da organização
│   └── onboarding/                      # Fluxo guiado de criação de workspace
├── components/                          # Componentes React
│   ├── dashboard/                       # Shell, sidebar, org-switcher, layout split
│   │   ├── chat/                        # ChatView, ModelSelector, ContextSourcesModal, AccountLimitsModal
│   │   └── pages/                       # BlockEditor, DocumentHistory
│   └── ui/                              # Primitivas Tailwind acessíveis
├── database/migrations/                 # 47 migrações SQL (00000 a 00043) e agregadores
├── docs/                                # Documentação canónica do projeto
├── lib/                                 # Serviços de domínio e utilitários de backend
│   ├── ai/                              # Motor multi-modelo, catálogo, routing, accounting e adapters
│   │   ├── adapters/                    # OpenAI, Anthropic, Gemini, DeepSeek, Mistral
│   │   ├── auth/                        # Entitlement guard, permissões de IA e desafios
│   │   ├── accounting/                  # Reserva atómica de créditos e ledger de custos
│   │   ├── catalog/                     # Catálogo canónico de modelos e metadados
│   │   ├── chat/                        # AIChatService e persistência de mensagens
│   │   ├── context/                     # AIContextOrchestrator e fontes dinâmicas
│   │   └── routing/                     # ModelRoutingEngine multi-fator
│   ├── crypto/                          # Encriptação AES-256-GCM e HMAC de chaves de API
│   ├── email/                           # Integração transacional Resend
│   ├── i18n/                            # Dicionários quad-locale (en, pt, es, fr)
│   ├── integrations/                    # Clientes de integração (Google, GitHub, Slack, Importers)
│   ├── organizations/                   # Consultas de workspace, membership, entitlements e personal
│   ├── permissions/                     # Motor RBAC com resolução estrita
│   ├── stripe/                          # Configuração de planos, checkout, webhooks e reconciliação
│   └── supabase/                        # Clientes SSR autenticados e service-role autorizados
└── scripts/                             # Suites de teste determinísticas (test-runner.ts, etc.)
```

---

## 4. Base de Dados & Inventário de Migrações

Todas as migrações encontram-se **estritamente em [`database/migrations/`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/)**.  
*(As pastas `migrations/` e `supabase/migrations/` não existem no repositório)*.

### 4.1 Linha do Tempo e Migrações Recentes (00037 a 00043)
- `00037_dashboard_layout_cas.sql`: Algoritmo atómico Compare-And-Swap (CAS) com `FOR UPDATE` para personalização do dashboard sem race conditions.
- `00038_ai_foundation_and_byok.sql`: Criação das tabelas base de IA corporativa: `organization_ai_credentials`, `ai_conversations`, `ai_messages`, `ai_usage_ledger`.
- `00039_ai_access_control_and_governance.sql`: Tabela de auditoria de autorizações concedidas `public.ai_access_authorizations` e coluna `selected_source_ids` em `ai_conversations`.
- `00040_multimodel_and_personal_accounts.sql`: Suporte a `workspace_type` em `organizations`, tabela `public.user_ai_credentials` para BYOK pessoal e ledger multi-modelo com `scope` ('personal' | 'org').
- `00041_ai_credit_reservations.sql`: Tabela `public.ai_credit_reservations` e RPCs atómicas em PL/pgSQL: `reserve_ai_credits_atomic`, `settle_ai_credit_reservation_atomic`, `release_ai_credit_reservation_atomic`.
- `00042_entity_activity_history.sql`: Histórico de auditoria e atividade em entidades empresariais.
- `00043_personal_and_company_workspaces.sql`:
  - Adiciona `workspace_type` ('company' | 'personal') a `ai_conversations`.
  - Função idempotente `public.ensure_personal_workspace(p_user_id, p_user_name)` que garante subscrição individual starter e papel `owner`.
  - Endurecimento estrito de RLS em `ai_conversations` e `ai_messages` garantindo que conversas do espaço pessoal nunca vazem para administradores corporativos.

---

## 5. Arquitetura Dual Workspace: Personal vs Company

### 5.1 Princípio de Separação
O BusinessBrain estabelece dois ambientes de trabalho independentes no backend, base de dados e UI:

| Atributo | Personal Workspace | Company Workspace |
| :--- | :--- | :--- |
| **Pertença** | Pertence individualmente ao utilizador (`auth.uid()`). | Pertence à organização empresarial. |
| **Papel do Utilizador** | Exclusivamente `owner`. | `owner`, `admin` ou `member` (conforme convite). |
| **Conversas de AI** | 100% privadas; invisíveis a qualquer colega ou admin de empresa. | Acessíveis segundo permissões da equipa/organização. |
| **Credenciais BYOK** | Consulta estritamente `public.user_ai_credentials`. | Consulta estritamente `public.organization_ai_credentials`. |
| **Orçamento & Créditos** | Consumo no plano pessoal; ledger audita com `scope = 'personal'`. | Consumo no orçamento da empresa; ledger audita com `scope = 'org'`. |
| **Fontes Pessoais** | Notas individuais, conversas privadas, chaves próprias. | Páginas da empresa, métricas Stripe, discussões GitHub. |

### 5.2 Comunicação Cruzada Controlada (Cross-Workspace)
Quando um utilizador no seu Personal Workspace executa um prompt que requer dados da empresa (ex: *"Analisa o MRR da Acme Corp"*):
1. O backend verifica se o utilizador pertence à organização alvo e tem permissão (`billing.view`).
2. É emitido um **desafio de autorização explícito** (`AuthorizationChallenge`).
3. O utilizador aprova explicitamente a operação no cliente.
4. É gravado um registo auditável em `public.ai_access_authorizations` com `scope_type = 'cross_workspace'`.
5. **Regra Inviolável**: Dados pessoais nunca são partilhados automaticamente com o espaço corporativo.

---

## 6. Sistema de AI & Multi-Model Engine

### 6.1 Catálogo de Providers & Modelos (Foco 1.0)
Definido em [`lib/ai/catalog/models.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/catalog/models.ts):

1. **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`.
2. **Google Gemini**: `gemini-2.5-flash` (modelo de sistema padrão), `gemini-2.5-pro`.
3. **Anthropic Claude**: `claude-3-7-sonnet`, `claude-3-5-haiku`.
4. **DeepSeek**: `deepseek-chat` (V3), `deepseek-reasoner` (R1).
5. *(Secundários para pós-1.0)*: Mistral (`mistral-large-2411`, `codestral`), xAI Grok (`grok-2`).

### 6.2 Modos de Resolução no Motor de Roteamento ([`ModelRoutingEngine`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/routing/service.ts))
- **Modo Auto**: Seleciona o modelo ótimo baseado na complexidade da tarefa e orçamento.
- **Modo Preferred**: Respeita o modelo escolhido pelo utilizador na interface.
- **Modo Task-Based**: Mapeia tarefas especializadas (ex: análise financeira, raciocínio complexo, geração de código) para os modelos mais fortes na categoria.

### 6.3 Ciclo de Vida da Requisição de IA ([`app/api/ai/chat/route.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/api/ai/chat/route.ts))
1. **Autenticação**: Validação de sessão via `@supabase/ssr`.
2. **Workspace Ativo**: Resolução via cookie `cb_active_org_id` ou header `X-Organization-Id`.
3. **Rate Limiting**: `rateLimit("ai-chat", user.id)` para evitar abusos.
4. **Permissões**: Validação de `ai.chat` no servidor.
5. **Entitlement Guard ([`verifyAIAccessEntitlement`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/auth/entitlement-guard.ts))**:
   - **Invariante Comercial**: Planos gratuitos não executam IA sob nenhuma circunstância.
   - Fornecer BYOK pessoal ou da empresa **NÃO** dispensa a necessidade de uma subscrição Starter, Pro ou Enterprise ativa (ou trial válido).
6. **Resolução de Credenciais**:
   - `workspace_type === 'personal'` $\rightarrow$ busca exclusiva em `user_ai_credentials`.
   - `workspace_type !== 'personal'` $\rightarrow$ busca exclusiva em `organization_ai_credentials`.
7. **Reserva Atómica de Créditos**: `AICreditReservationService.reserveCredits` reserva créditos em 2 fases (bloqueio pessimista `FOR UPDATE` para evitar ultrapassagem simultânea de quotas).
8. **Proteção Anti-IDOR**: Se for fornecido `conversationId`, [`AIChatService.getConversation`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/chat/service.ts) valida a propriedade estrita no tenant ativo antes de qualquer operação.
9. **Streaming SSE**: Emissão contínua via Server-Sent Events com suporte a interrupção pelo cliente (`AbortSignal`).
10. **Liquidação e Ledger**: Ao concluir ou abortar, liquida a reserva real e regista a transação em `public.ai_usage_ledger` com o `scope` adequado.

---

## 7. Integrações para a Versão 1.0 (Email & Calendário)

- **Gmail / Email** ([`lib/integrations/google/gmail.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/integrations/google/gmail.ts)):
  - Conexão OAuth segura sem expor tokens ao frontend.
  - Leitura de mensagens filtradas sob demanda.
  - **Invariante**: Emails consultados pela IA atuam como fontes dinâmicas em memória e **NÃO** são gravados nas tabelas relacionais da BD.
- **Google Calendar & Microsoft Calendar** ([`lib/integrations/google/calendar.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/integrations/google/calendar.ts), [`lib/integrations/microsoft/calendar.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/integrations/microsoft/calendar.ts)):
  - Listagem de agendas e compromissos futuros.
  - Injeção contextual pontual no `AIContextOrchestrator` quando autorizado pelo utilizador.

---

## 8. Segurança, Multi-Tenancy & Conformidade

1. **Database-Level Isolation**: Supabase RLS é a linha primária de defesa. Políticas nunca utilizam `USING (true)` em tabelas de tenant.
2. **Criptografia de Credenciais**:
   - Segredos de API cifrados com AES-256-GCM (`iv:tag:ciphertext`).
   - Deduplicação via fingerprint HMAC-SHA256 para evitar inserção da mesma chave repetidamente.
   - Master Key gerida estritamente através da variável de ambiente `ENCRYPTION_MASTER_KEY` (nunca prefixada com `NEXT_PUBLIC_`).
3. **Defesa em Profundidade contra Prompt Injection**: O `AIContextOrchestrator` encapsula todo o conteúdo externo em blocos delimitados e higienizados (`[UNTRUSTED_CONTENT_BOUNDARY]`), instruindo o modelo a nunca executar instruções presentes nos dados recuperados.

---

## 9. Matriz de Estado Técnico & Evidência Verificada

Para total rigor, distinguem-se os seguintes níveis de prontidão:

| Módulo / Funcionalidade | Estado | Nível de Evidência | Ficheiros de Referência |
| :--- | :---: | :--- | :--- |
| **Personal Workspace Auto-Provisioning** | 🟢 | **Testado em PGlite & Código** (22/22 pass) | `database/migrations/00043*`, `lib/organizations/personal.ts` |
| **Isolamento de Conversas e Histórico** | 🟢 | **Testado em PGlite & Código** (RLS verificado) | `lib/ai/chat/service.ts`, `app/api/ai/chat/route.ts` |
| **Isolamento de BYOK Pessoal vs Empresa** | 🟢 | **Testado em PGlite & Código** | `00040*`, `app/api/ai/chat/route.ts` |
| **Reserva Atómica de Créditos de IA** | 🟢 | **Testado em PGlite & Código** | `00041*`, `lib/ai/accounting/reservation.ts` |
| **Motor de Permissões RBAC (Discord-style)**| 🟢 | **Testado em PGlite & Código** (48/48 pass) | `lib/permissions/resolver.ts` |
| **OCC no Editor de Documentos** | 🟢 | **Testado em PGlite & Código** (8 suites pass) | `lib/pages/actions.ts`, `components/dashboard/pages/` |
| **Grafo de Ligações Empresariais** | 🟢 | **Testado localmente** (< 50ms em 2k nós) | `lib/connections/graph-algorithms.ts` |
| **UI Chat: Limites, Modelos & Quick Pick** | 🟢 | **Implementado e Tipado** (Typecheck/Lint 0) | `components/dashboard/chat/` |
| **Stripe Checkout & Billing Portal** | 🟡 | **Implementado no Código; Pendente Live** | `lib/stripe/actions.ts`, `app/api/webhooks/stripe/` |
| **Envio de Emails Transacionais (Resend)**| 🟡 | **Implementado no Código; Pendente Live** | `lib/email/resend.ts` |
| **Sincronização Live GitHub/Google/Slack** | 🟡 | **Implementado no Código; Pendente Live** | `lib/integrations/` |

---

## 10. Reconciliação com Documentos Canónicos

Ao comparar os documentos existentes com o código atual:
1. **`ROADMAP.md`**: Marcava como pendente o assistente conversacional e a medição de quotas de IA. **Fato no código**: O assistente multi-modelo, as reservas atómicas e a orçamentação por quotas já estão implementados e testados.
2. **`CHECKLIST_OPERACIONAL_LANCAMENTO.md`**: Catalogava migrações até à `00041`. **Fato no código**: Foram adicionadas a `00042` (histórico de atividades) e a `00043` (dual workspaces e isolamento de conversas).
3. **`AI_CONTEXT.md`**: Mencionava proibição estrita de chamadas reais de IA. **Fato no código**: Os adapters e o streaming SSE estão preparados localmente; as chamadas de produção aguardam a validação operacional com as chaves reais.
