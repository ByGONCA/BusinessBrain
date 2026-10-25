# Regras Permanentes de Ferramental, MCPs e Ambiente Multi-PC

> **Autoridade**: Regra permanente e canónica para todos os agentes, sessões e computadores que operem no repositório BusinessBrain.
> **Política de Referência**: [`docs/ENVIRONMENT_POLICY.md`](../../docs/ENVIRONMENT_POLICY.md) | Protocolo de Investigação: [`.agents/rules/investigation-protocol.md`](./investigation-protocol.md)

---

## 1. MCPs, Plugins e Ferramental Global

1. **Autorização Explícita Obrigatória**:
   - É estritamente proibido instalar, remover, ativar, desativar ou reconfigurar MCPs, plugins ou skills globais sem autorização prévia e explícita do utilizador.
   - Não alterar ficheiros de configuração global do Antigravity ou Gemini CLI (`~/.gemini/config/config.json`, `~/.gemini/config/mcp_config.json`, `~/.gemini/antigravity-cli/settings.json`) sem instrução expressa e consentimento.
2. **MCPs Proibidos (Sem Reintrodução Não Autorizada)**:
   - ❌ **`21st`** — Proibido sem autorização explícita.
   - ❌ **`you-com`** — Proibido sem autorização explícita.
3. **Plugins Proibidos (Sem Reativação Não Autorizada)**:
   - ❌ **`firebase`** — Proibido sem autorização explícita (deve permanecer desativado: `"enabled": false`).
   - ❌ **`android-cli-plugin`** — Proibido sem autorização explícita (deve permanecer desativado: `"enabled": false`).
   - ❌ **`google_maps_platform`** — Proibido sem autorização explícita (deve permanecer desativado: `"enabled": false`).
4. **MCPs Aprovados de Referência**:
   - ✅ **`supabase`** — Suporte ao motor de base de dados e RLS.
   - ✅ **`stripe`** — Gestão e inspeção de faturação e produtos Stripe.
   - ✅ **`shadcn`** — Componentes de UI e acessibilidade Radix/Tailwind.
   - ✅ **`chrome-devtools`** — Validação, automação de testes e inspeção de browser.
5. **Plugins Aprovados Ativos (Quando Instalados e Suportados)**:
   - ✅ **`chrome-devtools-plugin`** — Automação de browser, consola e acessibilidade.
   - ✅ **`gemini-api`** — Ferramentas oficiais e pesquisa de documentação da Gemini API.
   - ✅ **`google-antigravity-sdk`** — Definições de arquitetura de agentes Antigravity.
6. **Respeito pela Configuração Efetiva de Cada PC**:
   - Utilizar exclusivamente os MCPs aprovados que estejam efetivamente disponíveis e configurados no computador em execução.
   - **Distinção Git vs. Configuração Global**: O comando `git pull` sincroniza apenas o repositório do projeto. As configurações globais de cada PC só são aplicadas mediante execução local do script (`npm run env:apply`).
   - **Distinção de Estados de Plugins**: Distinguir rigorosamente entre plugin instalado e ativo, instalado e desativado, não instalado, ou estado indeterminado.
   - **Nunca assumir que uma ferramenta está disponível** só porque existe uma regra ou documentação no repositório. Verificar a disponibilidade operacional antes de invocar.
   - **Não instalar ferramentas ou plugins alternativos** quando as ferramentas já existentes e suportadas no repositório forem suficientes para a tarefa.

---

## 2. Segurança, Segredos e Isolamento de Projetos

1. **Zero Fuga de Credenciais e Segredos**:
   - Nunca expor, imprimir ou revelar credenciais, tokens de autenticação, chaves de API secretas ou connection strings em relatórios, logs, conversas ou código versionado.
   - Nunca commitar ficheiros `.env`, `.env.local` ou credenciais de produção no Git.
2. **Mecanismos Seguros de Variáveis de Ambiente**:
   - Privilegiar sempre mecanismos seguros de variáveis de ambiente do sistema e do runtime quando oficialmente suportados.
   - Não copiar nem transferir chaves privadas ou segredos entre diferentes computadores via ficheiros de repositório.
3. **Não Modificação de Outros Projetos**:
   - É expressamente proibido aceder, alterar ou interferir com configurações, ficheiros ou workspaces de outros projetos registados no sistema (ex.: pastas referenciadas em `trustedWorkspaces`).
4. **Preservação de Invariantes de Segurança do BusinessBrain**:
   - Manter rigorosamente o isolamento multi-tenant (`organization_id uuid not null`), políticas RLS, verificação de subscrição (`verifyAccessOrRedirect`) e resolução de preços Stripe exclusivamente pelo servidor (`lib/stripe/config.ts`).

---

## 3. Qualidade do Trabalho e Rigor Intelectual

1. **Objetividade, Rigor e Transparência**:
   - Ser sempre objetivo, rigoroso e transparente sobre incertezas ou limitações técnicas encontradas.
   - **Distinguir com clareza**:
     - **Factos verificados** (ex.: ficheiros inspecionados, comandos executados com sucesso comprovado em log).
     - **Inferências** (ex.: deduções lógicas baseadas na arquitetura existente).
     - **Estimativas** (ex.: avaliações de impacto ou tempos de execução projetados).
2. **Evidência Obrigatória (Sem Falsificação)**:
   - Nunca declarar ou sugerir que testes, modificações ou medições foram executados se não tiverem sido efetivamente corridos e comprovados.
3. **Sem Análises Repetitivas ou Redundantes**:
   - Não repetir análises, auditorias ou diagnósticos já concluídos e documentados sem uma razão concreta e demonstrável.
4. **Conclusão sem Ciclos Infinitos de Otimização**:
   - Quando os critérios de conclusão de uma tarefa estiverem comprovadamente satisfeitos, a tarefa deve ser dada por terminada.
   - Não iniciar novos ciclos especulativos de refatoração, re-auditoria ou micro-otimização sem pedido explícito do utilizador.
