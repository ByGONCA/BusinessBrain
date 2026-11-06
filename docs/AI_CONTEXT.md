# BusinessBrain — Contexto Canónico para Agentes de IA

> **Objetivo**: Fornecer contexto factual, compacto e verificável para agentes de programação em sessões futuras. Este ficheiro resume arquitetura, convenções, comandos, limites e os protocolos de inteligência de código (Graphify) e simplicidade de implementação (Ponytail).

---

## 1. Identidade e Propósito do Projeto

- **Nome**: BusinessBrain (Company Brain)
- **Missão**: Memória e camada de inteligência operacional para empresas modernas — repositório multi-tenant de reuniões, decisões, conhecimento, timeline empresarial, tarefas e integrações (Google, Microsoft, GitHub, Slack, Stripe).
- **Modelo de Licenciamento & Negócio**: SaaS B2B com subscrições Stripe (`starter`, `pro`, `enterprise`), trials automáticos e limites estritos por plano.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19, Server Components por defeito)
- **Linguagem**: TypeScript (Strict mode)
- **Estilos & UI**: Tailwind CSS (design tokens semânticos, sem pills/bubbles decorativos), Lucide React
- **Base de Dados & Auth**: Supabase PostgreSQL 15+, Supabase Auth via `@supabase/ssr`, Supabase Storage
- **Pagamentos & Faturação**: Stripe (Checkout Sessions, Customer Portal, Webhooks criptográficos)
- **Validação de Schemas**: Zod
- **Internacionalização**: Sistema centralizado quad-locale (`en` predefinido, `pt`, `es`, `fr` em `lib/i18n/`)
- **Inteligência de Código & Otimização**:
  - **Graphify**: Grafo de conhecimento de AST e dependências (`graphify-out/graph.json`)
  - **Ponytail**: Filosofia de implementação minimalista (ladder: YAGNI -> reuse -> stdlib -> platform -> minimal diff)

---

## 3. Arquitetura de Alto Nível & Estrutura de Diretórios

```
BusinessBrain/
├── app/                  # Next.js App Router (páginas públicas, autenticação, dashboard, rotas de API)
│   ├── (auth)/           # Fluxos de login, signup, convites, reset de password
│   ├── api/              # Endpoints HTTP (webhooks, integrações, rotas de IA/chat)
│   └── dashboard/        # Ecrãs autenticados (brain, timeline, people, settings, github)
├── components/           # Componentes React
│   ├── dashboard/        # Layouts de dashboard, timeline, chat, org switcher, settings
│   └── ui/               # Primitivas de interface reutilizáveis
├── database/             # Migrações SQL e scripts de schema PostgreSQL
│   └── migrations/       # Migrações numeradas e canónicas (00001_... a 00043_...)
├── docs/                 # Documentação canónica do projeto
├── graphify-out/         # Grafo de conhecimento Graphify (graph.json, graph.html, GRAPH_REPORT.md)
├── lib/                  # Módulos de domínio, serviços e clientes
│   ├── ai/               # Orquestrador de contexto, adaptadores de modelos e credenciais
│   ├── i18n/             # Dicionários quad-locale e tipos de tradução
│   ├── integrations/     # Conectores para Google, Microsoft, GitHub, Slack, Stripe
│   ├── organizations/    # Gestão de workspaces, memberships e entitlements
│   ├── permissions/      # RBAC granular e matriz de permissões
│   ├── security/         # Rate limiting, logger de auditoria e guards de autorização
│   ├── stripe/           # Integração com Stripe e processamento de webhooks
│   ├── supabase/         # Clientes de servidor/browser (`server.ts`, `client.ts`)
│   └── timeline/         # Linha temporal empresarial, queries e filtros
└── scripts/              # Suites de testes canónicas e verificadores de ambiente
```

---

## 4. Arquitetura de Base de Dados, RLS & APIs

1. **Multi-Tenancy e Isolamento Rigoroso**:
   - Todas as tabelas de negócio possuem `organization_id uuid not null references organizations(id) on delete cascade`.
   - Isolamento garantido ao nível do banco via PostgreSQL Row-Level Security (RLS) — nunca confiar apenas em filtros aplicacionais (`where org_id = ...`).
   - Sessões do utilizador usam sempre o cliente autenticado scoped (`lib/supabase/server.ts`).
   - `createServiceClient()` é reservado estritamente para webhooks verificados e jobs em background; nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao browser.
2. **Desacoplamento entre Auth e Entitlement**:
   - Um utilizador autenticado não tem acesso automático ao dashboard se a organização não tiver assinatura válida (`trialing` ou `active`), verificado via `lib/organizations/entitlements.ts`.
3. **Webhooks e Faturação**:
   - Webhooks do Stripe são verificados via `stripe.webhooks.constructEvent` com `STRIPE_WEBHOOK_SECRET`.
   - Preços (`Price IDs`) nunca são fornecidos pelo browser; o frontend envia apenas nomes de plano internos (`starter`, `pro`).

---

## 5. Ferramentas de Inteligência & Otimização: Graphify + Ponytail

### Graphify (Compreensão Eficiente da Arquitetura)
- O grafo do projeto está gerado em `graphify-out/graph.json` (4.100+ nós indexados).
- **Antes de ler ficheiros em bruto**, consulta o grafo:
  - CLI: `graphify query "<pergunta ou conceito>"`
  - Caminhos de dependência: `graphify path "<MóduloA>" "<MóduloB>"`
  - Detalhe de nó: `graphify explain "<Símbolo>"`
  - MCP: `query_graph`, `shortest_path`, `get_node`, `get_neighbors`
- **Sincronização**: Após editar ficheiros de código na sessão, executa `graphify update .` (AST-only, sem custo de LLM) para manter o grafo atualizado.

### Ponytail (Minimalismo e Simplicidade de Implementação)
- Aplica a escada Ponytail a qualquer implementação ou refactor:
  1. **YAGNI**: O requisito precisa mesmo de existir? Se for especulativo, omite.
  2. **Reutilização**: Procura utilitários, tipos ou componentes existentes em `lib/` e `components/` antes de criar novos.
  3. **Stdlib**: Usa TypeScript/JavaScript/Node stdlib nativo.
  4. **Plataforma**: Prefere HTML5/CSS e restrições de base de dados a código aplicacional.
  5. **Dependências Existentes**: Consulta `package.json`; não instales novas dependências sem necessidade absoluta.
  6. **Menor Diff Seguro**: Prefere a menor alteração que resolve a causa-raiz (não os sintomas), acompanhada de teste direcionado.

### Fronteiras Não Negociáveis
A otimização de tokens e a simplicidade **NUNCA** justificam:
- Remover ou enfraquecer validação de inputs (Zod) ou autenticação/autorização (RLS).
- Expor segredos ou variáveis de ambiente de servidor ao cliente.
- Omitir tratamento de erros em operações financeiras ou mutações de base de dados.
- Quebrar internacionalização (textos fora dos dicionários i18n) ou acessibilidade.

---

## 6. Hierarquia de Prioridades Canónica

Em todas as decisões, segue rigorosamente esta ordem:
1. **Correção e Segurança** (RLS, isolamento multi-tenant, sanitização, segredos).
2. **Requisitos do Utilizador**.
3. **Arquitetura Existente do Projeto**.
4. **Simplicidade e Manutenibilidade (Ponytail)**.
5. **Compreensão Eficiente da Base de Código (Graphify)**.
6. **Eficiência de Tokens e Execução**.
7. **Comunicação Concisa**.

---

## 7. Comandos Canónicos de Desenvolvimento & Testes

- **Desenvolvimento**: `npm run dev:turbo` (ou `npm run dev`)
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Suíte de Testes Geral (25 suites)**: `npm test` (`npx tsx scripts/test-runner.ts`)
- **Testes Proporcionais e Direcionados**:
  - Permissões / RBAC: `npx tsx scripts/test-permissions-system.ts`
  - Workspace / Páginas: `npx tsx scripts/test-pages-workspace.ts`
  - Timeline: `npx tsx scripts/test-company-timeline.ts`
  - Guardrails de Email/Calendário: `npx tsx scripts/test-phase2-email-calendar-guardrails.ts`
  - Workspace Pessoal e Empresarial: `npx tsx scripts/test-workspace-dual-architecture.ts`
- **Atualização do Grafo de Conhecimento**: `graphify update .`

---

## 8. Limitações Conhecidas & Restrições Operacionais

- **Chamadas de LLM em Produção**: Não efetuar chamadas reais a APIs de LLM sem autorização explícita de fase.
- **Operações Remotas Não Autorizadas**: Não executar deploys (Vercel), migrações em produção no Supabase Cloud ou cobranças de teste em dashboards remotos sem ordem explícita.
- **Evidência Real vs. Suposições**: Distinguir sempre código confirmado localmente de validação operacional real. Nunca declarar que um teste passou se não tiver sido executado.
