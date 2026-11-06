# Canonical Investigation, Anti-Redundancy & Token Efficiency Protocol (Graphify + Ponytail)

> **Authority**: Mandatory operating procedure for all coding, debugging, refactoring, and auditing tasks.
> **Reference Map**: [`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md) | Graphify: [`graphify-out/`](../../graphify-out/) | Ponytail: [`.agents/rules/ponytail.md`](./ponytail.md)

---

## 1. The Core 6-Step Protocol

Antes de iniciar qualquer pesquisa exploratória ampla no repositório, segue este procedimento estruturado:

### Passo A — Consultar (Consult: Graphify & Map)
- Lê as instruções da tarefa. Para localizar símbolos desconhecidos, dependências ou arquitetura de domínio, consulta primeiro o grafo Graphify (`graphify query "<termo>"` ou MCP `query_graph`) e o mapa Markdown ([`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md)).
- Identifica a funcionalidade, o fluxo ou o componente que corresponde ao pedido sem leituras em massa de ficheiros.

### Passo B — Localizar (Locate)
- Usa os nós devolvidos pelo Graphify ou caminhos documentados no mapa para abrir diretamente os ficheiros relevantes.
- **Não executes pesquisas globais por hábito** quando a documentação, o Graphify ou o pedido já indicam onde está a implementação.

### Passo C — Confirmar (Confirm)
- Verifica se os caminhos, funções, imports e comportamentos continuam a corresponder ao código real.
- Corrige discrepâncias no mapa se encontrares desvios antes de depender deles.

### Passo D — Expandir Apenas Quando Necessário (Expand Only When Needed)
- Se os ficheiros identificados não forem suficientes, usa consultas direcionadas de Graphify (`graphify explain "<Node>"` ou `graphify path "<A>" "<B>"`) ou pesquisas cirúrgicas (`git grep "ExactSymbol"` no módulo restrito).
- Evita varrimentos globais repetidos e a leitura de módulos sem relação demonstrada com a tarefa.

### Passo E — Investigar Dependências & Aplicar Ponytail (Dependencies & Ponytail Ladder)
- Antes de modificar código crítico, mapeia o fluxo e callers usando o grafo do Graphify (`graphify query` / MCP `get_neighbors`).
- Aplica a **escada de simplicidade Ponytail**:
  1. *YAGNI*: Precisa mesmo de existir?
  2. *Reutilização*: Já existe um utilitário/tipo similar em `lib/` ou `components/`?
  3. *Stdlib / Plataforma*: TypeScript/JS/Node stdlib ou HTML/CSS/PostgreSQL constraint resolvem?
  4. *Dependências existentes*: Dependência já instalada resolve?
  5. *Diff mínimo*: Linha única ou menor diff seguro com teste direcionado.

### Passo F — Atualizar o Conhecimento & Grafo (Update Knowledge & Graph)
- Se descobrires uma alteração arquitetural relevante, atualiza o mapa (`docs/CODEBASE_MAP.md`) e `docs/AI_CONTEXT.md`.
- Após modificar código na sessão, executa `graphify update .` (AST-only, sem custo de LLM) para manter o grafo sincronizado.

---

## 2. Protocolo Canónico de Eficiência de Tokens

Para garantir máxima produtividade e evitar desperdício de contexto e voltas desnecessárias de modelo, segue rigorosamente os 10 princípios:

1. **Instruções Essenciais Primeiro**: Lê primeiro as instruções essenciais e consulta apenas a documentação relevante para a tarefa atual.
2. **Navegação Direta e Grafo/Mapas**: Utiliza o Graphify e mapas existentes (`docs/CODEBASE_MAP.md`) antes de recorrer a pesquisas extensas.
3. **Leituras Cirúrgicas por Intervalo de Linhas**: Evita reler documentos completos quando bastam secções específicas (usa `StartLine` e `EndLine` para ficheiros > 100 linhas).
4. **Carregamento Oportuno de Skills**: Carrega skills apenas quando forem estritamente relevantes para a tarefa solicitada.
5. **Uso Justificado de MCPs**: Utiliza MCPs apenas quando acrescentarem valor concreto e indispensável.
6. **Eliminação de Chamadas Redundantes**: Evita chamadas redundantes a ferramentas que forneçam a mesma capacidade.
7. **Brevidade em Tarefas Simples**: Não geres relatórios extensos para tarefas simples.
8. **Não Duplicação de Contexto**: Não repitas no contexto informação que já esteja claramente documentada ou inspecionada.
9. **Agrupamento de Operações Relacionadas**: Agrupa operações relacionadas quando isso reduzir chamadas e turnos desnecessários de API.
10. **Profundidade Proporcional ao Risco**: Faz análises aprofundadas quando o risco ou a complexidade o justificarem, sem confundir brevidade com qualidade.

> [!IMPORTANT]
> A otimização e a brevidade **nunca** devem remover verificações de segurança, testes necessários ou contexto indispensável à correção.

---

## 3. Anti-Redundancy & Fast-Path Rules (Strict)

1. **Alvo Exato Conhecido (Direct Navigation)**:
   - Se o utilizador já indicar o ficheiro, símbolo ou função exata (ex.: `lib/stripe/actions.ts`), navega e inspeciona diretamente esse ficheiro sem re-ler o mapa ou o grafo.
2. **Sem Re-leituras Cerimoniais do Mapa ou Grafo**:
   - Se `docs/CODEBASE_MAP.md` ou `graphify-out/` já foi consultado na tarefa atual e o contexto permanece válido, **NÃO o voltes a carregar na íntegra** apenas para cumprir formalmente o protocolo.
3. **Sem Re-leitura Imediata Pós-Edição**:
   - Se uma operação `edit_file` devolveu confirmação clara da substituição bem-sucedida, **NÃO re-leias imediatamente o ficheiro completo**. Confia no retorno da ferramenta a menos que haja ambiguidade sintática ou falha.
4. **Critério para Nova Leitura de Ficheiros**:
   - Re-inspeciona um ficheiro apenas quando a operação anterior falhar, o resultado for ambíguo, houver suspeita de alterações concorrentes ou for indispensável verificar importações contextuais.
5. **Qualidade e Conclusão sem Ciclos Infinitos**:
   - Quando os critérios de conclusão de uma tarefa estiverem satisfeitos, reporta o resultado e conclui. Não inicies novos ciclos de otimização ou auditorias especulativas sem pedido explícito.
