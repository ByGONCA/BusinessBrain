# BusinessBrain — Contexto Canónico para Agentes de IA

> Objetivo: fornecer contexto compacto e verificável para agentes de programação. Este ficheiro orienta a investigação; não substitui o código, as migrações nem os documentos canónicos.

## 1. Regra principal: confirmar o estado real

Antes de alterar qualquer coisa:
1. Lê `AGENTS.md` e este documento.
2. Confirma o branch, o estado do working tree e o diff existente. Preserva alterações do utilizador.
3. Inspeciona os ficheiros e callers relevantes, migrações e testes. Não concluas que algo está implementado ou em falta apenas porque aparece num relatório antigo.
4. Consulta os documentos canónicos relevantes, apenas sob demanda:
   - Produto: [PRODUCT.md](./PRODUCT.md)
   - Roadmap/estado declarado: [ROADMAP.md](./ROADMAP.md)
   - Arquitetura: [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Base de dados/RLS: [DATABASE.md](./DATABASE.md)
   - Qualidade e testes: [quality.md](./quality.md)
   - Setup e evidência histórica: [setup.md](./setup.md)
   - UI/design: [design.md](./design.md) e `../DESIGN.md`, apenas para tarefas de frontend.
5. Se a documentação contradisser o código, regista a discrepância e privilegia evidência atual verificável para descrever o comportamento real. Atualiza a documentação canónica quando isso fizer parte do âmbito.

## 2. Identidade e produto

- Nome do repositório: BusinessBrain; o produto também aparece documentado como Company Brain.
- Objetivo: espaço de trabalho multi-tenant para memória empresarial, conhecimento, decisões, reuniões, projetos, tarefas e operações com assistência de IA.
- Stack declarada em `package.json`: Next.js App Router 16, React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, `@supabase/ssr`, Stripe, Zod e Lucide.
- Internacionalização: `en` (predefinição), `pt`, `es`, `fr`; texto da interface deve usar o sistema central em `lib/i18n/dictionaries/`.
- Não implementar chamadas reais ao Gemini/LLM, embeddings, vector DB ou RAG externo sem autorização explícita para essa fase.

## 3. Invariantes de arquitetura e segurança

- Multi-tenancy é uma fronteira de segurança: verificar sempre a organização e a membership no servidor; RLS no PostgreSQL é obrigatória, não opcional.
- Autenticação não equivale a entitlement. O acesso ao dashboard depende da organização e de subscrição/trial elegível, segundo `lib/organizations/entitlements.ts`.
- Ações normais usam o cliente Supabase autenticado e scoped; service-role apenas em caminhos de servidor autorizados, como webhooks/jobs, sem expor segredos.
- Nunca confiar em `organization_id`, Price ID, flags de redirect ou estado de pagamento fornecidos pelo browser.
- Eventos Stripe devem ter assinatura validada; não conceder acesso com base em `success=true`.
- Nunca expor nem commitar chaves, tokens, ficheiros `.env` ou dados sensíveis.
- Não executar alterações remotas a Supabase, Stripe, email, hosting ou produção/staging sem autorização explícita.
- Consentimento de marketing é opcional e nunca vem pré-selecionado; consentimento de termos/privacidade é separado.
- Reutilizar padrões e serviços existentes em `lib/`; Server Components por defeito; evitar dependências e refactors não solicitados.
- UI deve respeitar as regras de `AGENTS.md`: traduções completas, sem badges decorativos em forma de pill e sem jargão interno de engenharia em ecrãs de negócio.

## 4. Comandos canónicos

Confirmados no `package.json` atual:
- `npm run dev` ou `npm run dev:turbo`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` — executa `npx tsx scripts/test-runner.ts`

Executa testes direcionados para a área alterada e os gates aplicáveis. Não digas que um teste passou se não foi executado; inclui comando e resultado real. Se o ambiente não permitir executar, identifica a limitação.

## 5. Estado do projeto: como o reportar

A documentação contém um aviso explícito de discrepância entre o roadmap e relatórios de implementação. Por isso, não uses percentagens globais nem declares a fase concluída sem verificar o código e a evidência.

Classifica cada afirmação relevante como:
- **Confirmado no código** — inspecionado no branch/commit atual.
- **Teste executado** — comando executado agora, com resultado observado.
- **Validado operacionalmente** — verificado em ambiente real, com evidência concreta e autorização.
- **Histórico / não confirmado** — apenas relatórios ou documentação anteriores.
- **Pendente** — falta implementação, teste ou validação operacional.

Especialmente em Stripe, emails, OAuth e migrações, separar implementação local de funcionamento real. Nunca inventar outputs, IDs, resultados, métricas ou provas de produção.

## 6. Como trabalhar

1. Define o objetivo e os critérios de aceitação da tarefa.
2. Faz inspeção direcionada antes de desenhar uma solução.
3. Para mudanças pequenas, implementa a menor solução completa. Para alterações estruturais, segurança, schema ou mudanças com impacto multi-tenant, apresenta primeiro um plano curto e os riscos.
4. Faz alterações focadas, preserva trabalho existente e evita alterar ficheiros não relacionados.
5. Adiciona/atualiza testes para regressões e edge cases.
6. Executa verificações relevantes.
7. Revê o diff final e procura regressões de segurança, i18n, autorização e documentação.
8. Atualiza os documentos canónicos apenas quando o estado mudou; não dupliques arquitetura em vários ficheiros.

### Perguntas ao utilizador

Não faças perguntas por rotina. Resolve através do repositório quando a resposta puder ser verificada. Se houver bloqueio real ou uma decisão de produto irreversível:
- faz no máximo um bloco consolidado de perguntas;
- explica brevemente o que já verificaste e porque é que falta uma decisão;
- apresenta uma opção recomendada quando existirem alternativas;
- não pares para perguntar por preferências triviais que possam ser inferidas com segurança.

## 7. Restrições por defeito

Salvo pedido explícito em contrário:
- Não fazer deploy, commit, push, migração remota, alteração de dados remotos nem pagamentos reais.
- Não iniciar uma nova fase do roadmap.
- Não adicionar bibliotecas pesadas ou serviços externos.
- Não fazer refactors gerais durante uma correção pontual.
- Não afirmar que a aplicação está “segura” ou “pronta para produção” com base apenas em typecheck/lint/testes locais.

## 8. Formato da resposta final

Usa uma síntese curta e verificável:
1. **Alterações** — ficheiros e comportamento alterado.
2. **Verificação** — comandos executados e resultados exatos.
3. **Riscos/pendências** — o que continua sem validação, incluindo dependências remotas.
4. **Decisões necessárias** — apenas se bloquearem o trabalho.
5. **Estado do repositório** — commits/push/deploy só se realmente ocorreram.

Não despejes todo o contexto novamente na resposta. Dá caminhos concretos para os ficheiros alterados.
