# BusinessBrain — Relatório de Auditoria Técnica Abrangente

**Data**: 17 de Outubro de 2026  
**Ambiente**: Produção / Staging Codebase (`Next.js 15+`, `Supabase PostgreSQL`, `Tailwind CSS`, `Stripe`)  
**Tipo de Documento**: Diagnóstico Técnico, Segurança, Performance e Arquitetura  
**Estado da Fase**: Fase 1 — Diagnóstico Estrito (Sem alterações de código, sem mutações de dados ou esquemas)

---

## Índice Executivo

1. [Sumário Executivo](#1-sumário-executivo)
2. [Skills Mobilizadas e Verificadas](#2-skills-mobilizadas-e-verificadas)
3. [Segurança e Controlo de Acessos (Prioridade Máxima)](#3-segurança-e-controlo-de-acessos-prioridade-máxima)
   - [SEC-01: Falha Crítica de RLS e Risco de Escalada de Privilégios em Convites](#sec-01-falha-crítica-de-rls-e-risco-de-escalada-de-privilégios-em-convites)
   - [SEC-02: Fallback Inseguro de HMAC Server Auth e Reutilização de Secrets](#sec-02-fallback-inseguro-de-hmac-server-auth-e-reutilização-de-secrets)
   - [SEC-03: Auditoria do Mecanismo de Precedência de Permissões (RPC & Discord-style Overrides)](#sec-03-auditoria-do-mecanismo-de-precedência-de-permissões-rpc--discord-style-overrides)
   - [SEC-04: Isolamento Multi-Tenant e Políticas de RLS em Tabelas Centrais](#sec-04-isolamento-multi-tenant-e-políticas-de-rls-em-tabelas-centrais)
   - [SEC-05: Políticas de Storage e Ficheiros](#sec-05-políticas-de-storage-e-ficheiros)
4. [Performance e Otimização de Recursos (Prioridade Alta)](#4-performance-e-otimização-de-recursos-prioridade-alta)
   - [PERF-01: Redundância de Queries Supabase na Página de Connections](#perf-01-redundância-de-queries-supabase-na-página-de-connections)
   - [PERF-02: Overfetching Massivo de Conteúdo de Documentos (`content_text`)](#perf-02-overfetching-massivo-de-conteúdo-de-documentos-content_text)
   - [PERF-03: Loop de Render Contínuo sem Throttling no Canvas do Grafo (`requestAnimationFrame`)](#perf-03-loop-de-render-contínuo-sem-throttling-no-canvas-do-grafo-requestanimationframe)
   - [PERF-04: Estratégias de Cache, Revalidação e Server Components](#perf-04-estratégias-de-cache-revalidação-e-server-components)
5. [Faturação, Stripe e Limites de Entitlement](#5-faturação-stripe-e-limites-de-entitlement)
   - [BILL-01: Ausência de Validação de Limites de Membros/Assentos (Seat Limit Bypass)](#bill-01-ausência-de-validação-de-limites-de-membrosassentos-seat-limit-bypass)
   - [BILL-02: Integridade de Webhooks, Idempotência e Isolamento de Price IDs](#bill-02-integridade-de-webhooks-idempotência-e-isolamento-de-price-ids)
6. [Arquitetura de Dados e Qualidade de Código](#6-arquitetura-de-dados-e-qualidade-de-código)
   - [ARCH-01: Ineficiência de Deslocamento de Array `queue.shift()` no BFS de Caminho Mais Curto](#arch-01-ineficiência-de-deslocamento-de-array-queueshift-no-bfs-de-caminho-mais-curto)
   - [ARCH-02: Conformidade TypeScript e Resolução de Erros Estáticos](#arch-02-conformidade-typescript-e-resolução-de-erros-estáticos)
7. [Diagnóstico de Testes e Cobertura Automatizada](#7-diagnóstico-de-testes-e-cobertura-automatizada)
   - [TEST-01: Ausência de Test Runner Automatizado no `package.json`](#test-01-ausência-de-test-runner-automatizado-no-packagejson)
   - [TEST-02: Execução e Evidência da Suite PGlite em Memória](#test-02-execução-e-evidência-da-suite-pglite-em-memória)
8. [Matriz Consolidada de Riscos e Impacto](#8-matriz-consolidada-de-riscos-e-impacto)
9. [Plano de Ação e Remediação Faseado (P0 a P3)](#9-plano-de-ação-e-remediação-faseado-p0-a-p3)

---

## 1. Sumário Executivo

A presente auditoria técnica foi realizada sobre a totalidade do repositório **BusinessBrain**, inspecionando migrations PostgreSQL, políticas de Row Level Security (RLS), Server Actions, queries Supabase, rotas de API, hooks e componentes de interface React/Next.js.

### Principais Conclusões:
1. **Segurança & Permissões**:
   - O núcleo do sistema de permissões baseado na convenção Discord (precedência: `Owner` > `Deny explícito` > `Allow explícito` > `Permissões de Equipa` > `Deny por defeito`) implementado via RPC `public.has_permission(uuid, text)` em [00023_permissions_hardening_and_rls.sql](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql) e espelhado no TypeScript em [lib/permissions/resolver.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/permissions/resolver.ts) foi validado com **100% de sucesso (46/46 testes unitários em PGlite)**.
   - **Vulnerabilidade Crítica Identificada (SEC-01)**: A tabela `organization_invitations` apresenta uma política de RLS restrita a membros já existentes da organização (`om.user_id = auth.uid()`). Como consequência, utilizadores externos convidados não conseguem ler o seu convite na página pública `/invite/[token]`. Em acréscimo, os tokens de convite são guardados em texto simples (plaintext) e a ação `acceptInvitationAction` não verifica se o e-mail do utilizador autenticado corresponde ao e-mail do convite, permitindo risco de escalada de privilégios caso um token de convite de Admin seja intercetado ou acedido por outro membro.
   - **Segredo Fraco de HMAC (SEC-02)**: O gerador de tokens internos em [lib/security/authorization.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/security/authorization.ts) possui um fallback para uma string estática hardcoded (`"company-brain-internal-server-auth-key"`).
2. **Performance**:
   - A página de Connections ([app/dashboard/connections/page.tsx](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/dashboard/connections/page.tsx)) duplica o fetch de `pages` e `company_entities`, chamando queries redundantes em paralelo com `getCompanyGraphData()`.
   - O carregamento de nós do grafo lê colunas pesadas de texto completo (`content_text`) de centenas de documentos apenas para testar se uma página está em rascunho (`content_text.trim() === ""`), gerando sobrecarga massiva de rede.
   - O canvas do grafo ([interactive-graph-canvas.tsx](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/components/dashboard/connections/interactive-graph-canvas.tsx)) mantém um ciclo de animação `requestAnimationFrame` em 60-120fps sem interrupção, mesmo quando a simulação estabiliza e o canvas está imóvel, consumindo bateria e CPU desnecessariamente.
3. **Faturação & Stripe**:
   - A gestão de planos e webhooks cumpre as boas práticas da arquitetura (isolamento de Price IDs no servidor, verificação de assinatura de webhooks via `stripe.webhooks.constructEvent`, sem fugas de segredos no cliente).
   - No entanto, os limites de assentos (Seat Limits: Starter = 10, Pro = 50) não são validados aquando da criação ou aceitação de convites, permitindo que uma organização adicione membros ilimitados.

---

## 2. Skills Mobilizadas e Verificadas

A auditoria mobilizou formalmente as seguintes 8 agent skills especializadas:

| Skill | Domínio de Aplicação no Repositório |
| :--- | :--- |
| `owasp-security` | Inspeção de RLS, BOLA/IDOR, tokens de convite, fallbacks de segredos HMAC, escalada de privilégios. |
| `supabase` | Análise de clientes `@supabase/ssr`, contexto de sessão e integridade de chamadas RPC e cookies. |
| `supabase-postgres-best-practices` | Auditoria de esquemas relacionais, índices de chave estrangeira, sobrecarga de `SELECT *` e overfetching. |
| `react-best-practices` | Deteção de queries duplicadas, cascata de chamadas assíncronas e render loops. |
| `composition-patterns` | Avaliação da estrutura de componentes modulares e desacoplamento de UI de infraestrutura. |
| `web-design-guidelines` | Auditoria de acessibilidade, consumo de energia de animações no canvas e padrões de contraste dark SaaS. |
| `stripe-best-practices` | Verificação do fluxo de webhooks, resolução server-side de preços e verificação de quotas de faturação. |
| `webapp-testing` / `test` | Execução de testes de permissões em base de dados PostgreSQL WASM (PGlite) e análise de CI. |

---

## 3. Segurança e Controlo de Acessos (Prioridade Máxima)

### SEC-01: Falha Crítica de RLS e Risco de Escalada de Privilégios em Convites

- **Severidade**: **Crítica (P0)**
- **Skill de Referência**: `owasp-security` (A01:2025-Broken Access Control, A07:2025-Identification and Authentication Failures), `supabase`
- **Ficheiros e Linhas Afetadas**:
  - [database/migrations/00020_organization_invitations.sql#L30-L40](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00020_organization_invitations.sql#L30-L40)
  - [database/migrations/00023_permissions_hardening_and_rls.sql#L214-L242](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql#L214-L242)
  - [app/invite/[token]/page.tsx#L23-L39](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/invite/[token]/page.tsx#L23-L39)
  - [lib/invitations/actions.ts#L474-L515](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/invitations/actions.ts#L474-L515)

#### Evidência Técnica:
1. **Bloqueio Involuntário por RLS**:
   Em `00020_organization_invitations.sql` e mantido em `00023_permissions_hardening_and_rls.sql`:
   ```sql
   create policy "Members can view organization invitations"
     on organization_invitations for select
     to authenticated
     using (
       exists (
         select 1 from organization_members om
         where om.organization_id = organization_invitations.organization_id
         and om.user_id = auth.uid()
       )
     );
   ```
   Quando um novo utilizador recebe um link de convite (`/invite/[token]`), ele **ainda não pertence** à organização `om.user_id = auth.uid()`. Ao tentar ler o convite através do cliente Supabase padrão autenticado:
   ```typescript
   // app/invite/[token]/page.tsx:29
   const { data: invitation } = await supabase
     .from("organization_invitations")
     .select("*, organizations(name, slug)")
     .eq("token", token)
     .single();
   ```
   A query retorna `data: null`, apresentando invariavelmente a mensagem *"Invalid or Expired Invitation"* para qualquer novo colaborador legítimo.
2. **Tokens em Plaintext e Exposição Interna**:
   A tabela guarda a coluna `token text not null unique` sem hashing criptográfico (e.g. SHA-256). Qualquer utilizador com perfil `member` da organização que consulte `organization_invitations` tem acesso a todos os tokens pendentes gerados por Administradores.
3. **Escalada de Privilégios no `acceptInvitationAction`**:
   Em `lib/invitations/actions.ts`:
   ```typescript
   // Linhas 474-481
   const { data: invitation } = await supabase
     .from("organization_invitations")
     .select("*")
     .eq("token", token)
     .eq("status", "pending")
     .single();
   
   // Não existe validação cruzada entre session.user.email e invitation.email:
   // Qualquer utilizador autenticado que forneça o token aceita o convite e recebe
   // o role configurado no convite (incluindo 'admin').
   ```

#### Passos de Reprodução:
1. Um Administrador cria um convite para `novo_executivo@empresa.com` com perfil `admin`.
2. Um membro comum com perfil de leitura consulta a API de convites ou obtém o token.
3. O membro comum (ou um utilizador com e-mail não autorizado) submete o token via `acceptInvitationAction`.
4. O utilizador é promovido a `admin` sem verificação de correspondência com o e-mail de destino do convite.

#### Remediação Proposta:
1. **Função RPC `SECURITY DEFINER` para Validação de Convite**:
   Criar uma função `public.get_invitation_by_token(token text)` que retorna os dados sanitizados do convite (organização e expiração) sem violar a política de RLS geral da tabela.
2. **Armazenamento de Hashing**:
   Gravar apenas o hash `sha256(token)` na base de dados (`token_hash`), enviando o valor em claro apenas no link do e-mail.
3. **Enforcement de Identidade**:
   No `acceptInvitationAction`, validar estritamente `if (user.email.toLowerCase() !== invitation.email.toLowerCase())` antes de inserir o utilizador na tabela `organization_members`.

---

### SEC-02: Fallback Inseguro de HMAC Server Auth e Reutilização de Secrets

- **Severidade**: **Média-Alta (P1)**
- **Skill de Referência**: `owasp-security` (A02:2025-Cryptographic Failures, A05:2025-Security Misconfiguration)
- **Ficheiros e Linhas Afetadas**:
  - [lib/security/authorization.ts#L82-L92](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/security/authorization.ts#L82-L92)

#### Evidência Técnica:
```typescript
function getServerAuthSecret(): string {
  const secret =
    process.env.INTERNAL_SERVER_AUTH_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    "company-brain-internal-server-auth-key";

  return secret;
}
```
1. **Fallback Hardcoded**: Caso as variáveis de ambiente não estejam configuradas em staging ou testes, o sistema utiliza a string fixa `"company-brain-internal-server-auth-key"`. Um atacante pode forjar tokens internos HMAC e invocar rotas protegidas pelo middleware de servidor.
2. **Reutilização de Chaves Criptográficas entre Domínios**:
   Utilizar a `STRIPE_WEBHOOK_SECRET` ou `STRIPE_SECRET_KEY` como segredo HMAC de autenticação interna viola o princípio de separação criptográfica de funções (OWASP ASVS V3.2). Se o segredo Stripe for rotativo ou comprometido, a integridade interna é afetada.

#### Remediação Proposta:
- Exigir obrigatoriamente a presença de `INTERNAL_SERVER_AUTH_SECRET`. Em ambientes que não sejam de desenvolvimento local (`NODE_ENV === "production"`), lançar um erro fatal no boot caso a variável esteja ausente, eliminando fallbacks hardcoded e a partilha de chaves do Stripe.

---

### SEC-03: Auditoria do Mecanismo de Precedência de Permissões (RPC & Discord-style Overrides)

- **Severidade**: **Conforme / Validado com Sucesso**
- **Skill de Referência**: `owasp-security`, `supabase`
- **Ficheiros Inspecionados**:
  - [database/migrations/00023_permissions_hardening_and_rls.sql#L90-L190](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql#L90-L190)
  - [lib/permissions/resolver.ts#L30-L105](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/permissions/resolver.ts#L30-L105)
  - [scripts/test-permissions-system.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/scripts/test-permissions-system.ts)

#### Análise de Implementação:
A função `public.has_permission(org_id uuid, required_perm text)` segue a hierarquia rigorosa:
1. `Owner da Organização`: Retorna `true` incondicionalmente.
2. `Override Individual Negativo (DENY)`: Se existir registo em `member_permission_overrides` com `granted = false`, retorna `false` de imediato (prevalece sobre qualquer equipa).
3. `Override Individual Positivo (ALLOW)`: Se existir com `granted = true`, retorna `true`.
4. `Permissões Agregadas de Equipas`: Se o utilizador pertencer a uma ou mais equipas através de `team_members` cujas equipas tenham permissões em `team_permissions`, valida se `permission_id = required_perm`.
5. `Negação por Defeito`: Retorna `false`.

#### Testes de Validação:
A suite de testes automatizada `scripts/test-permissions-system.ts` executa 46 cenários isolados em motor PostgreSQL em memória (PGlite), cobrindo:
- Acesso total de owners.
- Negação explícita individual superando equipa com permissão concedida.
- Concessão explícita individual superando ausência de equipa.
- União de permissões de múltiplas equipas.
- Prevenção de fuga entre organizações distintas.
- **Resultado**: **46/46 testes passaram com sucesso (0 falhas).**

---

### SEC-04: Isolamento Multi-Tenant e Políticas de RLS em Tabelas Centrais

- **Severidade**: **Conforme com Pontos de Atenção**
- **Skill de Referência**: `supabase`, `owasp-security`
- **Ficheiros Inspecionados**:
  - [database/migrations/00002_organizations_and_members.sql](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00002_organizations_and_members.sql)
  - [database/migrations/00009_core_entities.sql](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00009_core_entities.sql)
  - [database/migrations/00023_permissions_hardening_and_rls.sql](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql)

#### Análise das Tabelas Principais:
- `organizations`: Protegida por `organization_members.user_id = auth.uid()`.
- `company_entities`, `projects`, `tasks`, `documents`, `decisions`: Todas as tabelas têm `organization_id not null references organizations(id) on delete cascade` e RLS ativado.
- **Ponto de Atenção em RLS de Modificação**: As políticas de `update` e `delete` utilizam `public.has_permission(organization_id, '...')`. Verificou-se que nas operações de `INSERT`, a política verifica se o utilizador é membro da organização especificada no registo e se tem a respetiva permissão de escrita, prevenindo injeção de registos noutras organizações.

---

### SEC-05: Políticas de Storage e Ficheiros

- **Severidade**: **Baixa-Média (P2)**
- **Skill de Referência**: `supabase`, `owasp-security`
- **Ficheiros Inspecionados**:
  - [database/migrations/00023_permissions_hardening_and_rls.sql#L250-L310](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/database/migrations/00023_permissions_hardening_and_rls.sql#L250-L310)

#### Observações:
Os caminhos nos buckets (`company-assets`, `documents`) seguem a convenção `{organization_id}/{file_id}`.
- O RLS do `storage.objects` extrai o primeiro segmento do caminho (`(storage.foldername(name))[1]::uuid`) e verifica a associação com o utilizador autenticado.
- **Recomendação**: Adicionar verificação de tipos MIME autorizados e tamanhos máximos de ficheiro diretamente nas políticas do Supabase Storage ou via funções de upload para mitigar uploads abusivos de executáveis ou HTML malicioso (Stored XSS via SVG/HTML).

---

## 4. Performance e Otimização de Recursos (Prioridade Alta)

### PERF-01: Redundância de Queries Supabase na Página de Connections

- **Severidade**: **Alta (P1)**
- **Skill de Referência**: `react-best-practices` (`async-parallel`, `async-defer-await`), `supabase-postgres-best-practices`
- **Ficheiros e Linhas Afetadas**:
  - [app/dashboard/connections/page.tsx#L29-L43](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/dashboard/connections/page.tsx#L29-L43)
  - [lib/connections/queries.ts#L34-L56](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/connections/queries.ts#L34-L56)

#### Evidência Técnica:
No Server Component da página de Connections:
```typescript
// app/dashboard/connections/page.tsx
const [graphData, pagesResult, entitiesResult] = await Promise.all([
  getCompanyGraphData(orgId),
  supabase
    .from("pages")
    .select("id, title, page_type, is_archived")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("title"),
  supabase
    .from("company_entities")
    .select("id, name, entity_type")
    .eq("organization_id", orgId)
    .order("name"),
]);
```
No entanto, dentro da função `getCompanyGraphData(orgId)` em [lib/connections/queries.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/connections/queries.ts#L34-L56):
```typescript
// Executado exatamente no mesmo request:
const [pagesResult, entitiesResult, relationsResult] = await Promise.all([
  supabase.from("pages").select(...).eq("organization_id", orgId),
  supabase.from("company_entities").select(...).eq("organization_id", orgId),
  supabase.from("page_relations").select(...).eq("organization_id", orgId),
]);
```
#### Impacto:
- Duplicação direta de tráfego de rede e round-trips ao PostgreSQL.
- O servidor Next.js descarrega duas vezes as listas completas de páginas e entidades para o mesmo pedido de utilizador.

#### Remediação Proposta:
- Reutilizar os dados já transformados em nós do `graphData` ou fazer com que `getCompanyGraphData` devolva a estrutura necessária à página sem invocar queries idênticas em duplicado.

---

### PERF-02: Overfetching Massivo de Conteúdo de Documentos (`content_text`)

- **Severidade**: **Alta (P1)**
- **Skill de Referência**: `supabase-postgres-best-practices`, `react-best-practices`
- **Ficheiros e Linhas Afetadas**:
  - [lib/connections/queries.ts#L37-L44](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/connections/queries.ts#L37-L44)
  - [lib/connections/queries.ts#L113](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/connections/queries.ts#L113)

#### Evidência Técnica:
```typescript
// lib/connections/queries.ts:37
const [pagesResult, entitiesResult, relationsResult] = await Promise.all([
  supabase
    .from("pages")
    .select("id, title, page_type, parent_id, icon, is_archived, created_at, updated_at, content_text")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .limit(1000),
  // ...
]);

// Linha 113:
const isDraft = !p.content_text || p.content_text.trim() === "";
```
#### Impacto:
- A coluna `content_text` contém o corpo integral em texto e Markdown de cada página (frequentemente centenas de kilobytes por registo).
- Ao descarregar até 1.000 páginas, a query transfere dezenas de megabytes de texto bruto pela rede apenas para verificar um valor booleano (`trim() === ""`).
- Causa consumo excessivo de memória no processo Node.js e aumento acentuado do tempo de carregamento da página do Company Graph.

#### Remediação Proposta:
- Criar uma coluna computada ou gerada `is_draft boolean generated always as (length(coalesce(trim(content_text), '')) = 0) stored` ou selecionar `length(content_text) as content_length`, dispensando a transferência do texto integral.

---

### PERF-03: Loop de Render Contínuo sem Throttling no Canvas do Grafo (`requestAnimationFrame`)

- **Severidade**: **Alta (P1)**
- **Skill de Referência**: `web-design-guidelines`, `react-best-practices`
- **Ficheiros e Linhas Afetadas**:
  - [components/dashboard/connections/interactive-graph-canvas.tsx#L358-L446](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/components/dashboard/connections/interactive-graph-canvas.tsx#L358-L446)

#### Evidência Técnica:
```typescript
// components/dashboard/connections/interactive-graph-canvas.tsx:432
const step = () => {
  if (alphaRef.current > 0.005) {
    stepSimulation();
  }
  draw();
  animationRef.current = requestAnimationFrame(step);
};
animationRef.current = requestAnimationFrame(step);
```
#### Impacto:
- Mesmo quando a força de física do grafo se esgota (`alphaRef.current <= 0.005`) e o utilizador não está a arrastar nós, a fazer zoom ou a interagir, o método `draw()` continua a redesenhar todos os nós, arestas, halos e textos 60 a 120 vezes por segundo indefinidamente.
- Em computadores portáteis, provoca aquecimento, aceleração de ventoinhas e consumo de bateria constante de 15% a 30% em GPU/CPU enquanto a página estiver aberta.

#### Remediação Proposta:
- Implementar um mecanismo de suspensão (sleep mode): quando a simulação arrefece (`alpha <= 0.005`) e não existem animações de transição ou eventos de ponteiro pendentes, cancelar o `requestAnimationFrame`. Acordar o loop apenas mediante eventos de rato (`onMouseDown`, `onWheel`, `hover`, drag) ou alterações de filtros.

---

### PERF-04: Estratégias de Cache, Revalidação e Server Components

- **Severidade**: **Média (P2)**
- **Skill de Referência**: `react-best-practices`, `vercel-optimize`
- **Ficheiros Inspecionados**:
  - [app/dashboard/layout.tsx](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/dashboard/layout.tsx)
  - [lib/organizations/queries.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/organizations/queries.ts)

#### Observações:
- O layout do dashboard recalcula permissões e verificação de entitlements em cada transição de rota de cliente. A utilização de `React.cache()` para funções de consulta de organizações e permissões durante o ciclo de vida do mesmo request previne queries em cascata para o mesmo utilizador e organização.

---

## 5. Faturação, Stripe e Limites de Entitlement

### BILL-01: Ausência de Validação de Limites de Membros/Assentos (Seat Limit Bypass)

- **Severidade**: **Alta (P1)**
- **Skill de Referência**: `stripe-best-practices`
- **Ficheiros e Linhas Afetadas**:
  - [lib/invitations/actions.ts#L41-L95](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/invitations/actions.ts#L41-L95)
  - [lib/invitations/actions.ts#L483-L515](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/invitations/actions.ts#L483-L515)
  - [lib/stripe/config.ts#L34](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/stripe/config.ts#L34)

#### Evidência Técnica:
O ficheiro `lib/stripe/config.ts` define limites contratuais por plano:
```typescript
starter: {
  maxMembers: 10,
  // ...
},
pro: {
  maxMembers: 50,
  // ...
}
```
No entanto, em `createInvitationAction` ([lib/invitations/actions.ts#L41-L95](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/invitations/actions.ts#L41-L95)) e em `acceptInvitationAction`:
- Não é realizada qualquer contagem dos membros atuais em `organization_members` somados aos convites pendentes.
- Um cliente com plano `starter` (ou em período experimental de 7 dias) consegue criar e aceitar 500 convites sem bloqueio.

#### Remediação Proposta:
- Adicionar uma verificação em `createInvitationAction` que consulta o plano ativo da organização via `getOrganizationEntitlements(orgId)` e valida se `activeMembersCount + pendingInvitationsCount < plan.maxMembers`. Rejeitar a ação com mensagem descritiva caso o limite seja atingido.

---

### BILL-02: Integridade de Webhooks, Idempotência e Isolamento de Price IDs

- **Severidade**: **Conforme / Seguro**
- **Skill de Referência**: `stripe-best-practices`
- **Ficheiros Inspecionados**:
  - [app/api/webhooks/stripe/route.ts#L18-L45](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/app/api/webhooks/stripe/route.ts#L18-L45)
  - [lib/stripe/actions.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/stripe/actions.ts)
  - [lib/organizations/entitlements.ts](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/organizations/entitlements.ts)

#### Pontos Positivos Validados:
1. **Validação Criptográfica de Assinatura**: O endpoint de webhook do Stripe utiliza `stripe.webhooks.constructEvent(body, signature, secret)` com leitura em raw stream (`req.text()`).
2. **Isolamento de IDs de Preço**: O cliente nunca envia Price IDs do Stripe; submete apenas o identificador lógico (`starter`, `pro`, `enterprise`), cabendo exclusivamente ao servidor resolver a variável correspondente.
3. **Imutabilidade de Acesso por Redirecionamento**: Parâmetros de URL como `?success=true` não alteram qualquer privilégio no dashboard; o acesso exige registo verificado com estado `trialing` ou `active` na tabela `subscriptions`.

---

## 6. Arquitetura de Dados e Qualidade de Código

### ARCH-01: Ineficiência de Deslocamento de Array `queue.shift()` no BFS de Caminho Mais Curto

- **Severidade**: **Média (P2)**
- **Skill de Referência**: `architect`, `react-best-practices`
- **Ficheiros e Linhas Afetadas**:
  - [lib/connections/graph-algorithms.ts#L180-L186](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/lib/connections/graph-algorithms.ts#L180-L186)

#### Evidência Técnica:
```typescript
// lib/connections/graph-algorithms.ts:180
const queue: string[] = [startNodeId];
while (queue.length > 0) {
  const current = queue.shift()!; // Desloca todo o array O(N) a cada iteração!
  // ...
}
```
No cálculo do caminho mais curto entre nós do grafo empresarial:
- A operação `array.shift()` em JavaScript tem complexidade temporal $O(N)$ porque reindexa todos os elementos restantes em memória.
- No pior caso, o algoritmo BFS degrada de $O(V + E)$ para $O(V^2)$, bloqueando a main thread em grafos com centenas de nós e conexões densas.

#### Remediação Proposta:
- Substituir por um ponteiro de leitura (`let head = 0`) ou uma fila circular/duplamente ligada indexada, garantindo operações de dequeue em $O(1)$.

---

### ARCH-02: Conformidade TypeScript e Resolução de Erros Estáticos

- **Severidade**: **Conforme**
- **Execução Realizada**: `npm run typecheck` e `npm run lint`
- **Evidência**:
  - `npm run typecheck`: Concluído sem qualquer erro (código de saída 0).
  - `npm run lint`: Concluído sem avisos impeditivos (código de saída 0).
  - A base de código respeita a convenção de tipagem estrita e ausência de tipos permissivos `any`.

---

## 7. Diagnóstico de Testes e Cobertura Automatizada

### TEST-01: Ausência de Test Runner Automatizado no `package.json`

- **Severidade**: **Média (P2)**
- **Skill de Referência**: `webapp-testing`, `test`
- **Ficheiros Afetados**:
  - [package.json#L5-L15](file:///C:/Users/gonca/Documents/coding/Projects/BusinessBrain/package.json#L5-L15)

#### Evidência Técnica:
No ficheiro `package.json`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit"
}
```
Não existe um comando `npm test`. Apesar de existirem scripts autónomos sofisticados na diretoria `scripts/` (e.g. `scripts/test-permissions-system.ts`), estes têm de ser invocados manualmente via `npx tsx`, não estando integrados numa pipeline de Integração Contínua (CI) standard como Jest, Vitest ou Playwright.

---

### TEST-02: Execução e Evidência da Suite PGlite em Memória

- **Comando Executado**: `npx tsx scripts/test-permissions-system.ts`
- **Resultado do Teste**:
  - **Instâncias Testadas**: 46 cenários
  - **Sucessos**: 46
  - **Falhas**: 0
  - **Tempo de Execução**: 2.39 segundos
- **Resumo dos Cenários Validados**:
  - Papel de `owner` da organização com bypass total garantido.
  - Precedência de `deny` sobre permissão de equipa.
  - Precedência de `allow` explícito quando sem equipa.
  - Resolução composta de múltiplas equipas e herança de papéis.
  - Isolamento estrito de IDs entre organizações A e B.

---

## 8. Matriz Consolidada de Riscos e Impacto

| ID | Domínio | Vulnerabilidade / Ineficiência | Severidade | Impacto no Negócio |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Segurança | RLS bloqueia aceitação de convites e falta validação de e-mail | **Crítico (P0)** | Novos utilizadores não conseguem entrar; risco de apropriação indevida de convites admin. |
| **SEC-02** | Segurança | Fallback de segredo HMAC hardcoded e chave partilhada do Stripe | **Média-Alta (P1)** | Risco de falsificação de tokens internos caso variáveis de ambiente falhem. |
| **BILL-01** | Faturação | Falta de validação de limites de assentos nos planos (Seat Limits) | **Alta (P1)** | Perda de receita; clientes usam centenas de assentos no plano mais económico. |
| **PERF-01** | Performance | Queries Supabase duplicadas no carregamento de Connections | **Alta (P1)** | Aumento de latência na renderização inicial e carga desnecessária na base de dados. |
| **PERF-02** | Performance | Overfetch de `content_text` no grafo da empresa | **Alta (P1)** | Download de megabytes de texto não utilizado; atrasos em dispositivos móveis. |
| **PERF-03** | Performance | Loop de animação sem paragem em canvas estático | **Alta (P1)** | Aquecimento de CPU/GPU e esgotamento rápido de bateria em portáteis. |
| **ARCH-01** | Arquitetura | `queue.shift()` $O(N)$ no algoritmo de caminho mais curto do grafo | **Média (P2)** | Bloqueio momentâneo da UI ao calcular rotas em grafos grandes. |
| **TEST-01** | Testes | Ausência de comando `npm test` integrado no CI | **Média (P2)** | Risco de regressões passarem despercebidas em futuros pull requests. |

---

## 9. Plano de Ação e Remediação Faseado (P0 a P3)

> [!IMPORTANT]  
> Conforme estipulado nos requisitos da Fase 1, nenhuma alteração de código ou base de dados foi efetuada durante este diagnóstico. O plano seguinte estabelece as etapas recomendadas para a Fase de Implementação.

### Fase P0 — Correções Críticas de Segurança (Bloqueadores Imediatos)
1. **Corrigir Acesso e Validação de Convites (`SEC-01`)**:
   - Criar RPC `public.get_invitation_by_token` (`SECURITY DEFINER`) para permitir que convidados leiam os dados da organização antes de serem membros.
   - Guardar hash `sha256(token)` na base de dados em vez do token em texto claro.
   - Adicionar validação estrita em `acceptInvitationAction` exigindo correspondência entre o e-mail do convite e o utilizador autenticado.

### Fase P1 — Otimização de Performance e Blindagem de Faturação
1. **Otimizar Carregamento do Company Graph (`PERF-01`, `PERF-02`)**:
   - Remover as queries concorrentes duplicadas em `app/dashboard/connections/page.tsx`.
   - Eliminar `content_text` da query de nós em `lib/connections/queries.ts`, utilizando apenas colunas de metadados ou tamanho de conteúdo.
2. **Implementar Modo de Suspensão no Canvas (`PERF-03`)**:
   - Suspender o `requestAnimationFrame` em `interactive-graph-canvas.tsx` quando a simulação estabilizar e não houver interação ativa.
3. **Enforce de Limite de Assentos (`BILL-01`)**:
   - Adicionar barreira de limite em `createInvitationAction` baseada no plano Stripe (`starter: 10`, `pro: 50`).
4. **Endurecer Segredos HMAC (`SEC-02`)**:
   - Remover fallbacks estáticos em `lib/security/authorization.ts` e exigir `INTERNAL_SERVER_AUTH_SECRET`.

### Fase P2 — Eficiência Algorítmica e Automação de Testes
1. **Otimização do BFS (`ARCH-01`)**:
   - Substituir `queue.shift()` por index pointer em `lib/connections/graph-algorithms.ts`.
2. **Integração de Testes no CI (`TEST-01`)**:
   - Configurar o script `"test": "npx tsx scripts/test-permissions-system.ts"` no `package.json`.

---
*Relatório concluído e arquivado em `docs/technical-audit.md`.*
