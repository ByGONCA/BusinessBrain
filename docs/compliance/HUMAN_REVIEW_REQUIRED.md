# BusinessBrain Consolidated Human Review & Decision Ledger

> **Governance Principle**: Code and agents can automate verification and technical safeguards, but cannot invent corporate identity, forge legal signatures, or access remote live production accounts without explicit owner authorization.  
> **Status**: Active Human Decision Queue  
> **Last Audited**: October 28, 2026 | Milestone 1.2 Final Verification

---

## 1. Blocker-Mapped Human Action Ledger

### BLK-01: Corporate Legal Entity & Tax Identification (`[OWNER_INPUT_REQUIRED]`)
- **Ação Concreta**: Recolha e introdução dos dados legais definitivos da sociedade comercial constituída.
- **Consola / Serviço**: Registo Comercial Nacional (ex.: IRN / Conservatória / RNPC em Portugal, Companies House no UK, etc.) e Autoridade Tributária.
- **Evidência Necessária**:
  1. Certidão Permanente de Registo Comercial ou Certificado de Incorporação (código de acesso ou documento PDF oficial).
  2. Número de Identificação Fiscal / NIPC / VAT ID definitivo.
  3. Morada oficial da sede fiscal (Rua, Código Postal, Cidade, País).
  4. Nome do Administrador / Gerente / Representante Legal estatutário.
  5. Confirmação de reencaminhamento dos e-mails `legal@businessbrain.io` e `dpo@businessbrain.io` para caixas operacionais ativas.
- **Responsável**: Fundador / Proprietário da Conta e Advogado da Empresa.
- **Local Seguro de Registo**:
  - `config/legal-entity.json`: preencher os campos reais, eliminando todos os tokens de placeholder.
  - No bloco `verification_evidence`, introduzir:
    - `evidence_type`: `"COMMERCIAL_REGISTRY_CERTIFICATE"` (ou `"TAX_AUTHORITY_DOCUMENT"`).
    - `evidence_reference`: Código de certidão oficial (ex.: `"CERT-2026-XXXX-XXXX"`).
    - `verified_by`: Nome completo do responsável pela conferência documental.
    - `verified_at`: Data da conferência em formato ISO (`"YYYY-MM-DD"`).
  - Atualizar `verification_status` para `"LEGALLY_VERIFIED"`.
- **Verificação Pós-Ação**: Executar `npm run compliance:check`. O ecrã deve transitar `(b) Legal Entity Verification` de `[PENDING_OWNER_EVIDENCE]` para `[VERIFIED]` e eliminar o aviso `BLK-01`.

---

### BLK-02: Stripe de Produção e Conformidade Fiscal (`[OWNER_INPUT_REQUIRED]` & `[EXTERNAL_ACCESS_REQUIRED]`)
- **Ação Concreta**: Ativação do modo live da Stripe, registo do endpoint de webhook com os 7 eventos necessários e ativação do cálculo automático de impostos (Stripe Tax).
- **Consola / Serviço**: Dashboard da Stripe (`dashboard.stripe.com`) e Consola de Alojamento (Vercel Project Environment Variables).
- **Evidência Necessária**:
  1. **Chave Live**: Chave de API secreta com prefixo `sk_live_...`.
  2. **Webhook Endpoint de Produção**: URL `https://businessbrain.io/api/webhooks/stripe` configurado em *Developers → Webhooks* subscrito aos **7 eventos canónicos**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.trial_will_end`
     - `invoice.paid` / `invoice.payment_succeeded`
     - `invoice.payment_failed`
  3. **Segredo de Assinatura**: Chave com prefixo `whsec_...` para validação criptográfica HMAC via `stripe.webhooks.constructEvent`.
  4. **Registo Fiscal Ativo**: Conclusão da configuração em *Settings → Tax*, adicionando o registo de IVA em Portugal (ou no país da sede europeia) com regime de OSS/IOSS se aplicável.
- **Responsável**: Fundador / Administrador Financeiro.
- **Local Seguro de Registo**:
  - Variáveis de ambiente secretas na plataforma de alojamento (Vercel / servidor de produção):
    - `STRIPE_SECRET_KEY=sk_live_...`
    - `STRIPE_WEBHOOK_SECRET=whsec_...`
    - `STRIPE_AUTOMATIC_TAX=true`
    - `STRIPE_STARTER_PRICE_ID=price_...` (Price ID live do plano Starter)
    - `STRIPE_PRO_PRICE_ID=price_...` (Price ID live do plano Pro)
- **Verificação Pós-Ação**:
  1. Executar `npm run compliance:check` em ambiente com as variáveis configuradas. O relatório transitará `(c) Stripe Production` para `[VERIFIED_LIVE]`.
  2. Teste controlado de integração: criar um checkout em ambiente de staging com cartão de teste Stripe autorizado antes de libertar para tráfego público, confirmando receção do webhook no ledger de idempotência sem erros 400 ou 500.

---

### BLK-03: Região Física do Projeto Supabase (`[EXTERNAL_ACCESS_REQUIRED]`)
- **Ação Concreta**: Auditoria visual e confirmação da localização física dos servidores do banco de dados PostgreSQL e storage para cumprimento dos compromissos de residência de dados da UE.
- **Consola / Serviço**: Consola de Gestão Supabase (`supabase.com/dashboard`).
- **Evidência Necessária**:
  - Confirmação visual em *Project Settings → General → General settings* de que **Region** é `AWS eu-central-1 (Frankfurt)` (ou outra região oficial da UE).
- **Responsável**: Fundador / Lead DevOps.
- **Local Seguro de Registo**:
  - Registar a data da auditoria e o Project ID em `docs/compliance/DATA_PROCESSING_MAP.md` na secção do subcontratante Supabase, alterando o status de `PENDING_DASHBOARD_VERIFICATION` para `VERIFIED_EU_CENTRAL_1`.
- **Verificação Pós-Ação**:
  - Executar `npm run compliance:check`. Comprovar que os compromissos de privacidade em `/privacy` e no mapa de tratamento estão alinhados com a localização física real.

---

### BLK-04: Acordos de Subcontratação (DPAs) e Parecer Jurídico (`[LEGAL_COUNSEL_REQUIRED]`)
- **Ação Concreta**: Celebração formal dos Acordos de Tratamento de Dados (DPAs) com fornecedores de infraestrutura e revisão qualificada dos termos legais por advogado.
- **Consola / Serviço**:
  1. **Supabase Inc.**: Submissão de DPA online em `https://supabase.com/legal/dpa`.
  2. **Vercel Inc.**: Submissão de DPA com Cláusulas Contratuais-Tipo (SCCs) em `https://vercel.com/legal/dpa`.
  3. **Resend Inc.**: Submissão de DPA em `https://resend.com/legal/dpa`.
  4. **Stripe Payments Europe Ltd.**: DPA com SCCs incorporado nos Stripe Services Agreements.
- **Evidência Necessária**:
  - Confirmação de submissão/assinatura dos 4 DPAs arquivados na pasta jurídica da empresa.
  - Parecer formal escrito de advogado qualificado aprovando a conformidade dos Termos de Serviço (`/terms`), Política de Privacidade (`/privacy`), Política de Cookies (`/cookies`) e consentimento de marketing perante:
    - RGPD (Regulamento (UE) 2016/679) e Lei n.º 58/2019 (Portugal).
    - Diretiva de Comércio Eletrónico (2000/31/CE) e DL 24/2014 (Contratos à Distância).
    - Lei n.º 10/2024 (Atos Próprios de Advogados e Solicitadores).
    - California Auto-Renewal Law (AB 390 / Cal. Bus. & Prof. Code § 17600) para subscrições nos EUA.
- **Responsável**: Advogado da Empresa e Fundador.
- **Local Seguro de Registo**:
  - Arquivar parecer jurídico e confirmações de DPA no cofre documental da empresa.
  - Atualizar `docs/compliance/DATA_PROCESSING_MAP.md` e registar a validação em `docs/compliance/evaluations/registry.json`.
- **Verificação Pós-Ação**:
  - Executar `npm run compliance:check`. Uma vez verificados formalmente, as mensagens de pré-lançamento (`Pre-Launch Regulatory Draft`) nos cabeçalhos das páginas legais podem ser removidas pelo desenvolvedor.

---

## 2. Decisões Estratégicas Diferidas (Expansões Futuras)

| ID | Descrição do Ponto | Mercado Afetado | Condição para Revisão |
| :--- | :--- | :--- | :--- |
| **HIR-04** | **Encarregado de Proteção de Dados Local (LGPD)** | Brasil (Tier 3) | Designar representante local antes de iniciar campanhas ativas no mercado brasileiro. |
| **LCR-03** | **Classificação de Risco no AI Act (Regulamento (UE) 2024/1689)** | UE | Efetuar avaliação de conformidade de IA quando forem introduzidas chamadas reais a APIs de LLM/Gemini em fases futuras do produto. |
