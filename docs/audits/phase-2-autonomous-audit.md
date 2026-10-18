# BusinessBrain — Relatório de Auditoria Autónoma Contínua (Fase 2)

**Data da Auditoria**: 2026-10-18  
**Ambiente**: Repositório Local (Windows x64 / Node.js / Turbopack / PGlite WASM Postgres 16)  
**Branch**: `main` (commit base: `1ebec46b96e953158c3f91040449495147814b7e`)  
**Escopo**: Auditoria adversarial, correção local, testes de regressão e documentação da Fase 2 (Knowledge & Company Memory).

---

## 1. Estado Inicial do Repositório

Antes de qualquer nova intervenção, o estado do repositório foi inventariado:
- **Git Branch**: `main` limpo em relação ao remote (`origin/main`).
- **Ficheiros pré-existentes modificados localmente**:
  - `AGENTS.md` (regras e convenções de arquitetura)
  - `.gitignore` (exclusões de segurança e caches)
  - `package.json` (dependências e scripts de teste)
  - `components/dashboard/pages/block-editor.tsx` (OCC no editor, modal de conflito e rascunho recuperado)
  - `lib/pages/actions.ts` (RPCs, OCC, Snippets, Reorder com ordenação determinística)
  - `lib/pages/queries.ts`, `lib/pages/types.ts`
  - `app/dashboard/connections/page.tsx`, `components/dashboard/connections/interactive-graph-canvas.tsx`, `lib/connections/graph-algorithms.ts`, `lib/connections/queries.ts`
- **Ficheiros não rastreados**:
  - `database/migrations/00029_company_memory_and_multilingual_search.sql`
  - 7 pastas de Agent Skills e documentação (`docs/setup.md`, `docs/quality.md`, `docs/design.md`, `docs/onboarding.md`, `DESIGN.md`)
  - 18 suítes de testes em `scripts/` coordenadas por `scripts/test-runner.ts`.

---

## 2. Auditoria Adversarial Detalhada (Secções A–H)

### A. Concorrência OCC e `revision_id` Monotónico
- **Alegação do Relatório**: Concorrência baseada em `revision_id bigint not null default 1` com validação no RPC `save_page_content`.
- **Verificação no Código/SQL**:
  - `database/migrations/00029_company_memory_and_multilingual_search.sql` adiciona a coluna `revision_id` com default 1.
  - O RPC `save_page_content` adquire `SELECT ... FOR UPDATE` sobre a linha da página, compara `v_current_revision <> p_expected_revision` e lança exceção com código `P0001` (`STALE_WRITE`) em caso de discrepância.
  - Restauros de versão via `restore_page_version` incrementam monotonicamente o `revision_id`, invalidando qualquer autosave em voo que possua um token anterior.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### B. Integridade dos Triggers de Incremento
- **Alegação**: Triggers de base de dados impedem atualizações silenciosas e incrementam `revision_id` de forma fiável.
- **Verificação**:
  - Trigger `trg_pages_increment_revision` dispara em `BEFORE UPDATE` e verifica:
    ```sql
    IF (NEW.content IS DISTINCT FROM OLD.content OR
        NEW.title IS DISTINCT FROM OLD.title OR
        NEW.content_text IS DISTINCT FROM OLD.content_text) THEN
      IF NEW.revision_id IS NOT DISTINCT FROM OLD.revision_id THEN
        NEW.revision_id := coalesce(OLD.revision_id, 0) + 1;
      END IF;
    END IF;
    ```
  - Se o RPC ou Server Action já especificou `NEW.revision_id = OLD.revision_id + 1`, a condição previne duplo incremento indesejado.
  - Modificações pontuais (ex: `updatePageTitleAction`) que alterem o título invalidam tokens anteriores de editores com rascunhos antigos.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### C. Inserção de Snippets do GitHub e OCC
- **Alegação**: Ação de inserção de blocos (`addCodeSnippetToPageAction`) obedece a OCC e previne sobrescritas cegas.
- **Verificação**:
  - `lib/pages/actions.ts`: `addCodeSnippetToPageAction` recebe `expectedRevision?: number`.
  - Se `expectedRevision` for fornecido e divergir do `revision_id` atual da página, rejeita com `{ success: false, code: "STALE_WRITE" }`.
  - Ao invocar o RPC `save_page_content`, passa o token de revisão atual da página, garantindo bloqueio atómico com `FOR UPDATE`.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### D. Reordenação e Prevenção de Deadlocks
- **Alegação**: Ação `reorderPagesAction` ordena bloqueios deterministicamente por ID ASC e possui retry exponencial com jitter para erro 40P01.
- **Verificação**:
  - Em `lib/pages/actions.ts`:
    ```typescript
    const sortedUpdates = [...updates].sort((a, b) => a.id.localeCompare(b.id));
    ```
  - Todas as transações concorrentes adquirem locks na mesma ordem lexical de UUIDs, eliminando ciclos de deadlock clássicos A->B vs B->A.
  - Implementado laço de retry limitado (3 tentativas) com delay aleatório `baseDelay * Math.pow(2, attempt) + jitter` para absorver contenções esporádicas.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### E. Editor Frontend e Preservação de Rascunhos
- **Alegação**: Na receção de `STALE_WRITE`, o editor suspende o autosave, limpa timers, retém o rascunho em memória e apresenta opções explícitas.
- **Verificação**:
  - Em `components/dashboard/pages/block-editor.tsx`:
    - `isConflictSuspendedRef.current = true` suspende ticks de debounce e blur events.
    - O modal exibe 3 opções claras:
      1. Recarregar (descarta rascunho e lê versão mais recente do servidor).
      2. Guardar Cópia (cria nova página independente com `(Rascunho Recuperado)` preservando os blocos do utilizador).
      3. Substituir Conscientemente (obtém o token mais recente via `getPageLatestRevisionAction` e grava forçadamente sob confirmação).
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### F. Migração 00029 e Pré-Check 100% Não-Destrutivo
- **Alegação**: A migração 00029 aborta com erro explícito se existirem duplicados em `page_versions (page_id, version_number)`, sem qualquer renumeração automática ou perda de referências de auditoria.
- **Verificação**:
  - Bloco de pré-validação SQL em `00029_company_memory_and_multilingual_search.sql`:
    ```sql
    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: Found % duplicate version records...', v_duplicate_count
        USING ERRCODE = 'P0003';
    END IF;
    ```
  - Se limpo, cria o índice único `uq_page_versions_page_version`.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

### G. Pesquisa Multilíngue e Isolamento Multi-Tenant
- **Alegação**: Pesquisa unificada com `immutable_unaccent` e `sanitize_tsquery_input` respeita permissões `pages.view` e `brain.view`.
- **Análise Crítica & Defeitos Identificados**:
  - *Problema Encontrado*: A versão original de `global_workspace_search` na migração 00029 selecionava a organização do utilizador através de `SELECT organization_id INTO v_org_id FROM public.organization_members WHERE user_id = v_user_id LIMIT 1;`. Para utilizadores pertencentes a múltiplas organizações, `LIMIT 1` selecionava uma organização arbitrária, quebrando o isolamento do workspace ativo.
  - *Problema Encontrado*: As chamadas internas a `public.has_permission(v_user_id, v_org_id, ...)` em 00029 passavam 3 parâmetros, enquanto a função canónica SQL `public.has_permission(target_org_id, required_key)` definida nas migrações 00023 e 00025 apenas aceita 2 parâmetros (obtendo `v_uid` via `auth.uid()`).
  - *Correção Efetuada*:
    1. O RPC `global_workspace_search` foi atualizado para aceitar `p_organization_id uuid DEFAULT NULL`.
    2. Quando fornecido, valida estritamente a pertença do utilizador através de `EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_user_id AND organization_id = p_organization_id)`. Se não for membro, lança `FORBIDDEN` (42501).
    3. As chamadas a `has_permission` foram corrigidas para `public.has_permission(v_org_id, 'pages.view')` e `public.has_permission(v_org_id, 'brain.view')`.
    4. Em `lib/pages/actions.ts` (`searchPagesAction`), a invocação RPC foi atualizada para fornecer explicitamente `p_organization_id: activeOrg.id`.
- **Veredito**: **CORRIGIDO E VALIDADO COM TESTES DE REGRESSÃO**.

### H. Permissões Canónicas e Precedência de DENY
- **Alegação**: A precedência estrita (Owner Root > DENY Explícito > ALLOW Explícito > Permissões de Equipa > Fechado por Omissão) é mantida em todas as 52 chaves.
- **Verificação**:
  - Testado via simulação em memória e via PGlite com a migração 00023 em `scripts/test-permissions-system.ts`.
  - 100% dos testes de autorização passaram com sucesso.
- **Veredito**: **CONFIRMADO COM SUCESSO**.

---

## 3. Correções Aplicadas Nesta Sessão

1. **`database/migrations/00029_company_memory_and_multilingual_search.sql`**:
   - Correção dos argumentos de chamada a `public.has_permission`:
     - Em `save_page_content`: alterado `public.has_permission(v_user_id, v_org_id, 'pages.edit')` para `public.has_permission(v_org_id, 'pages.edit')`.
     - Em `restore_page_version`: alterado `public.has_permission(v_user_id, v_org_id, 'pages.edit')` para `public.has_permission(v_org_id, 'pages.edit')`.
     - Em `global_workspace_search`: alterado para `public.has_permission(v_org_id, 'pages.view')` e `public.has_permission(v_org_id, 'brain.view')`.
   - Adição do parâmetro `p_organization_id uuid DEFAULT NULL` a `global_workspace_search`, com verificação rigorosa de membership.
2. **`lib/pages/actions.ts`**:
   - Atualização de `searchPagesAction` para passar `p_organization_id: activeOrg.id` ao RPC `global_workspace_search`.
3. **`scripts/test-search-comprehensive.ts`**:
   - Expansão da suíte de testes em PGlite para incluir o teste funcional completo de `global_workspace_search`, validando busca multilíngue ("relatorio" -> "Relatório"), isolamento de permissões (`pages.view` vs `brain.view`) e isolamento multi-tenant (`FORBIDDEN` ao aceder a organização alheia).

---

## 4. Evidência de Testes e Portões de Qualidade

- **Suítes de Teste Executadas**: 18/18 suítes com 100% de sucesso.
- **TypeScript (`npm run typecheck`)**: 0 erros.
- **ESLint (`npm run lint`)**: 0 erros.
- **Build (`npm run build`)**: 47/47 rotas compiladas com sucesso sem warnings de compilação.

---

## 5. Riscos Residuais e Limites de Homologação

1. **Execução Remota da Migração 00029**:
   - A migração foi auditada e validada em PGlite WASM (PostgreSQL 16).
   - A sua aplicação em produção (Supabase Cloud) deve ser realizada via pipeline de migrações oficial do projeto (`supabase db push` ou console administrativa) com prévia verificação de ausência de duplicados em `page_versions`.
2. **Políticas de RLS em Buckets de Storage**:
   - A autorização de uploads para anexos de páginas é validada a nível de aplicação em `requestUploadAuthorizationAction`.
   - O hardening das políticas RLS internas da tabela `storage.objects` exige privilégios no Supabase Cloud e deve ser sincronizado na fase de infraestrutura.
3. **Validação E2E no Browser Real**:
   - Os testes de concorrência e conflitos de editor foram validados de forma determinística a nível de motor e de ação. Testes visuais E2E com múltiplos utilizadores concorrentes devem ser realizados em ambiente de staging.
