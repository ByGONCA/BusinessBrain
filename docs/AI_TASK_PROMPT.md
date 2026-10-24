# Prompt reutilizável — continuar o BusinessBrain com contexto atualizado

Trabalha no repositório GitHub `ByGONCA/BusinessBrain`. O objetivo concreto desta tarefa é: [descreve aqui o objetivo numa frase].

## Obrigatório antes de editar
- Lê `AGENTS.md` e `docs/AI_CONTEXT.md`.
- Verifica branch, working tree/diff, ficheiros relevantes, callers, migrações e testes. Preserva alterações preexistentes.
- Confirma a realidade no código atual; não assumas que relatórios, roadmaps ou conversas antigas ainda são verdadeiros.
- Consulta apenas as secções relevantes de `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/quality.md` e outros documentos canónicos conforme necessário.
- Se encontrares contradições, identifica-as; não inventes uma resolução sem evidência.

## Execução
1. Define critérios de aceitação objetivos.
2. Escolhe a alteração mínima que resolva completamente o pedido, reutilizando padrões existentes.
3. Considera erros, concorrência, idempotência, permissões, isolamento multi-tenant, estados vazios, falhas de rede e compatibilidade quando forem relevantes.
4. Implementa e acrescenta/atualiza testes direcionados.
5. Executa verificações aplicáveis: `npm run typecheck`, `npm run lint`, `npm test` e, quando apropriado, `npm run build`. Regista os resultados reais; não simules sucesso.
6. Revê o diff para detetar alterações não relacionadas, segredos, regressões de autorização, traduções em falta e documentação desatualizada.
7. Atualiza a documentação canónica se a implementação ou o estado tiver mudado.

## Limites de segurança
- Não executar migrações nem alterações remotas em Supabase/Stripe/hosting, pagamentos reais, deploy, commit ou push sem autorização explícita.
- Não confiar em valores sensíveis fornecidos pelo cliente; manter RLS e verificações server-side.
- Não iniciar outra fase nem implementar funcionalidades de IA real, embeddings, vector DB ou RAG sem autorização explícita.
- Não adicionar dependências ou refatorar áreas não relacionadas sem necessidade demonstrável.
- Não sobrescrever nem descartar alterações existentes.

## Perguntas
Não peças ao utilizador para repetir contexto que esteja no repositório. Investiga primeiro. Só pergunta se faltar uma decisão essencial ou houver risco de executar uma ação irreversível. Nesse caso, faz um único bloco conciso de perguntas com a recomendação e as consequências de cada opção. Caso contrário, decide com base nas convenções existentes e prossegue.

## Entrega
No fim, informa:
- o que foi alterado e em que ficheiros;
- critérios de aceitação cumpridos/não cumpridos;
- comandos executados e resultados observados;
- o que não foi possível verificar e porquê;
- riscos/decisões pendentes;
- se houve ou não alterações remotas, commit, push ou deploy.

Não afirmes que algo funciona sem evidência. Mantém a resposta concisa e técnica.