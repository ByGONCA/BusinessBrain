# BusinessBrain — Quality & Verification Protocols

> **Referência:** Vibe Coding Toolkit (`templates/project-docs/quality.md.template` & `docs/prompts/13-security-review.md`)  
> **Target:** BusinessBrain (`CompanyBrain`)  
> **Data:** 18 de Outubro de 2026

---

## 1. Comandos Canónicos de Verificação

Os seguintes comandos constituem os pontos canónicos de validação da aplicação e devem ser executados após qualquer alteração de código ou configuração:

| Comando | O que Prova / Valida | Âmbito |
| :--- | :--- | :--- |
| `npm run typecheck` | Tipagem estrita TypeScript (sem `any`, sem erros de compilação). | Todo o projeto (`app/`, `lib/`, `components/`, `scripts/`). |
| `npm run lint` | Conformidade com regras ESLint e Next.js Core Web Vitals. | Ficheiros de aplicação e regras de frontend. |
| `npm run build` | Compilação de produção Next.js (validação de Server Components, rotas dinâmicas e bundles). | Todo o frontend e API routes. |
| `npm run dev:turbo` | Execução do servidor de desenvolvimento com motor Turbopack em porta local. | Validação interativa local (`http://localhost:3000`). |

### Verificações Específicas de Negócio e Segurança em `scripts/`
- `npx tsx scripts/test-permissions-system.ts`: Validação de precedência de permissões (*Explicit DENY* sobre *Allow* de equipa).
- `npx tsx scripts/test-invitations-security.ts`: Validação de hashing, expiração de tokens e autorização de convites.
- `npx tsx scripts/test-rate-limiting.ts`: Verificação do sistema de limitação de taxa em endpoints sensíveis.
- `npx tsx scripts/test-stripe-connect-analytics.ts`: Validação da sincronização de webhooks e relatórios Stripe.

---

## 2. Invariantes Arquiteturais e Regras de Qualidade

1. **Strict TypeScript (Zero `any`)**:
   - Todo o código novo ou refatorado deve conter tipos explícitos para propriedades, retornos e entidades de banco de dados. Proibição absoluta de asserções inseguras (`as any`).
2. **Isolamento Multi-Tenant Inviolável**:
   - Todas as tabelas de negócio possuem `organization_id uuid not null references organizations(id) on delete cascade`.
   - Políticas RLS no PostgreSQL verificam rigorosamente a pertença do utilizador através de `organization_members` acompanhada de `(select auth.uid())`.
   - Nenhuma query no servidor assume isolamento sem verificação de pertença ativa (`lib/organizations/entitlements.ts`).
3. **Decoupling de Autenticação e Entitlement**:
   - Uma sessão Supabase válida não confere acesso ao dashboard. É obrigatória a validação de assinatura (`trialing` ou `active`).
4. **Resolução Segura de Faturação**:
   - Preços Stripe (`Price ID`) são resolvidos estritamente no servidor através de variáveis de ambiente.
   - Parâmetros de retorno do browser (`success=true`) nunca concedem acesso ao produto; apenas webhooks assinados e verificados com `STRIPE_WEBHOOK_SECRET` atualizam o banco de dados.
5. **Privacidade e Consentimento de Marketing**:
   - Caixas de consentimento de marketing nunca vêm pré-selecionadas. Termos de Serviço e Política de Privacidade são obrigatórios e mantidos separados de comunicações de marketing.
6. **Tamanho de Ficheiro Orientador (350 Linhas)**:
   - Em novos módulos e componentes, utilizar 350 linhas como limiar de modularização. Módulos legados complexos com mais de 350 linhas (ex: motor do Company Graph) são mantidos íntegros e recebem refatoração apenas quando explicitamente justificado por nova responsabilidade.

---

## 3. Protocolo de Revisão de Código por Risco e Evidência

As revisões pós-implementação ou correção de bugs seguem o princípio de risco proporcional:

1. **Identificação do Âmbito Estrito do Diff**:
   - Inspecionar apenas ficheiros modificados, respetivos callers imediatos e testes afetados.
2. **Revisores Independentes e Read-Only**:
   - Revisões críticas (segurança, RLS, faturação) são efetuadas em modo de leitura estrita, apontando evidências concretas: localização (`file:line`), cenário de falha, pré-condições do atacante e severidade fundamentada.
3. **Critérios de Conclusão**:
   - A revisão termina quando os apontamentos relevantes estiverem resolvidos ou explicitamente justificados, as verificações canónicas passarem e os riscos residuais ficarem documentados.

---

## 4. Protocolo Reutilizável de Revisão de Segurança (Baseline & Diff)

Baseado no prompt oficial do Vibe Coding Toolkit (`docs/prompts/13-security-review.md`) e na metodologia da Trail of Bits (`differential-review`):

### Como Executar uma Revisão de Segurança

#### Modo Baseline do Repositório:
```text
Execute a revisão de segurança do repositório em modo baseline. Preserve o cliente, modelo e autenticação atuais. Mantenha os ficheiros do repositório inalterados e guarde o relatório redigido num ficheiro privado fora do repositório.
```

#### Modo Diff (Para PRs ou Alterações Pontuais):
```text
Execute a revisão de segurança em modo diff (base=<commit-base>, head=<commit-head>, comparison=merge-base). Utilize a skill differential-review para calcular blast radius, analisar histórico git blame, validar callers de funções sensíveis e relatar qualquer ausência de testes em código alterado. Guarde o relatório num ficheiro privado fora do repositório.
```

### Regras Obrigatórias do Relatório de Segurança:
- **Zero Segredos no Relatório:** Chaves de API, tokens e dados sensíveis devem ser redigidos (ex: `sk_test_...[REDACTED]`).
- **Localização Externa:** O relatório de segurança deve ser gerado no diretório de artefactos do utilizador (ex: `<appDataDir>\brain\<conversation-id>\security-review.md`), nunca adicionado ao repositório público.
- **Rigor de Severidade:** Classificar os achados com base em impacto e explorabilidade reais (Crítico, Alto, Médio, Baixo), separando vulnerabilidades confirmadas de hipóteses não testadas e sugestões de endurecimento (*hardening*).
- **Sem Garantias Falsas:** A ausência de vulnerabilidades detetadas significa que nenhuma foi substanciada no âmbito inspecionado; nunca garante que a aplicação seja 100% impenetrável.
