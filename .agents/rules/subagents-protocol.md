# Protocolo Canónico de Subagentes: BusinessBrain

> **Autoridade**: Regra normativa do projeto para governação, ciclo de vida e delegação a subagentes no Google Antigravity.  
> **Documentos Relacionados**: [`AGENTS.md`](../../AGENTS.md) | [`.agents/rules/investigation-protocol.md`](./investigation-protocol.md) | [`.agents/rules/tooling-and-environment.md`](./tooling-and-environment.md) | [`docs/ENVIRONMENT_POLICY.md`](../../docs/ENVIRONMENT_POLICY.md)

---

## 1. Princípios de Arquitetura e Filosofia Minimalista

O BusinessBrain adota uma **arquitetura de agente principal com subagentes especializados sob demanda (Lead-Agent with On-Demand Specialists)**.

1. **Agente Principal como Autoridade Única**: O agente principal (Lead Agent) detém o contexto integral da conversa com o utilizador, a responsabilidade técnica e o controlo das alterações. Subagentes são ferramentas auxiliares de apoio pontual, nunca substitutos da autoridade do agente principal.
2. **Zero Delegação por Rotina**: Nunca delegar por hábito ou conveniência superficial. A delegação a subagentes introduz sobrecarga de tokens, latência de coordenação e potenciais divergências de contexto. Se uma tarefa pode ser resolvida pelo agente principal em 1 a 3 passos diretos, a delegação é expressamente proibida.
3. **Privilégio Mínimo e Imutabilidade por Padrão**: Subagentes de análise e auditoria operam sob o princípio do menor privilégio com todas as permissões de mutação e MCP desligadas (`EnableWriteTools: false`, `EnableSubagentTools: false`, `EnableMCPTools: false`). Subagentes de escrita são estritamente opcionais para criação extensiva de testes e exigem isolamento de working tree (`Workspace: 'share'`).
4. **Distinção entre Documentação e Runtime**: A existência de ficheiros Markdown descrevendo perfis de agentes **não cria automaticamente processos persistentes em background** no Antigravity CLI. No Antigravity, subagentes personalizados são registados em runtime de sessão através da ferramenta canónica `define_subagent` e existem apenas durante a sessão de conversa ativa.
5. **Transparência de Limitações Técnicas**: Regras instrucionais em prompts não devem ser apresentadas como garantias técnicas de segurança de sistema operativo ou sandbox de caminhos.

---

## 2. Perfis e Responsabilidades dos Agentes

### A. Agente Principal (Lead Agent)
- **Papel**: Engenheiro de software sénior responsável pelo planeamento, escrita de código de produção, refatorações, execução de testes determinísticos e integração final.
- **Responsabilidades Exclusivas**:
  - Implementação de código na aplicação (`app/`, `components/`, `lib/`).
  - Edição de esquemas, migrações SQL, autenticação e fluxos de faturação Stripe.
  - Execução dos comandos canónicos do projeto (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`).
  - Execução de testes ou diagnósticos operacionais que necessitem de credenciais ou comunicação com serviços externos.
  - Decisões arquiteturais fundamentadas e comunicação direta com o utilizador.
- **Regra de Ouro**: O agente principal resolve diretamente todas as tarefas cosméticas, correções de bugs localizados e alterações em ficheiros cuja localização já é conhecida.

---

### B. Subagente Nativo de Investigação (`research`)
- **Tipo**: Subagente pré-configurado nativo do Antigravity.
- **Permissões**: Estritamente de leitura (`read-only`). Acesso a ferramentas de inspeção de ficheiros locais e pesquisa na web. **Sem ferramentas de modificação de ficheiros e sem rede externa descontrolada**.
- **Quando Utilizar**:
  - Investigação de bibliotecas externas ou APIs com documentação extensa.
  - Levantamento exploratório abrangente que exija ler dezenas de ficheiros e que, se executado na sessão principal, saturaria a janela de contexto (>25k–30k tokens).
  - Análise de árvores de dependência ou rastreamento de fluxos cruzados não documentados.
- **Contrato de Retorno**:
  - O subagente `research` nunca edita ficheiros.
  - Devolve um resumo conciso com:
    1. Ficheiros e símbolos relevantes identificados (com caminhos exatos e intervalos de linhas).
    2. Riscos arquiteturais ou dependências ocultas detetadas.
    3. Recomendações acionáveis para o agente principal implementar.

---

### C. Subagente Especializado: `security-auditor` (Security Reviewer)
- **Tipo**: Subagente personalizado registado sob demanda via `define_subagent`.
- **Permissões (Menor Privilégio)**:
  - `EnableWriteTools: false` (Estritamente de leitura; sem `write_file`, `edit_file` ou `run_command`).
  - `EnableSubagentTools: false` (Incapaz de invocar outros subagentes).
  - `EnableMCPTools: false` (Desligado para eliminar qualquer risco de exposição a ferramentas de mutação externa como `stripe_api_write`).
- **Modelo Recomendado**: `flash` (para análises rápidas e económicas) ou `inherit` (para auditorias de segurança críticas antes de merges sensíveis).
- **Âmbito de Auditoria (Análise Estática Pura)**:
  - **Multi-Tenancy & RLS**: Verificação estática de que todas as tabelas possuem `organization_id` e políticas RLS de isolamento estrito (evitar `using (true)` ou `auth.role() = 'authenticated'` em tabelas de tenant).
  - **Segredos & Exposição**: Garantia de que `STRIPE_SECRET_KEY`, `RESEND_API_KEY` ou credenciais de serviço nunca vazam para o cliente nem usam o prefixo `NEXT_PUBLIC_`.
  - **Faturação & Idempotência**: Verificação estática de que webhooks da Stripe utilizam verificação criptográfica (`stripe.webhooks.constructEvent`), isolamento estrito de Price IDs e proteção contra clientes duplicados.
  - **Validação de Inputs & SSR**: Deteção de vulnerabilidades OWASP Top 10 (injeção SQL, IDOR, SSRF, XSS).
- **Inspeções Dinâmicas / Operacionais**:
  - O `security-auditor` **não dispõe** de acesso ao Supabase Cloud nem à Stripe via MCPs.
  - Caso seja necessária uma inspeção diagnóstica dinâmica que exija ferramentas externas ou consultas operacionais, o **Agente Principal** deve realizá-la separadamente, com as permissões e a autorização adequadas.
- **Contrato de Retorno**:
  - Distingue estritamente **Vulnerabilidades Confirmadas** (com prova de código e linha exata) de **Suspeitas / Falsos Positivos**.
  - Classifica achados por gravidade (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).
  - Fornece passos claros de remediação para o agente principal aplicar.

---

### D. Subagente Especializado: `test-engineer` (Test Expansion Specialist)
- **Tipo**: Subagente personalizado opcional, registado sob demanda via `define_subagent` apenas para tarefas de teste suficientemente extensas.
- **Permissões**:
  - `EnableWriteTools: true` (Permissão de escrita; concede `write_file`, `edit_file` e `run_command`).
  - `EnableSubagentTools: false`.
  - `EnableMCPTools: false`.
- **Isolamento Obrigatório de Workspace**:
  - Deve ser **obrigatoriamente** invocado com **`Workspace: 'share'`** em todas as invocações.
  - **Nunca omitir o parâmetro `Workspace`** (o padrão do Antigravity é `inherit`) e **nunca utilizar `inherit`**.
- **Aviso de Limitações Técnicas de Isolamento**:
  - O modo `'share'` isola a árvore de trabalho criando uma working tree separada no Git, prevenindo que alterações concorrentes afetem diretamente a working tree ativa do agente principal.
  - **Não constitui uma sandbox de segurança completa**: O Antigravity não possui restrição técnica de caminhos (`allowedPaths`). As ferramentas de escrita têm capacidade técnica de aceder a qualquer caminho acessível ao utilizador do sistema operativo. A limitação a `scripts/` e `tests/` é puramente **instrucional/comportamental** (via `SystemPrompt`).
- **Proteção de Credenciais e Execução de Comandos**:
  - A ferramenta `run_command` executa processos diretamente no host do Windows com as credenciais do utilizador da máquina, podendo expor variáveis de ambiente e ficheiros locais (`.env.local`).
  - É expressamente proibido ao subagente ler, imprimir, transmitir ou modificar segredos e variáveis de ambiente confidenciais.
  - Os testes devem operar estritamente com **dados fictícios (mocks / fixtures / in-memory)** e não podem contactar serviços externos, modificar recursos remotos nem executar comandos destrutivos sem autorização explícita do utilizador.
  - Testes que exijam credenciais reais ou chamadas operacionais a serviços externos devem ser executados exclusivamente pelo **Agente Principal**.
- **Quando Utilizar**:
  - Criação de suites de teste extensivas (testes de integração, testes de concorrência OCC, cenários de stress) para uma grande fatia funcional recém-implementada.
  - Quando a escrita de dezenas de testes detalhados bloquearia o agente principal de concluir tarefas prioritárias.
- **Restrições Estritas**:
  - **Nunca** alterar código de produção (`app/`, `components/`, `lib/`).
  - **Nunca** executar comandos destrutivos ou migrações remotas.
  - O agente principal deve rever as suites de teste geradas, executar `npm run typecheck && npm test` na branch principal e validar a integração.

---

## 3. Matriz de Decisão: Quando Delegar vs. Quando Trabalhar Sozinho

| Cenário de Desenvolvimento | Ação Recomendada | Justificação Técnica |
| :--- | :--- | :--- |
| **Correção de bug de UI, tipografia, animações ou CSS** | **Agente Principal sozinho** | Tarefa localizada. Delegar gastaria mais tokens no prompt de transferência do que na própria correção. |
| **Ajuste num endpoint ou Server Action existente** | **Agente Principal sozinho** | O contexto local é suficiente. Testar diretamente com `npm run typecheck`. |
| **Dúvida sobre a localização de um símbolo ou ficheiro conhecido** | **Agente Principal sozinho** | Consultar diretamente [`docs/CODEBASE_MAP.md`](../../docs/CODEBASE_MAP.md) sem invocar subagente. |
| **Exploração de arquitetura não familiar (>10 ficheiros)** | **Delegar a `research`** | Preserva a janela de contexto principal limpa e consome zero risco de escrita. |
| **Alteração em RLS, Auth Middleware ou Webhook Stripe** | **Delegar auditoria a `security-auditor`** | Modelo "four-eyes": análise estática de segurança independente por modelo especializado. |
| **Criação de 3+ novas suites de teste para novo módulo** | **Delegar a `test-engineer` (`Workspace: 'share'`)** | Permite desenvolver testes em paralelo em worktree isolado sem sujar a working tree principal. |

---

## 4. Regras Operacionais e Prevenção de Riscos

1. **Obrigatoriedade de `Workspace: 'share'` para Escrita**:
   - Nunca disparar subagentes com permissões de escrita (`EnableWriteTools: true`) em `Workspace: 'inherit'`. A omissão do parâmetro assume `inherit` e gera risco de colisões de ficheiros (`EBUSY`/`EPERM`) no Windows e poluição da árvore de trabalho. O parâmetro `Workspace: 'share'` é obrigatório.
2. **Reconhecimento das Limitações da Sandbox**:
   - Não apresentar regras comportamentais de prompt como garantias técnicas invioláveis. O Antigravity não possui restrição técnica de pastas; a integridade depende de revisão do diff pelo Agente Principal antes do merge.
3. **Economia de Tokens e Seleção de Modelos**:
   - Para auditorias estruturais e tarefas de leitura, preferir explicitamente o modelo `flash` na invocação via `invoke_subagent`.
   - Reservar `inherit` ou `pro` apenas para auditorias profundas de segurança crítica ou lógica de concorrência com múltiplos estados.
4. **Validação Obrigatória pelo Agente Principal**:
   - O agente principal **nunca aceita como facto inquestionável** o relatório de um subagente. Deve sempre inspecionar o código apontado e validar com os comandos reais do projeto (`npm run typecheck && npm run lint`).
5. **Proteção Rigorosa de Credenciais**:
   - Subagentes nunca devem receber chaves de API cruas (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) em argumentos de prompt.
   - Subagentes com `run_command` estão proibidos de inspecionar ou imprimir ficheiros `.env` ou variáveis de ambiente.

---

## 5. Instruções Canónicas para Registo em Sessão (Runtime)

No Google Antigravity, para ativar os subagentes especializados quando uma tarefa de alto risco o exigir, o agente principal utiliza as seguintes definições canónicas:

### 5.1 Registo do `security-auditor`
```json
{
  "tool": "define_subagent",
  "parameters": {
    "Name": "security-auditor",
    "Description": "Auditor especializado em análise estática de segurança, isolamento multi-tenant RLS, fluxos de faturação Stripe e proteção contra vulnerabilidades OWASP no BusinessBrain. Operação estritamente só de leitura, sem ferramentas de escrita nem acesso a MCPs externos.",
    "EnableWriteTools": false,
    "EnableSubagentTools": false,
    "EnableMCPTools": false,
    "SystemPrompt": "És o Security Auditor sénior do BusinessBrain. A tua missão é realizar análise estática rigorosa de código, configurações e migrações SQL com foco implacável em segurança: multi-tenancy estrito (RLS obrigatório e organization_id em todas as tabelas de tenant), isolamento de Price IDs na Stripe, verificação criptográfica de webhooks com STRIPE_WEBHOOK_SECRET, ausência de fugas de segredos para o cliente (nenhuma chave de API de servidor prefixada com NEXT_PUBLIC_) e sanitização de dados. Nunca sugeres desativar RLS ou ignorar verificações. Operas em modo estritamente só de leitura, sem ferramentas de escrita local nem acesso a MCPs externos. Devolves achados classificados por gravidade (CRITICAL, HIGH, MEDIUM, LOW, INFO) acompanhados de provas concretas de código e recomendações de remediação."
  }
}
```

### 5.2 Invocação do `security-auditor`
```json
{
  "tool": "invoke_subagent",
  "parameters": {
    "TypeName": "security-auditor",
    "Role": "Security Differential Auditor",
    "Model": "flash",
    "Workspace": "inherit",
    "Prompt": "Audita as alterações recentes em [ficheiros/diff]. Verifica estaticamente o isolamento de tenant RLS, validação de permissões e segurança de webhooks. Reporta vulnerabilidades com evidências concretas de código."
  }
}
```
*(Nota: O uso de `Workspace: "inherit"` é seguro para o `security-auditor` pois este possui `EnableWriteTools: false`, não tendo capacidade técnica de modificar ficheiros no workspace partilhado).*

### 5.3 Registo do `test-engineer` (Opcional / Grandes Slices)
```json
{
  "tool": "define_subagent",
  "parameters": {
    "Name": "test-engineer",
    "Description": "Engenheiro especializado em desenhar e implementar testes de integração, concorrência e regressão determinísticos para o BusinessBrain em worktree isolado.",
    "EnableWriteTools": true,
    "EnableSubagentTools": false,
    "EnableMCPTools": false,
    "SystemPrompt": "És o Test Engineer do BusinessBrain. A tua função é escrever testes automatizados robustos, determinísticos e à prova de regressão na pasta scripts/ ou tests/. Nunca alteras código de produção em app/, components/ ou lib/. Segues os padrões existentes em scripts/test-runner.ts, tratando casos extremos, concorrência e idempotência. Todos os testes devem utilizar dados fictícios (mocks) e nunca contactar serviços externos nem aceder a segredos do sistema (.env)."
  }
}
```

### 5.4 Invocação do `test-engineer` (Isolamento Obrigatório em Worktree)
```json
{
  "tool": "invoke_subagent",
  "parameters": {
    "TypeName": "test-engineer",
    "Role": "Integration Test Specialist",
    "Model": "flash",
    "Workspace": "share",
    "Prompt": "Desenvolve uma suite de testes determinística em scripts/ para validar a funcionalidade [X], utilizando mocks para isolar de serviços externos e cobrindo fluxos de sucesso, casos extremos de autorização e concorrência."
  }
}
```
*(Atenção: O parâmetro `Workspace: "share"` é obrigatório. Nunca omitir nem usar `"inherit"`).*
