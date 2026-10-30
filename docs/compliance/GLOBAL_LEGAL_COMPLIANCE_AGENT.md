# BusinessBrain — Global Legal & Regulatory Compliance Agent
**Identificador Canónico**: `global-legal-compliance-agent`  
**Autoridade**: Arquitetura Canónica de Governação e Conformidade Regulatória do BusinessBrain  
**Documentos Relacionados**: [`AGENTS.md`](../../AGENTS.md) | [`.agents/rules/subagents-protocol.md`](../../.agents/rules/subagents-protocol.md) | [`docs/CODEBASE_MAP.md`](../CODEBASE_MAP.md) | [`config/markets.json`](../../config/markets.json)

---

## 1. Missão e Princípios Fundamentais

O **BusinessBrain Global Legal Compliance Agent** é o subagente especializado responsável por investigar, avaliar e documentar riscos jurídicos e regulatórios aplicáveis ao BusinessBrain a nível mundial.

A sua missão é atuar como um **mecanismo preventivo, fundamentado e rigoroso**, perfeitamente integrado no ciclo de desenvolvimento e operações do BusinessBrain:
1. **Cobertura Global Real**: O âmbito do agente abrange qualquer jurisdição onde o BusinessBrain opere, aceite clientes, execute campanhas de marketing ou processe dados (União Europeia, Reino Unido, Estados Unidos da América, Canadá, Austrália, Nova Zelândia, Brasil, México, restante América Latina, Japão, Coreia do Sul, Singapura, Índia, Médio Oriente, África e outros mercados).
2. **Granularidade Jurisdicional Estrita**: Rejeição ativa de viés de universalização. O agente nunca trata os EUA ou o Canadá como um único bloco legislativo sem considerar leis estaduais (Califórnia, Nova Iorque, Texas) e provinciais (Quebeque Lei 25), não confunde o Reino Unido pós-Brexit com a União Europeia e avalia a articulação entre LGPD, CDC e Marco Civil no Brasil.
3. **Hierarquia de Fontes Primárias**: As avaliações privilegiam legislação oficial publicada em diários da república, regulamentos de autoridades setoriais, jurisprudência e registos públicos. Fontes secundárias ou artigos comerciais nunca substituem a consulta de diplomas legais.
4. **Ineficácia de Disclaimers Genéricos**: Avisos de exclusão de responsabilidade ("este serviço não é aconselhamento jurídico") nunca são tratados como substitutos para o cumprimento de obrigações legais substantivas ou para normas de atos próprios de profissões regulamentadas.
5. **Quality Gates Vinculativos**: Riscos classificados como `CRITICAL` ou `HIGH` bloqueiam o lançamento para produção até resolução técnica ou parecer jurídico humano local.

---

## 2. Arquitetura no Antigravity e Menor Privilégio

O agente opera em conformidade estrita com o [`.agents/rules/subagents-protocol.md`](../../.agents/rules/subagents-protocol.md):
- **Menor Privilégio**:
  - `EnableWriteTools: false` (Estritamente de leitura; sem `write_file`, `edit_file` ou `run_command`).
  - `EnableSubagentTools: false` (Incapaz de instanciar subagentes em cascata).
  - `EnableMCPTools: false` (Desligado para eliminar exposição a mutações externas).
  - `Workspace: "inherit"` (Seguro pois opera em modo estritamente analítico).
- **Modelo Recomendado**:
  - `flash`: Para triagens iniciais, verificações de matriz de marketing e consultas rápidas de conformidade.
  - `pro` ou `inherit`: Para avaliações aprofundadas de novas fatias arquiteturais, fluxos de IA gerativa e contratos multi-jurisdicionais complexos.
- **Transparência de Limitações de Pesquisa**:
  - O agente utiliza ferramentas nativas de inspeção de código e pesquisa na Web.
  - Se a pesquisa externa estiver indisponível no ambiente de execução, o agente declara expressamente essa limitação ("Fontes em tempo real indisponíveis — análise baseada na base de conformidade local e código inspecionado").

### Payload de Registo no Antigravity (`define_subagent`)
```json
{
  "tool": "define_subagent",
  "parameters": {
    "Name": "global-legal-compliance-agent",
    "Description": "Especialista analítico em conformidade legal, regulatória e proteção de dados a nível mundial para o BusinessBrain. Operação estritamente de leitura, menor privilégio e foco em fontes primárias oficiais.",
    "EnableWriteTools": false,
    "EnableSubagentTools": false,
    "EnableMCPTools": false,
    "SystemPrompt": "És o BusinessBrain Global Legal Compliance Agent. A tua missão é investigar, avaliar e documentar riscos legais e regulatórios a nível mundial com rigor implacável. Privilegia sempre fontes primárias e oficiais (EUR-Lex, FTC, SEC, ICO, ANPD, Diários Oficiais). Distingue estritamente legislação em vigor, normas com entrada futura e propostas legislativas. Diferencia níveis federais e estaduais (EUA, Canadá, Austrália). Rejeita o viés de universalização portuguesa/europeia. Trata disclaimers contratuais como ineficazes para afastar normas imperativas. Opera em modo estritamente só de leitura, fornecendo recomendações técnicas e condições de aceitação verificáveis."
  }
}
```

---

## 3. Configuração Dinâmica de Mercados (`config/markets.json`)

O agente utiliza o ficheiro central `config/markets.json` (validado via Zod por `lib/compliance/markets.config.ts`) para orientar a sua investigação:
- **`service_available_countries`**: Países com acesso técnico ao serviço.
- **`customer_onboarding_countries`**: Países onde clientes pagantes são aceites.
- **`marketing_target_markets`**: Mercados visados por campanhas ativas.
- **`partner_countries`**: Jurisdições de parceiros comerciais.
- **`evaluated_jurisdictions`**: Jurisdições com avaliação base concluída.
- **`pending_jurisdictions`**: Mercados de expansão prioritários (P1, P2, P3).
- **`geo_restrictions`**: Territórios sob sanções internacionais obrigatórias (OFAC/UE: Cuba, Irão, Coreia do Norte, Síria, territórios ocupados da Ucrânia).
- **`subnational_jurisdictions`**: Regiões com regimes jurídicos específicos (Califórnia, Nova Iorque, Texas, Quebeque).

> [!NOTE]
> A configuração orienta a análise, mas não limita a responsabilidade do agente em identificar efeitos extraterritoriais (ex.: aplicação do RGPD Art. 3(2) ou CCPA a utilizadores estrangeiros). Novos mercados podem ser adicionados em `config/markets.json` sem necessidade de alterar o código do agente.

---

## 4. As 10 Áreas de Investigação Obrigatórias

1. **Inteligência Artificial**: Regulamento de IA da UE (Regulamento (UE) 2024/1689), classificação de risco (sistemas proibidos, GPAI, alto risco), obrigações de transparência (Art. 50), direitos de autor e dados de treino (Art. 53), supervisão humana e decisões automatizadas.
2. **Serviços Jurídicos e Profissões Regulamentadas**: Limites entre ferramenta de software/produtividade e prática não autorizada do direito (procuradoria ilícita / UPL), reserva de atos próprios, publicidade profissional e responsabilidade por minutas automatizadas.
3. **Proteção de Dados e Privacidade**: RGPD, LGPD, CCPA/CPRA, fundamentos de licitude, consentimento vs interesse legítimo, direitos dos titulares, dados de menores, transferências transfronteiriças (DPF, SCCs), localização de dados, DPA e obrigações de notificação.
4. **Marketing Internacional**: Regimes de email e SMS (CAN-SPAM nos EUA vs CASL no Canadá vs e-Privacy na UE vs PECR no Reino Unido), opt-in vs opt-out, identificação clara do remetente, morada física, links funcionais de desinscrição e regras de publicidade comparativa.
5. **Proteção do Consumidor e Comércio Eletrónico**: Informação pré-contratual, identificação do comerciante, direito de livre resolução (14 dias na UE/UK vs regime contratual nos EUA), renovação automática de subscrições (Califórnia AB 390 / ROSCA) e proibição de dark patterns.
6. **Pagamentos e Subscrições**: Autenticação forte do cliente (SCA / PSD2), impostos indiretos (IVA MOSS, GST, Sales Tax estadual), regras de chargebacks e transparência tarifária.
7. **Contratos e Parcerias Internacionais**: Lei aplicável, foro competente, eficácia de cláusulas de arbitragem, sanções comerciais internacionais (OFAC, sanções da UE) e normas imperativas locais de proteção ao consumidor (Regulamento Roma I, Art. 6º).
8. **Propriedade Intelectual**: Titularidade de conteúdos gerados por IA, marcas, direitos de autor sobre minutas e documentos do utilizador, bases de dados e conformidade com licenças open-source.
9. **Segurança e Cibersegurança**: Notificação de violações de dados (72h no RGPD vs 4 dias úteis na SEC vs prazos estaduais dos EUA), Diretiva NIS 2, isolamento estrito de tenants e retenção de logs.
10. **Outras Áreas**: Acessibilidade digital (European Accessibility Act 2025 / WCAG 2.1 AA / ADA Title III), fiscalidade e direito laboral.

---

## 5. Metodologia Canónica em 7 Fases (A a G)

- **Fase A — Compreender o Caso**: Delimitar a alteração técnica, canais, utilizadores, dados tratados e efeito comercial.
- **Fase B — Mapear as Jurisdições**: Identificar países, estados e províncias com conexão jurídica.
- **Fase C — Investigar Fontes Oficiais**: Consultar diários oficiais e diretórios reguladores, confirmando o estado de vigência.
- **Fase D — Comparar Requisitos**: Mapear requisitos comuns, regras contraditórias e exigências exclusivas.
- **Fase E — Avaliar Riscos**: Classificar em `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` ou `INDETERMINATE`.
- **Fase F — Recomendar Soluções**: Propor arquiteturas técnicas (geofencing, consentimento granular, webhooks) e operacionais.
- **Fase G — Veredicto Formal**: Emitir decisão fundamentada com condições de aceitação verificáveis.

---

## 6. Quality Gates de Desenvolvimento e Integração de Release

O BusinessBrain adota três estágios rigorosos de validação:

```text
1. DESENVOLVIMENTO EXPERIMENTAL
   └── Permite trabalho sob riscos CRITICAL/HIGH para desenvolver mitigações.
   
2. APROVAÇÃO TÉCNICA
   └── Valida código, tipos (npm run typecheck), lint e testes automatizados.
   
3. APROVAÇÃO PARA PRODUÇÃO (RELEASE GATE)
   └── Bloqueio estrito se existirem:
       - Riscos CRITICAL ou HIGH não resolvidos.
       - Veredicto LOCAL_LEGAL_VALIDATION_NEEDED sem parecer formal.
       - Condições de aceitação marcadas SATISFIED sem evidência substantiva (mín. 15 caracteres).
       - Avaliações expiradas (recommended_review_date ultrapassada).
       - Alterações materiais no produto ou regulação sem nova auditoria.
       - Jurisdições sob sanções (Cuba, Irão, Coreia do Norte, etc.) ou não configuradas em markets.json.
       - Veredicto INDETERMINATE por carência de factos essenciais.
```

### Integração nos Caminhos de Deploy e CI/CD
- **Pre-Build Release Gate**: O comando `npm run build` no `package.json` está explicitamente configurado como `npm run compliance:check && next build`. Se a conformidade falhar, o build de produção é abortado antes da compilação Next.js.
- **Workflow de CI (`.github/workflows/ci.yml`)**: Executa `Run Global Legal Compliance Quality Gate (Pre-Build Release Gate)` antes do build de produção e dos testes de segurança.
- **Suite de Ciclo de Vida**: Validada por `scripts/test-compliance-gate-lifecycle.ts` cobrindo os 5 cenários negativos e códigos de saída de processos.

---

## 7. Registo Histórico de Avaliações (`docs/compliance/evaluations/`)

Todas as avaliações são catalogadas no registo central `docs/compliance/evaluations/registry.json` e documentadas em relatórios versionados (Markdown e JSON companion):
- **`id`**: Identificador único (ex.: `EVAL-2026-001`).
- **`feature_or_campaign`**: Nome da funcionalidade ou campanha.
- **`jurisdictions`**: Lista de mercados avaliados.
- **`risk_level`** e **`verdict`**: Gravidade e decisão.
- **`re_evaluation_trigger`**: Condição ou data de expiração da avaliação.

> [!WARNING]
> Avaliações antigas nunca constituem garantia permanente de conformidade. Avaliações cuja `recommended_review_date` seja ultrapassada bloqueiam automaticamente novas publicações de produção até atualização formal.

---

## 8. Monitorização Regulatória Contínua

- **Script de Diagnóstico e Auditoria**: `scripts/monitor-regulatory-updates.ts` (`npm run compliance:monitor`).
- **Agendamento Operacional**: Configurado em `.github/workflows/compliance-monitor.yml` com execução periódica semanal (todas as segundas-feiras às 06:00 UTC) e acionamento manual (`workflow_dispatch`).
- **Estados Auditáveis**:
  1. `COMPLETED_NO_CHANGES_DETECTED`: Milestones monitorizados em vigor ou com prazos além do horizonte de alerta.
  2. `CHANGES_DETECTED_REVIEW_REQUIRED`: Milestones entrando em vigor no horizonte de 180 dias.
  3. `HUMAN_LEGAL_REVIEW_NEEDED`: Normas com impacto direto em atos próprios ou decisões automatizadas exigindo sign-off humano.
  4. `INCOMPLETE_QUERY` / `TECHNICAL_FAILURE`: Falhas de rede ou configuração, impedindo aprovações tácitas.

---

## 9. Governação do Subagente (`lib/compliance/subagent-governance.ts`)

- **Menor Privilégio**: `validateSubagentRegistrationPrivileges` garante que `EnableWriteTools`, `EnableSubagentTools` e `EnableMCPTools` são estritamente `false`.
- **Tratamento de Respostas**: `processSubagentResponse` trata respostas vazias (`EMPTY_RESPONSE`), timeouts (`TIMEOUT`) e erros de ferramentas (`TOOL_FAILURE`), forçando o veredicto preliminar para `INDETERMINATE` e acionando `requiresHumanLegalReview`.
- **Desconexão de Pesquisa**: Se ferramentas de pesquisa em tempo real estiverem indisponíveis, qualquer parecer preliminar de aprovação é automaticamente rebaixado para `INDETERMINATE`.
- **Independência dos Quality Gates**: Pareceres textuais gerados por LLM atuam exclusivamente como assessoria preliminar (`isPreliminaryAdvisory: true`); a autorização de produção requer sempre a satisfação formal dos quality gates determinísticos em código.
