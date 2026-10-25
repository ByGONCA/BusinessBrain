# Canonical Investigation, Anti-Redundancy & Token Efficiency Protocol

> **Authority**: Mandatory operating procedure for all coding, debugging, refactoring, and auditing tasks.
> **Reference Map**: [`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md)

---

## 1. The Core 6-Step Protocol

Antes de iniciar qualquer pesquisa exploratória ampla no repositório, segue este procedimento estruturado:

### Passo A — Consultar (Consult)
- Lê as instruções da tarefa e consulta o mapa Markdown ([`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md)) quando precisares de localizar ficheiros desconhecidos ou compreender a arquitetura do domínio.
- Identifica a funcionalidade, o fluxo ou o componente que corresponde ao pedido.

### Passo B — Localizar (Locate)
- Usa os caminhos documentados no mapa para abrir diretamente os ficheiros relevantes.
- **Não executes pesquisas globais por hábito** quando a documentação ou o pedido já indicam onde está a implementação.

### Passo C — Confirmar (Confirm)
- Verifica se os caminhos, funções, imports e comportamentos continuam a corresponder ao código real.
- Corrige discrepâncias no mapa se encontrares desvios antes de depender deles.

### Passo D — Expandir Apenas Quando Necessário (Expand Only When Needed)
- Se os ficheiros identificados não forem suficientes, pesquisa especificamente os elementos em falta.
- Usa pesquisas cirúrgicas direcionadas (`git grep "ExactSymbol"` ou caminhos restritos ao módulo).
- Evita varrimentos globais repetidos e a leitura de módulos sem relação demonstrada com a tarefa.

### Passo E — Investigar as Dependências (Investigate Dependencies)
- Antes de modificar código crítico, mapeia o fluxo entre frontend (`components/`, `app/`), backend (`lib/[domain]/actions.ts`), serviços, base de dados (`database/migrations/`) e integrações externas.
- Não assumes que um componente funciona isoladamente só porque o seu ficheiro parece simples.

### Passo F — Atualizar o Conhecimento (Update Knowledge)
- Se descobrires uma alteração arquitetural relevante que ainda não está documentada, atualiza o mapa (`docs/CODEBASE_MAP.md`).
- Não atualizes o mapa por alterações triviais que não modificam a compreensão do projeto.

---

## 2. Protocolo Canónico de Eficiência de Tokens

Para garantir máxima produtividade e evitar desperdício de contexto e voltas desnecessárias de modelo, segue rigorosamente os 10 princípios:

1. **Instruções Essenciais Primeiro**: Lê primeiro as instruções essenciais e consulta apenas a documentação relevante para a tarefa atual.
2. **Navegação Direta e Mapas**: Utiliza a pesquisa direta de ficheiros e os mapas existentes (`docs/CODEBASE_MAP.md`) antes de recorrer a pesquisas extensas.
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
   - Se o utilizador já indicar o ficheiro, símbolo ou função exata (ex.: `lib/stripe/actions.ts`), navega e inspeciona diretamente esse ficheiro sem re-ler o mapa.
2. **Sem Re-leituras Cerimoniais do Mapa**:
   - Se `docs/CODEBASE_MAP.md` já foi consultado na tarefa atual e o contexto permanece válido, **NÃO o voltes a carregar na íntegra** apenas para cumprir formalmente o protocolo.
3. **Sem Re-leitura Imediata Pós-Edição**:
   - Se uma operação `edit_file` devolveu confirmação clara da substituição bem-sucedida, **NÃO re-leias imediatamente o ficheiro completo**. Confia no retorno da ferramenta a menos que haja ambiguidade sintática ou falha.
4. **Critério para Nova Leitura de Ficheiros**:
   - Re-inspeciona um ficheiro apenas quando a operação anterior falhar, o resultado for ambíguo, houver suspeita de alterações concorrentes ou for indispensável verificar importações contextuais.
5. **Qualidade e Conclusão sem Ciclos Infinitos**:
   - Quando os critérios de conclusão de uma tarefa estiverem satisfeitos, reporta o resultado e conclui. Não inicies novos ciclos de otimização ou auditorias especulativas sem pedido explícito.
