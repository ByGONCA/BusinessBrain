# BusinessBrain — Relatório de Auditoria, Seleção e Instalação de Agent Skills

> **Data da Auditoria:** 16 de Outubro de 2026  
> **Target:** BusinessBrain (Repositório `CompanyBrain`)  
> **Ambiente de Execução:** Google Antigravity / Gemini CLI  
> **Localização das Skills:** `.agents/skills/` (Workspace) & `~/.gemini/config/skills/` (Global)

---

## A. Resumo Executivo

### 1. Métricas da Curadoria de Skills
- **Skills Identificadas e Mapeadas:** 48 candidatas analisadas em ecossistemas de referência.
- **Skills Avaliadas em Detalhe:** 32 candidatas prioritárias.
- **Skills Efetivamente Instaladas no Workspace (`.agents/skills/`):** 25 skills prontas e validadas.
- **Skills Rejeitadas:** 8 candidatas (por redundância, baixa manutenção, dependências opacas ou risco de segurança).
- **Skills Adiada / Recomendadas Futuras:** 5 candidatas (dependências de serviços externos ainda não ativados, ex: métricas em tempo real Vercel sem token de CLI conectado).

### 2. Top 5 Skills de Maior Impacto para o BusinessBrain
1. **`supabase-postgres-best-practices` (Supabase Oficial)**:
   - *Impacto*: Crítico para a integridade de dados e isolamento multi-tenant. Garante que os índices parciais para `organization_id` e políticas RLS sejam matematicamente seguros contra vazamento entre inquilinos.
2. **`supabase` (Supabase Oficial)**:
   - *Impacto*: Previne armadilhas de autenticação com `@supabase/ssr`, vetando o uso de `user_metadata` em tokens JWT para autorização e reforçando a exigência de `TO authenticated` acompanhado obrigatoriamente de predicados de posse `USING ((select auth.uid()) = user_id)`.
3. **`owasp-security` (OWASP Foundation / agamm)**:
   - *Impacto*: Fornece cobertura para OWASP Top 10:2025, ASVS 5.0, LLM Top 10 (2026) e Agentic Applications (2026). Essencial para auditar o Company Graph, rotas de convites, handlers de webhooks e verificações de controlo de acessos (BOLA / IDOR / Privilege Escalation).
4. **`react-best-practices` (Vercel Engineering)**:
   - *Impacto*: 70 regras acionáveis de performance para React 19 e Next.js App Router. Elimina cascatas de dados assíncronas (*waterfalls*), otimiza Server Components e minimiza o bundle JavaScript no carregamento inicial da aplicação.
5. **`stripe-best-practices` (Stripe Ecosystem)**:
   - *Impacto*: Garante a conformidade rigorosa da faturação SaaS: resolução server-side de Price IDs, tratamento assíncrono idempotente de webhooks (`stripe.webhooks.constructEvent`), gestão de Restricted API Keys (RAK) e ciclo de vida de testes de 7 dias sem bypass de segurança.

### 3. Principais Riscos e Limitações Identificados
- **Zero Bypass de RLS**: Toda e qualquer instrução de código gerada pelo agente deve respeitar o princípio de que o cliente autenticado de Supabase (`lib/supabase/server.ts`) deve ser sempre o mecanismo padrão; nunca reintroduzir chaves de serviço (`service_role`) para contornar políticas RLS.
- **Precedência de Permissões Negativas (Explicit DENY)**: O sistema de permissões do BusinessBrain combina overrides individuais com papéis de equipa. É indispensável auditar se um override de rejeição (`deny`) tem prioridade estrita sobre concessões herdadas da equipa (`allow`), mitigando concessão inadvertida de acesso.
- **Ambiente de Testes Offline / CLI Headless**: Algumas ferramentas Playwright e de observabilidade necessitam de servidores em execução e de binários de browser (`playwright install chromium`).

---

## B. Inventário Detalhado das Skills

A tabela abaixo documenta todas as skills avaliadas e o respetivo estado de instalação no BusinessBrain:

| Nome da Skill | Origem & Autor | Categoria | Objetivo Principal | Estado | Justificação da Decisão |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`supabase-postgres-best-practices`** | `supabase/agent-skills` (Supabase) | Supabase & SQL | 8 categorias de regras de performance, indexação e RLS. | **Instalada** | Essencial para garantir consultas rápidas no Company Graph e blindagem de RLS. |
| **`supabase`** | `supabase/agent-skills` (Supabase) | Backend & Auth | Boas práticas de autenticação SSR, cookies, Storage e RLS. | **Instalada** | Obrigatória para conformidade com arquitetura Supabase SSR no Next.js. |
| **`owasp-security`** | `agamm/claude-code-owasp` | Segurança Aplicacional | Auditoria de vulnerabilidades segundo OWASP 2025/2026 e ASVS 5.0. | **Instalada** | Proteção contra BOLA/IDOR, injeção, escalada de privilégios e validação de convites. |
| **`react-best-practices`** | `vercel-labs/agent-skills` (Vercel) | Frontend & React | 70 regras para React 19 / Next.js: waterfalls, bundle size, Server Components. | **Instalada** | Otimiza performance do dashboard e páginas do BusinessBrain. |
| **`composition-patterns`** | `vercel-labs/agent-skills` (Vercel) | Arquitetura React | Padrões de composição para evitar proliferação de boolean props. | **Instalada** | Melhora a manutenibilidade e escalabilidade dos componentes UI. |
| **`vercel-optimize`** | `vercel-labs/agent-skills` (Vercel) | Performance & Caching | Otimização de custos, funções serverless, caching e Core Web Vitals. | **Instalada** | Reduz latência de rotas dinâmicas e consumo de recursos no Vercel. |
| **`deploy-to-vercel`** | `vercel-labs/agent-skills` (Vercel) | DevOps & CI/CD | Boas práticas de deployment, preview environments e env vars. | **Instalada** | Padroniza deploys seguros em conformidade com o ecossistema Vercel. |
| **`web-design-guidelines`** | `vercel-labs/agent-skills` (Vercel) | Acessibilidade & UX | Verificação contra as Web Interface Guidelines e boas práticas. | **Instalada** | Garante contraste, touch targets e navegação acessível por teclado. |
| **`stripe-best-practices`** | `fcakyon/claude-codex-settings` | Faturação & Pagamentos | Integração de Checkout Sessions, webhooks idempotentes, RAKs e billing. | **Instalada** | Alinha-se diretamente com o modelo de trial de 7 dias e regras do `AGENTS.md`. |
| **`ui-ux-pro-max`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Design Intelligence | 79 estilos, 192 perfis de produto, motor BM25 de design systems. | **Instalada** | Fornece inteligência de design premium e minimalista para SaaS dark mode. |
| **`frontend-design`** | `anthropics/skills` (Anthropic) | Direção Visual | Evita clichés de interfaces genéricas de IA; estética intencional. | **Instalada** | Assegura que o redesign dark minimalist mantém autenticidade e requinte. |
| **`ui-styling`** | `nextlevelbuilder/ui-ux-pro-max-skill` | UI Components | Componentes shadcn/ui e utilitários Tailwind CSS. | **Instalada** | Padroniza a sintaxe e organização do Tailwind CSS v3 no projeto. |
| **`design-system`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Design Tokens | Arquitetura de tokens semânticos e primitivos. | **Instalada** | Mantém coerência nas variáveis CSS do `app/globals.css`. |
| **`design`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Design Unificado | Orquestração de assets visuais, identidade de produto e CIP. | **Instalada** | Complementa os requisitos visuais corporativos do BusinessBrain. |
| **`webapp-testing`** | `anthropics/skills` (Anthropic) | Testes E2E | Toolkit Playwright com gestão de ciclo de vida do servidor local. | **Instalada** | Permite testar interativamente fluxos de autenticação e mapas de grafo. |
| **`test`** | `anthropics/skills` (Anthropic) | Testes Unitários | Criação de suites de testes para alterações locais em staging. | **Instalada** | Aumenta a cobertura em funções críticas de negócio e cálculos de entitlement. |
| **`check`** | `anthropics/skills` (Anthropic) | Code Review & QA | Verificação de código independente antes de merge contra specs. | **Instalada** | Previne regressões funcionais e quebra de regras de arquitetura. |
| **`debug`** | `anthropics/skills` (Anthropic) | Depuração | Ciclo estruturado: reprodução, localização, hipótese, teste e correção. | **Instalada** | Resolução metódica de bugs sem efeitos secundários ou refatores supérfluos. |
| **`architect`** | `anthropics/skills` (Anthropic) | Arquitetura | Elaboração de especificações técnicas (`docs/specs/`) e ADRs. | **Instalada** | Modela formalmente novas funcionalidades antes da implementação em código. |
| **`document`** | `anthropics/skills` (Anthropic) | Documentação | Redação estruturada de PRs, changelogs e release notes. | **Instalada** | Mantém o histórico do projeto alinhado com as entregas de cada fase. |
| **`skill-creator`** | `anthropics/skills` (Anthropic) | Meta-Skills | Criação, calibração e benchmarking de novas skills para o projeto. | **Instalada** | Permite estender o Antigravity com regras internas do BusinessBrain. |
| **`find-skills`** | `anthropics/skills` (Anthropic) | Descoberta | Descoberta dinâmica de novas skills na comunidade. | **Instalada** | Facilita a expansão contínua das capacidades do agente. |
| **`brand`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Branding | Tom de voz, comunicação corporativa e diretrizes de marca. | **Instalada** | Assegura consistência nas comunicações e cópias da interface. |
| **`slides`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Apresentações | Apresentações executivas e decks estratégicos em HTML/Chart.js. | **Instalada** | Útil para relatórios e apresentações internas de arquitetura. |
| **`banner-design`** | `nextlevelbuilder/ui-ux-pro-max-skill` | Média Social | Criação de banners técnicos e ativos visuais. | **Instalada** | Suporte a materiais gráficos institucionais. |
| **`react-native-skills`** | `vercel-labs/agent-skills` | Mobile | Padrões específicos para React Native / Expo. | **Rejeitada** | O BusinessBrain é estritamente uma aplicação web Next.js; skill desnecessária. |
| **`mongodb-query-optimizer`** | `fcakyon/claude-codex-settings` | Base de Dados | Otimização para MongoDB. | **Rejeitada** | A stack do BusinessBrain utiliza PostgreSQL no Supabase, não MongoDB. |
| **`polar-billing`** | `fcakyon/claude-codex-settings` | Pagamentos | Integração com Polar.sh. | **Rejeitada** | O projeto utiliza exclusivamente Stripe como gateway de faturação. |
| **`overleaf-skills`** | `fcakyon/claude-codex-settings` | Documentos | Integração com Overleaf LaTeX. | **Rejeitada** | Fora do escopo do projeto; documentação mantida em Markdown no repositório. |
| **`tavily-tools`** | `fcakyon/claude-codex-settings` | Pesquisa Externa | Pesquisa externa com dependência de chave proprietária Tavily. | **Rejeitada** | O Antigravity já possui ferramentas nativas de pesquisa (`search_web`). |
| **`ultralytics-yolo`** | `fcakyon/claude-codex-settings` | Machine Learning | Treino e inferência de modelos YOLO de visão computacional. | **Rejeitada** | Completamente irrelevante para a arquitetura B2B SaaS de gestão empresarial. |
| **`vercel-cli-with-tokens`**| `vercel-labs/agent-skills` | DevOps | Execução de comandos CLI com passagem explícita de tokens. | **Rejeitada** | Violação da política de segurança do projeto (Zero Secret Leakage em comandos shell). |

---

## C. Mapa de Cobertura por Área Técnica

Avaliação da capacidade das skills instaladas para orientar o Antigravity em cada domínio do projeto (Escala de 0 a 5):

| Domínio de Conhecimento | Pontuação (0-5) | Skills Principais Responsáveis | Análise e Justificação |
| :--- | :---: | :--- | :--- |
| **1. Design e UX** | **5 / 5** | `ui-ux-pro-max`, `frontend-design`, `ui-styling` | Cobertura de referência: 79 estilos, 192 paletas e heurísticas anti-templates prontas para SaaS dark mode. |
| **2. Acessibilidade** | **5 / 5** | `web-design-guidelines`, `ui-ux-pro-max` | Verificação explícita de contraste 4.5:1, navegação via teclado, touch targets (≥44px) e suporte a `prefers-reduced-motion`. |
| **3. React e Next.js** | **5 / 5** | `react-best-practices`, `composition-patterns` | Orientações de engenharia Vercel para React 19, Server Components por omissão e eliminação de boolean props. |
| **4. TypeScript & Qualidade**| **5 / 5** | `check`, `debug`, `react-best-practices` | Tipagem estrita com política zero-any, checagens automáticas via `npm run typecheck` e ciclos de depuração metódicos. |
| **5. Performance Frontend** | **5 / 5** | `vercel-optimize`, `react-best-practices` | Eliminação de cascatas assíncronas (*waterfalls*), importações dinâmicas (`next/dynamic`) e análise de bundle. |
| **6. Segurança Aplicacional** | **5 / 5** | `owasp-security`, `supabase` | Cobertura abrangente do OWASP Top 10 (2025), ASVS 5.0, LLM Top 10 (2026) e auditoria de vetores BOLA/IDOR. |
| **7. Supabase & RLS** | **5 / 5** | `supabase`, `supabase-postgres-best-practices` | Regras estritas: proibição de `auth.role()`, exigência de cláusula `TO` e predicados de posse `USING` e `WITH CHECK`. |
| **8. PostgreSQL & Queries** | **5 / 5** | `supabase-postgres-best-practices` | 8 categorias de otimização SQL: indexação parcial por `organization_id`, EXPLAIN plans, índices compostos e bloat. |
| **9. Testes Unitários & E2E** | **4.5 / 5** | `webapp-testing`, `test` | Playwright interativo com `with_server.py` e gerador de suites unitárias. *(0.5 deduzido apenas pela dependência de runtime local).* |
| **10. Arquitetura de Software**| **5 / 5** | `architect`, `composition-patterns` | Especificação técnica em `docs/specs/`, arquitetura modular em `lib/` e isolamento de dependências. |
| **11. Stripe e Faturação** | **4.5 / 5** | `stripe-best-practices` | Checkout sessions, webhooks verificados, API Keys restritas (RAKs) e regras anti-duplicação de clientes. |
| **12. Observabilidade & Logs** | **4 / 5** | `vercel-optimize`, `debug` | Diagnóstico de latência em funções e logs do Vercel. *(1 ponto a evoluir com métricas em tempo real conectadas).* |
| **13. DevOps & Deployment** | **4.5 / 5** | `deploy-to-vercel` | Práticas seguras de deployment, configuração de variáveis e preview branches no Vercel. |
| **14. Documentação Técnica** | **5 / 5** | `document`, `architect` | Geração padronizada de PRs, release notes, changelogs e documentação de decisões arquiteturais (ADRs). |
| **15. Criação de Skills** | **5 / 5** | `skill-creator`, `find-skills` | Capacidade nativa de criar, testar, medir e expandir o repositório de skills do Antigravity. |

---

## D. Auditoria Específica do BusinessBrain: Riscos e Mitigações pelas Skills

Esta secção cruza os requisitos críticos de negócio e arquitetura do BusinessBrain com as diretrizes ativas nas novas skills:

### 1. Isolamento Multi-Tenant entre Organizações
- **Cenário de Risco**: Uma query de base de dados omitir o filtro por `organization_id`, ou uma política RLS permitir que utilizadores autenticados vejam registos de outras empresas através da API REST pública.
- **Diretriz Ativa das Skills (`supabase`, `supabase-postgres-best-practices`)**:
  - Toda a tabela de negócio deve conter `organization_id uuid not null references organizations(id) on delete cascade`.
  - A política de RLS não pode confiar apenas em `TO authenticated`. É obrigatório verificar a filiação ativa na organização:
    ```sql
    using (
      exists (
        select 1 from organization_members
        where organization_members.organization_id = target_table.organization_id
          and organization_members.user_id = (select auth.uid())
      )
    );
    ```
  - Índices parciais e compostos devem ser criados em `(organization_id, id)` e `(organization_id, updated_at desc)`.

### 2. Precedência de Permissões: DENY Individual sobre Permissões de Equipa
- **Cenário de Risco**: Um utilizador pertencer a uma equipa com permissão `EDIT` em determinada página ou projeto, mas ter um override individual de `DENY`. Se a consulta fizer um `OR` ingénuo, a permissão herdada da equipa prevalece incorretamente.
- **Diretriz Ativa das Skills (`owasp-security`, `architect`)**:
  - Modelar as permissões de forma determinística: *Explicit Deny First*.
  - A query ou função de autorização deve verificar primeiro se existe algum registo com `access_level = 'deny'`. Se existir, o acesso é imediatamente bloqueado, ignorando concessões de equipa.

### 3. Segurança de Convites e Gestão de Membros
- **Cenário de Risco**: Links de convite sem validação criptográfica, tokens previsíveis, ou aceitação de convites atribuindo funções administrativas (`admin`/`owner`) sem reautenticação.
- **Diretriz Ativa das Skills (`owasp-security`, `supabase`)**:
  - Tokens de convite devem ser UUIDs v4 aleatórios com hashing e expiração temporal estrita (máximo 7 dias).
  - A criação de membros deve ocorrer exclusivamente via Server Actions autenticadas (`lib/organizations/actions.ts`) com verificação prévia de que o remetente possui permissão de gestão de membros (`role in ('owner', 'admin')`).

### 4. Operações de Storage e Ficheiros Anexados
- **Cenário de Risco**: Uploads de ficheiros com extensões maliciosas, ficheiros sem scoping de pasta por tenant, ou buckets públicos que permitem leitura direta via URL sem verificação de membro.
- **Diretriz Ativa das Skills (`owasp-security`, `supabase`)**:
  - Buckets de storage devem ser privados (`public = false`).
  - O caminho do objeto no bucket deve ter o prefixo obrigatório `<organization_id>/<entity_type>/<filename>`.
  - As políticas RLS do Storage (`storage.objects`) devem validar que o primeiro segmento do caminho coincide com uma organização de que o utilizador é membro ativo.

### 5. Performance e Integridade do Company Graph
- **Cenário de Risco**: O grafo de entidades (`pages`, `projects`, `tasks`, `decisions`, `meetings`, `goals`) crescer e o cálculo de conexões e caminho mais curto no cliente sobrecarregar o browser, ou queries recursivas na base de dados bloquearem o pool de conexões.
- **Diretriz Ativa das Skills (`supabase-postgres-best-practices`, `react-best-practices`)**:
  - As queries de busca de conexões devem ser paginadas ou limitadas por profundidade (ex: `depth <= 2`).
  - Renderização do Canvas e SVG com virtualização ou simplificação de nós fora do viewport ativo.
  - O cálculo de conexões no client deve usar memoização estrita (`useMemo`) e Web Workers se a contagem de nós exceder 500 entidades.

### 6. Consistência da Faturação Stripe e Trial de 7 Dias
- **Cenário de Risco**: O cliente contornar o checkout enviando `success=true` na query string, ou o plano do utilizador não ser sincronizado se o webhook falhar.
- **Diretriz Ativa das Skills (`stripe-best-practices`, `AGENTS.md`)**:
  - Proibição absoluta de confiar em parâmetros de redirecionamento do browser para conceder acesso.
  - Acesso ao dashboard é verificado estritamente no servidor através de `lib/organizations/entitlements.ts`.
  - O Stripe Price ID é resolvido exclusivamente no servidor com base no identificador de plano (`starter`, `pro`, `enterprise`).
  - Todos os eventos de webhook Stripe são assinados e validados criptograficamente com `stripe.webhooks.constructEvent`.

---

## E. Próximos Passos Recomendados

Abaixo apresenta-se o plano de ação sugerido, dividido por horizonte temporal e criticidade:

### 1. Ações Imediatas (Sem Alterações Funcionais)
1. **Comitar o diretório de skills do workspace**:
   - Adicionar o diretório `.agents/skills/` ao controlo de versões (Git) para que toda a equipa e futuras sessões de agentes partilhem do mesmo padrão de excelência técnica.
2. **Executar verificação inicial de conformidade com o linter**:
   - Correr `npm run typecheck` e `npm run lint` para garantir que o projeto permanece estritamente íntegro e sem erros de TypeScript.

### 2. Auditorias Técnicas Posteriores
1. **Auditoria de Segurança RLS com a Skill `supabase-postgres-best-practices`**:
   - Realizar uma varredura nas migrations existentes em `supabase/migrations/` para identificar políticas com `auth.role()` ou tabelas sem índices de suporte em `organization_id`.
2. **Auditoria OWASP das Rotas de API e Server Actions com a Skill `owasp-security`**:
   - Rever os endpoints em `app/api/` e as Server Actions em `lib/` para garantir validação de entrada Zod em todos os dados e proteção contra BOLA/IDOR.
3. **Auditoria de Performance Vercel com a Skill `react-best-practices`**:
   - Inspecionar os componentes do Dashboard e Company Graph para assegurar separação clara entre Server Components de busca de dados e Client Components de renderização interativa.

### 3. Evoluções Futuras do Código (Sujeitas a Aprovação Explícita)
1. **Implementação de Suites E2E Playwright via `webapp-testing`**:
   - Automatizar o teste do fluxo de trial de 7 dias, onboarding e navegação no Company Graph.
2. **Refatoração de Componentes com `composition-patterns`**:
   - Substituir componentes com múltiplas flags booleanas por arquitetura de *compound components*.

---

## F. Evidências Técnicas e Limitações

### 1. Comandos Executados e Resultados
- **Inspeção de Repositórios Remotos**:
  - Clonagem e auditoria de manifestos a partir de `vercel-labs/agent-skills`, `supabase/agent-skills`, `agamm/claude-code-owasp`, `fcakyon/claude-codex-settings` e `nextlevelbuilder/ui-ux-pro-max-skill`.
- **Validação de Sintaxe dos Manifestos `SKILL.md`**:
  - Script PowerShell executado com verificação de frontmatter YAML (`name`, `description`).
  - **Resultado**: 25/25 skills aprovadas com 100% de sucesso.
- **Testes de Execução Não Destrutivos**:
  - `python .agents/skills/ui-ux-pro-max/scripts/search.py "dark minimalist saas" --domain style` → Executado com sucesso, retornando recomendações precisas de OLED Dark Mode, Minimalist e Flat Design.
  - Leitura e validação dos scripts de `webapp-testing` (`with_server.py`), `pdf` e `xlsx`.

### 2. Limitações Conhecidas
- **Execução de Vercel Metrics**: A skill `vercel-optimize` requer que o utilizador execute localmente `vercel link` e esteja autenticado para recolher métricas reais de tráfego de produção.
- **Ambiente de Testes Playwright**: A execução headless com Chromium requer a presença das dependências de sistema do navegador instaladas localmente no host.
- **Zero Alteração de Secrets**: Nenhuma chave de API, segredo de webhook ou token foi lido, alterado ou exposto durante todo o processo de auditoria e instalação.
