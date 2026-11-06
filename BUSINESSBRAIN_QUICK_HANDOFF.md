# BusinessBrain — Quick Handoff (Transição Rápida)

> **Guia Executivo de Entrada Imediata para Novos Chats de Desenvolvimento**  
> **Lê este documento primeiro antes de iniciar qualquer tarefa.**  
> **Referência Completa**: [`BUSINESSBRAIN_MASTER_CONTEXT.md`](./BUSINESSBRAIN_MASTER_CONTEXT.md)  
> **Documentos Canónicos**: [`docs/AI_CONTEXT.md`](./docs/AI_CONTEXT.md) | [`docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md`](./docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md) | [`docs/ROADMAP.md`](./docs/ROADMAP.md) | [`AGENTS.md`](./AGENTS.md)

---

## 1. O que é o BusinessBrain

O **BusinessBrain** (Company Brain) é a plataforma de memória e inteligência para equipas executivas e operacionais. Combina documentação colaborativa com controlo monotónico de concorrência (OCC), grafo empresarial de dependências, métricas financeiras SaaS (MRR/ARR/Stripe) e um assistente de IA multi-modelo isolado por workspace com grounded context e orçamentação atómica.

---

## 2. Meta de Lançamento da Versão 1.0 (2 Semanas)

O lançamento da versão de produção 1.0 está agendado para as próximas duas semanas. O foco está estritamente delimitado a:

1. **AI Providers Prioritários**:
   - **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`)
   - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`)
   - **Anthropic Claude** (`claude-3-7-sonnet`, `claude-3-5-haiku`)
   - **DeepSeek** (`deepseek-chat` V3, `deepseek-reasoner` R1)
   *(Mistral e Grok são secundários e não devem bloquear o lançamento)*.
2. **Integrações Chave para 1.0**:
   - **Email** (Gmail sob demanda como fonte dinâmica sem gravação na BD)
   - **Calendário** (Google Calendar e Microsoft Calendar como contexto temporal)
3. **Estabilidade Operacional**:
   - Validação dos fluxos de pagamento Stripe e aplicação do lote de migrações em produção.

---

## 3. Decisões Arquiteturais Invioláveis (Não Contrariar)

1. **Arquitetura Dual Workspace Obrigatória**:
   - **Personal Workspace** (`workspace_type = 'personal'`): 100% privado, pertence ao utilizador, usa chaves de `user_ai_credentials` e contabiliza no ledger com `scope = 'personal'`.
   - **Company Workspace** (`workspace_type = 'team'`): governado por papéis/permissões, usa chaves de `organization_ai_credentials` e debita no ledger com `scope = 'org'`.
   - Administradores da empresa **nunca** têm acesso a conversas ou notas do espaço pessoal.
2. **Invariante Comercial de Entitlement de IA**:
   - Contas gratuitas sem subscrição ativa ou trial válido **não podem executar IA** (retorna HTTP 402).
   - O fornecimento de chaves BYOK **NÃO contorna** o requisito de subscrição (`verifyAIAccessEntitlement`).
3. **Isolamento de Base de Dados (RLS)**:
   - Todas as tabelas de tenant têm `organization_id NOT NULL`.
   - A linha de defesa primária é o PostgreSQL RLS (`is_org_member`), nunca apenas filtros no código da aplicação.
4. **Localização Exclusiva de Migrações**:
   - Todas as migrações estão **apenas** em `database/migrations/`.
   - Não inventar pastas `migrations/` ou `supabase/migrations/`.
5. **Comandos Canónicos do Projeto**:
   - Desenvolver: `npm run dev` ou `npm run dev:turbo`
   - Verificação de tipos: `npm run typecheck`
   - Linter: `npm run lint`
   - Build: `npm run build`
   - Testes: `npm test` ou `npx tsx scripts/<nome-do-teste>.ts`

---

## 4. Estado Atual do Repositório

- **Tipagem & Linters**: `npm run typecheck` e `npm run lint` com **0 erros**.
- **Migrações Implementadas**: 47 migrações numeradas (de `00000` a `00043`) e scripts utilitários em `database/migrations/`.
- **Última Migração Adicionada**: `00043_personal_and_company_workspaces.sql` (auto-provisionamento do Personal Workspace e isolamento RLS de conversas).
- **Testes Determinísticos Recentes**:
  - `scripts/test-workspace-dual-architecture.ts` (22/22 asserções aprovadas).
  - `scripts/test-encryption-key-rotation.ts` (26/26 asserções aprovadas).
  - `scripts/test-byok-crypto-resilience.ts` (21/21 asserções aprovadas).
  - `scripts/test-permissions-system.ts` (48/48 asserções aprovadas).

---

## 5. Próxima Tarefa Recomendada

👉 **Consolidação e Validação dos Fluxos de Staging / Pré-Produção**:
1. Preparar o lote das migrações `00037` a `00043` num script de validação de schema para o Supabase de produção (conforme detalhado na secção 4 e 5 da [`docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md`](./docs/CHECKLIST_OPERACIONAL_LANCAMENTO.md)).
2. Realizar a verificação do webhook da Stripe em ambiente de teste para validação ponta-a-ponta de concessão de planos.
3. Testar a injeção em tempo real de mensagens de Gmail e reuniões de Google Calendar no chat do assistente.

---

## 6. Mapa de Ficheiros Críticos para o Próximo Chat

- **IA / Chat & Streaming**: [`app/api/ai/chat/route.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/api/ai/chat/route.ts)
- **Serviço de Conversação & IDOR Guard**: [`lib/ai/chat/service.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/chat/service.ts)
- **Orquestrador de Contexto & Fontes**: [`lib/ai/context/orchestrator.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/context/orchestrator.ts)
- **Entitlements & Gating**: [`lib/ai/auth/entitlement-guard.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/ai/auth/entitlement-guard.ts)
- **Personal Workspace Service**: [`lib/organizations/personal.ts`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/organizations/personal.ts)
- **Alternador de Workspaces**: [`components/dashboard/org-switcher.tsx`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/components/dashboard/org-switcher.tsx)
- **Interface do Chat**: [`components/dashboard/chat/chat-view.tsx`](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/components/dashboard/chat/chat-view.tsx)
