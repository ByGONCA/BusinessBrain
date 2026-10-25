# Mandatory Investigation Protocol & Codebase Map Consultation

> **Authority**: Mandatory operating procedure for all coding, debugging, refactoring, and auditing tasks.
> **Reference Map**: [`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md)

---

## The Rule

**Antes de iniciar uma pesquisa exploratória no repositório, consulta primeiro as instruções aplicáveis e o mapa da base de código (`docs/CODEBASE_MAP.md`).**

Execute este procedimento estruturado em cada tarefa de programação:

### Passo A — Consultar (Consult)
- Lê as instruções aplicáveis e consulta o mapa Markdown (`docs/CODEBASE_MAP.md`).
- Identifica a funcionalidade, o fluxo ou o componente que corresponde ao pedido.

### Passo B — Localizar (Locate)
- Usa os caminhos documentados no mapa para abrir diretamente os ficheiros relevantes.
- Consulta os pontos de entrada, as implementações e as dependências necessárias.
- **Não executes pesquisas globais por hábito** quando a documentação já indica onde está a implementação.

### Passo C — Confirmar (Confirm)
- Verifica se os caminhos, funções, imports e comportamentos documentados continuam a corresponder ao código real.
- Se o mapa estiver desatualizado ou incompleto, corrige a informação necessária antes de depender dela.

### Passo D — Expandir Apenas Quando Necessário (Expand Only When Needed)
- Se os ficheiros identificados não forem suficientes para compreender o problema, pesquisa especificamente os elementos em falta.
- Usa pesquisas direcionadas por nomes de funções, símbolos, imports, referências, rotas ou chamadas relevantes (`git grep "ExactSymbol"` ou caminhos restritos).
- Evita pesquisas globais repetidas e a leitura de módulos sem relação demonstrada com a tarefa.

### Passo E — Investigar as Dependências (Investigate Dependencies)
- Antes de modificar código, identifica as dependências que podem ser afetadas.
- Quando necessário, segue o fluxo completo entre frontend (`components/`, `app/`), backend (`lib/[domain]/actions.ts`), serviços, base de dados (`database/migrations/`) e integrações externas.
- Não assumes que um componente funciona isoladamente só porque o seu ficheiro parece simples.

### Passo F — Atualizar o Conhecimento (Update Knowledge)
- Se descobrires uma alteração arquitetural relevante que ainda não está documentada, atualiza o mapa (`docs/CODEBASE_MAP.md`) quando apropriado.
- Não atualizes o mapa por alterações triviais que não modificam a compreensão do projeto.

---

## Pragmatic Shortcuts & Efficiency Rules

1. **Explicit Target Provided**: If the user request already specifies the exact file path, symbol, or function (e.g. `lib/stripe/actions.ts`), open and inspect that file directly without re-reading the map first.
2. **Meta & Documentation Tasks**: If the task explicitly involves auditing or editing documentation, agent rules, or the codebase map itself, proceed directly to those files.
3. **No Bureaucratic Delay**: These steps eliminate redundant, expensive global searches; they must never impose artificial overhead when the target is already known with certainty.
