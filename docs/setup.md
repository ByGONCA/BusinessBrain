# BusinessBrain — Vibe Coding Toolkit Setup & Evidence

> **Data de Verificação:** 18 de Outubro de 2026  
> **Repositório Alvo:** BusinessBrain (`CompanyBrain`) — Commit base: `1ebec46`  
> **Toolkit de Referência:** `soumatheusgomes/vibe-coding-toolkit` (Branch `main`, Commit clone: Outubro 2026)  
> **Ambiente do Agente:** Google Antigravity / Gemini CLI  
> **Modo de Operação:** Preparação e Blindagem Pré-Fase 2 (Sem alterações de código funcional, sem migrações de DB, sem commits)

---

## 1. Contexto e Objetivos da Integração

A integração do **Vibe Coding Toolkit** no **BusinessBrain** tem como objetivo central:
1. **Otimização de Contexto (Context Economy):** Estruturar instruções enxutas no `AGENTS.md` e descarregar detalhes para documentação canónica modular em `docs/`, permitindo carregamento sob demanda (*lazy-loading*).
2. **Redução de Trabalho Repetitivo e Ruído:** Adoção de acordos operacionais explícitos (*Ponytail* para menor alteração completa e reutilização estrita; *Caveman* para respostas conversacionais concisas mantendo documentação e código profissionais).
3. **Qualidade e Verificabilidade:** Formalização de comandos canónicos de validação (`typecheck`, `lint`, testes direcionados) e protocolos estruturados de revisão de código e segurança diferencial.
4. **Governança de Subagentes:** Disciplina de seleção dinâmica de modelos para subagentes (`flash_lite` / `flash` para tarefas mecânicas e de busca; `pro` para decisões arquiteturais e segurança).
5. **Expansão Curada de Skills:** Instalação local em `.agents/skills/` de competências aplicáveis ao stack sem duplicações e sem introdução de dependências externas não autorizadas.

---

## 2. Matriz de Adoção Integral do Vibe Coding Toolkit

A tabela seguinte avalia todos os 22 componentes do catálogo oficial do Vibe Coding Toolkit (`docs/tools/README.md`) e respetivas extensões, documentando o benefício concreto, compatibilidade com o ambiente Antigravity, âmbito de instalação, impacto no contexto e risco/método de validação.

| Componente / Skill | Benefício Concreto | Compatibilidade Antigravity | Instalação / Âmbito | Impacto no Contexto / Dependências | Risco e Método de Validação | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01. Superpowers** (`01-superpowers.md`) | Fluxo proporcional (compreender → desenhar → planear → implementar → verificar → rever). | Total. Antigravity possui slash commands `/plan`, `/architect`, `/debug`, `/check`. | Local (`AGENTS.md` + skills). | Zero dependências npm. Carregamento de specs em `docs/specs/`. | Baixo. Validação estática de regras e planos antes de codificação. | **Integrado** |
| **02. Subagent Orchestration** (`02-subagent-orchestration.md`) | Delegação de tarefas independentes com contextos limpos e seleção de modelos leves. | Total. Nativo via `invoke_subagent`, `send_message`, `define_subagent` com tiers (`flash_lite`, `flash`, `pro`). | Local (`AGENTS.md`). | Zero dependências npm. Evita poluição do contexto do coordenador. | Baixo. Validação via tasks isoladas com ficheiros disjuntos. | **Integrado** |
| **03. RTK (Token Proxy)** (`03-rtk-token-proxy.md`) | Filtragem de output de terminal verboso para poupança de tokens. | Parcial. Antigravity já possui truncamento nativo e paginação (`PAGER=cat`). | Global (CLI Rust). Requer autorização explícita para binário global. | Não instalado para cumprir regra de zero instalação global não autorizada. | Médio. Risco de mascarar erros detalhados. Tratamento via scripts direcionados e `--quiet`. | **Bloqueado (Prereq Global)** |
| **04. Ponytail** (`04-ponytail.md`) | Menor alteração suficiente, reutilização do código existente, sem refatores especulativos. | Total. Acordo comportamental aplicado pelo agente. | Local (`AGENTS.md`). | Zero dependências. Reduz diffs e consumo de tokens em revisões. | Nulo. Validação por inspeção de diff (`git status`, `git diff`). | **Integrado** |
| **05. Caveman** (`05-caveman.md`) | Respostas conversacionais concisas sem verbosidade desnecessária; código/docs normais. | Total. Alinhado com a diretriz do sistema Antigravity ("Keep your responses concise"). | Local (`AGENTS.md`). | Reduz geração de tokens nas mensagens conversacionais. | Nulo. Avaliação qualitativa do output da conversa. | **Integrado** |
| **06. ESLint / Quality Gates** (`06-eslint-biome-quality-gates.md`) | Gates de qualidade, limite de 350 linhas, regras de lint tipadas para async. | Total. Next.js 16 + ESLint 9 já configurado. | Local (`docs/quality.md`, `eslint.config.mjs`). | Zero novas dependências. Código legado com ficheiros > 350 linhas mantido em warn/advisory. | Médio. Não introduzir erros de lint no código existente. Validação via `npm run lint`. | **Integrado (Advisory)** |
| **07. Graphify** (`07-graphify.md`) | Grafo estrutural de código e dependências em ficheiro queryable. | Total. Skill instalada em `.agents/skills/graphify/`. | Local (`.agents/skills/graphify/`). | Isolado com `.graphifyignore` e `.gitignore` (`.venv/`, `graphify-out/`). | Baixo. Arquitetura documentada e saída ignorada pelo git. | **Instalado & Blindado** |
| **08. Obsidian Memory** (`08-obsidian-memory.md`) | Cofre externo em Markdown para memória persistente entre projetos. | Parcial. BusinessBrain é repositório autónomo e auto-suficiente em Git. | Externo ao repositório. | Não aplicável ao repositório de produto. | Nulo. Documentação mantida em `docs/`. | **Não Aplicável** |
| **09. Claude Memory** (`09-claude-memory-system.md`) | Sistema de memória persistente específico para Claude Code (`MEMORIES.md`). | Incompatível diretamente. Antigravity usa `<RULE>`, artifacts em `brain/` e skills. | Específico de cliente. | Não aplicável diretamente ao Antigravity. Substituído por `docs/setup.md`. | Nulo. | **Não Aplicável (Substituído)** |
| **10. Client Hooks** (`10-hooks-best-practices.md`) | Hooks de ciclo de vida (`hook-io.mjs`) para Claude Code / Codex. | Incompatível. Antigravity não suporta scripts de hook locais em formato Claude/Codex. | Específico de cliente. | Zero impacto. | Nulo. | **Não Aplicável** |
| **11. agent-browser** (`11-agent-browser.md`) | CLI de automação de browser Chrome headless para validação runtime. | Requer CLI `agent-browser` global (não instalado). | Global (CLI). Antigravity possui `webapp-testing` (Playwright) nativo. | Reutilização do `webapp-testing` existente sem novas dependências. | Baixo. Validação via suites Playwright em `e2e/`. | **Reutilizado via Playwright** |
| **12. Context7** (`12-context7.md`) | MCP server para consulta de documentação oficial versionada de bibliotecas. | Compatível via MCP. Requer configuração pelo utilizador em `mcp/context7`. | Servidor MCP externo. | Não consome contexto se não invocado. | Baixo. Antigravity usa nativamente `search_web` e `read_url_content`. | **Pendente (Config MCP)** |
| **13. Anthropic Skills** (`13-anthropics-skills.md`) | Skills oficiais: `architect`, `check`, `debug`, `document`, `skill-creator`, `test`. | Total. Todas compatíveis e já indexadas no Antigravity. | Local (`.agents/skills/`). | Já presentes no workspace. Zero novas dependências. | Nulo. Validadas com sucesso no audit anterior. | **Reutilizado (Já Instalado)** |
| **14. Chrome DevTools MCP** (`14-chrome-devtools-mcp.md`) | Inspeção de consola, rede, performance e acessibilidade em tempo real. | Total. Plugins já ativos no Antigravity (`a11y-debugging`, `chrome-devtools`, etc.). | Global do agente. | Zero impacto no repositório. | Nulo. Ferramentas nativas do ambiente. | **Reutilizado (Já Ativo)** |
| **15. Codex Workflow** (`15-codex-workflow.md`) | Configuração `codex.config.toml` e instruções Codex. | Incompatível/Desnecessário. Antigravity utiliza `AGENTS.md` e `.agents/skills/`. | Específico de cliente. | Não adicionado para evitar duplicação e confusão. | Nulo. | **Não Aplicável** |
| **16. Vercel Skills** (`16-vercel-skills.md`) | `react-best-practices`, `composition-patterns`, `web-design-guidelines`, `vercel-optimize`, `deploy-to-vercel`, `find-skills`. | Total. 6 já instaladas; adicionadas agora `react-view-transitions` e `writing-guidelines`. | Local (`.agents/skills/`). | Zero dependências npm. Carregamento sob demanda via `SKILL.md`. | Nulo. Testadas e descobertas pelo Antigravity. | **Expandido & Ativo** |
| **17. Next.js Runtime & Bundle** (`17-nextjs-runtime-and-performance.md`) | `next-dev-loop` (inspeção de `/_next/mcp`) e `next-bundle-optimizer` (auditoria com `next analyze`). | Parcial. Stack possui Next 16.3+ Turbopack. `agent-browser` CLI não instalado. | Local (`.agents/skills/`). | Instaladas em `.agents/skills/`. Zero dependências runtime adicionadas. | Baixo. `next-dev-loop` sinaliza pré-requisito global se invocado. | **Instalado & Documentado** |
| **18. PostgreSQL Skills** (`18-postgresql-skills.md`) | `supabase-postgres-best-practices` e `supabase` da Supabase. | Total. Essencial para multi-tenancy, índices RLS e Supabase SSR. | Local (`.agents/skills/`). | Já presentes no workspace. Zero dependências. | Nulo. Garantia de isolamento multi-tenant. | **Reutilizado (Já Instalado)** |
| **19. GitHub CI Repair** (`19-github-ci-repair.md`) | `gh-fix-ci` para diagnosticar falhas de CI via GitHub CLI. | Requer `gh` CLI autenticado em sessão Codex. | Específico de Codex / CLI externo. | Não aplicável localmente sem autenticação `gh`. | Baixo. Verificação local via scripts canónicos. | **Bloqueado (Prereq Auth)** |
| **20. Security Review** (`20-security-review.md`) | `differential-review` (Trail of Bits) e prompt reutilizável de revisão de segurança. | Total. Skill adicionada a `.agents/skills/differential-review`. Prompt documentado em `docs/quality.md`. | Local (`.agents/skills/` + `docs/quality.md`). | Zero dependências npm. Relatórios privados gerados fora do repositório. | Nulo. Inspeção estrita e determinística de diffs e limites de confiança. | **Instalado & Ativo** |
| **21. shadcn/ui** (`21-shadcn-ui.md`) | Diretrizes para componentes shadcn/ui. | Rejeitado por arquitetura. `AGENTS.md` proíbe expressamente bibliotecas UI pesadas. | Não instalado. | Preservadas primitivas leves de Tailwind CSS existentes. | Nulo. Respeita restrição fundamental do projeto. | **Não Aplicável (Vetado)** |
| **22. Sentry MCP** (`22-sentry-mcp.md`) | Diagnóstico de erros e tracing via servidor MCP Sentry. | Requer conta e token OAuth Sentry. | Servidor MCP externo. | Não consome recursos se ausente. | Nulo. Erros de runtime tratados localmente via logging estruturado. | **Pendente (Config OAuth)** |

---

## 3. Inventário de Componentes Instalados e Localização

Com esta integração, o diretório canónico de skills do workspace (`.agents/skills/`) foi expandido de 25 para **31 skills**, todas auditadas, sem conflitos de nomenclatura e prontas para descoberta automática pelo Antigravity:

### A. Novas Skills Instaladas Localmente
1. **`differential-review`** (`.agents/skills/differential-review/`):
   - *Origem:* Trail of Bits (`trailofbits/skills/plugins/differential-review/skills/differential-review`)
   - *Finalidade:* Revisão de segurança diferencial focada em PRs, commits e diffs (cálculo de blast radius, verificação de callers, invariantes de autorização e ausência de testes em código alterado).
   - *Ficheiros:* `SKILL.md`, `methodology.md`, `patterns.md`, `reporting.md`, `adversarial.md`.
2. **`next-bundle-optimizer`** (`.agents/skills/next-bundle-optimizer/`):
   - *Origem:* Vercel Next.js (`vercel/next.js/canary/skills/next-bundle-optimizer`)
   - *Finalidade:* Auditoria evidenciada de pacotes e dependências de rotas Next.js via `next analyze` sem alteração prematura de código.
   - *Ficheiros:* `SKILL.md`.
3. **`next-dev-loop`** (`.agents/skills/next-dev-loop/`):
   - *Origem:* Vercel Next.js (`vercel/next.js/canary/skills/next-dev-loop`)
   - *Finalidade:* Verificação de runtime integrando `/_next/mcp` e browser de automação no ciclo de desenvolvimento Turbopack.
   - *Ficheiros:* `SKILL.md`.
4. **`react-view-transitions`** (`.agents/skills/react-view-transitions/`):
   - *Origem:* Vercel Labs (`vercel-labs/agent-skills/skills/react-view-transitions`)
   - *Nome Frontmatter:* `vercel-react-view-transitions`
   - *Finalidade:* Implementação de transições nativas suaves via React View Transition API (`<ViewTransition>`) no Next.js App Router com suporte estrito a `prefers-reduced-motion`.
   - *Ficheiros:* `SKILL.md`, `references/css-recipes.md`, `references/implementation.md`, `references/nextjs.md`, `references/patterns.md`, `references/troubleshooting.md`.
5. **`writing-guidelines`** (`.agents/skills/writing-guidelines/`):
   - *Origem:* Vercel Labs (`vercel-labs/agent-skills/skills/writing-guidelines`)
   - *Nome Frontmatter:* `writing-guidelines`
   - *Finalidade:* Auditoria de redação técnica e consistência de documentação Markdown.
   - *Ficheiros:* `SKILL.md`.
6. **`graphify`** (`.agents/skills/graphify/`):
   - *Origem:* Graphify (`Toessi/Graphify` / `safishamsi/graphify`)
   - *Nome Frontmatter:* `graphify`
   - *Finalidade:* Consulta e navegação determinística de grafos de código AST (`query`, `path`, `explain`). Ambiente local isolado em `.venv` via `requirements-graphify.txt`.
   - *Ficheiros:* `SKILL.md`, `references/add-watch.md`, `references/exports.md`, `references/extraction-spec.md`, `references/github-and-merge.md`, `references/hooks.md`, `references/query.md`, `references/transcribe.md`, `references/update.md`.

### B. Documentação Canónica Criada / Atualizada
1. **`AGENTS.md`**: Atualizado com acordos operacionais do toolkit (*Smallest Complete Solution*, *Concise Communication*, *Proportional Workflow*, governança de subagentes com seleção de modelo, roteamento de skills) preservando estritamente todas as regras de segurança, multi-tenancy, RLS e Next.js agent rules.
2. **`CLAUDE.md`**: Criado como ponte canónica leve apontando para `AGENTS.md` e `docs/`.
3. **`requirements-graphify.txt`**: Dependências diretas e transitivas de AST fixadas com versões exatas para instalação determinística via `pip install -r requirements-graphify.txt`.
4. **`docs/setup.md`** (este documento): Registo de evidências, fontes, matriz integral e guia de manutenção.
5. **`docs/quality.md`**: Comandos canónicos de validação, limites de qualidade, estratégia de testes e protocolo reutilizável de revisão de segurança (baseline e diff).
6. **`docs/design.md`**: Diretrizes visuais (OLED Dark Minimalist SaaS), acessibilidade (WCAG AA) e catálogo de design tokens.
7. **`docs/onboarding.md`**: Guia de preparação do ambiente local e primeiros passos para programadores e agentes.

---

## 4. Evidência de Descoberta das Skills pelo Antigravity

No Antigravity, as skills localizadas no diretório `.agents/skills/<skill-folder>/SKILL.md` são indexadas dinamicamente com base no respetivo cabeçalho YAML frontmatter (`name`, `description`).

### Resultado da Verificação dos 31 Manifestos:
- **Total de Diretórios:** 31
- **Manifestos `SKILL.md` Válidos:** 31 / 31 (100%)
- **Nenhum Erro de Parse ou Conflito de Nomes Detetado.**
- **Nomes Ativos Registados:**
  - Arquitetura & Qualidade: `architect`, `check`, `debug`, `document`, `skill-creator`, `test`.
  - Design & UX: `ui-ux-pro-max`, `frontend-design`, `ui-styling`, `design-system`, `design`, `brand`, `slides`, `banner-design`.
  - React & Next.js: `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines`, `vercel-react-view-transitions`, `vercel-optimize`, `next-bundle-optimizer`, `next-dev-loop`, `deploy-to-vercel`, `find-skills`.
  - Backend & Dados: `supabase`, `supabase-postgres-best-practices`, `stripe-best-practices`.
  - Segurança Aplicacional: `owasp-security`, `differential-review`.
  - Testes E2E: `webapp-testing`.

---

## 5. Governança de Subagentes e Seleção de Modelos

Em conformidade com a secção 6 do prompt `12-existing-project-setup.md`, o Antigravity suporta nativamente o lançamento de subagentes via `invoke_subagent` com parametrização de modelo:

| Tipo de Tarefa | Nível de Modelo Recomendado | Justificação |
| :--- | :--- | :--- |
| **Pesquisas, inventários de ficheiros, leitura de logs, verificações mecânicas** | `flash_lite` / `flash` | Execução rápida com custo reduzido e contexto limpo; saídas verificáveis deterministicamente. |
| **Implementação circunscrita, refatoração pontual, geração de testes unitários** | `inherit` (Padrão) | Capacidade equilibrada para compreender contratos e executar verificações locais. |
| **Arquitetura, modelação de dados, segurança, RLS, concorrência, revisão crítica** | `pro` | Raciocínio profundo e rigor matemático necessários para prevenir vazamento multi-tenant ou falhas de autorização. |

> **Nota Obrigatória:** Por diretriz do sistema, subagentes utilizam `Model: 'inherit'` por defeito, a menos que o utilizador solicite explicitamente ou o contexto exija elevação para segurança crítica. Nenhuma API externa ou proxy de faturação é introduzida.

---

## 6. Estimativa Fundamentada do Impacto no Contexto

> [!IMPORTANT]
> **Distinção entre Estimativa Fundamentada e Poupanças Medidas:**  
> Não foram efetuadas medições comparativas empíricas de contagem de tokens entre sessões antes e após esta integração; logo, **não se afirma que o consumo absoluto de tokens diminuiu**. A análise abaixo reflete os vetores arquiteturais de eficiência introduzidos pelo toolkit.

### Vetores de Eficiência de Contexto (Grounded Analysis):
1. **Indexação Enxuta de Instruções:** O ficheiro `AGENTS.md` atua como índice de autoridade apontando para `docs/` e `lib/`, evitando que o modelo carregue especificações de produto, esquemas SQL completos ou relatórios em cada turno conversacional.
2. **Carregamento sob Demanda de Skills (Lazy Loading):** As 30 skills residem em ficheiros `SKILL.md` e referências que são lidas pelo agente apenas quando a tarefa em curso exige aquela especialização (ex: `supabase-postgres-best-practices` só é consultada ao alterar ficheiros SQL ou RLS).
3. **Disciplina Ponytail:** Ao exigir a menor alteração suficiente e proibir refatorações colaterais, os diffs produzidos são menores, reduzindo drasticamente os tokens de entrada e saída consumidos durante a revisão de código.
4. **Comunicação Caveman:** Redução de preâmbulos e explicações redundantes nas respostas ao utilizador, mantendo código e documentação em linguagem técnica completa.
5. **Isolamento via Subagentes:** Tarefas paralelas ou especializadas rodam em sessões separadas com histórico limpo, evitando acumulação desnecessária de passos intermediários na janela de contexto da sessão principal.

---

## 7. Manutenção, Atualização e Próximos Passos

### Procedimento de Atualização das Skills Locais
Para atualizar as skills sem sobrescrever personalizações locais do BusinessBrain:
```bash
# Atualização direcionada de skills Vercel (se executado via CLI oficial)
npx --yes skills@latest update --project --yes
```

### Próximos Passos para a Fase 2 (Após Validação Desta Entrega)
1. **Revisão das Especificações da Fase 2:** Utilizar a skill `architect` para redigir a especificação funcional em `docs/specs/phase-2-spec.md`.
2. **Auditoria de Segurança Pré-Implementação:** Aplicar o prompt de segurança de `docs/quality.md` e a skill `differential-review` sobre as rotas de API que serão expandidas.
3. **Manutenção do Zero-Leakage:** Garantir que nenhuma chave Stripe, Supabase ou Gemini seja exposta durante a implementação da nova fase.
