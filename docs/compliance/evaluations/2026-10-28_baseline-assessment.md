# Relatório de Avaliação Base de Conformidade Jurídica e Regulatória
**Document ID**: `EVAL-2026-001`  
**Data da Avaliação**: 28 de Outubro de 2026  
**Avaliador**: `global-legal-compliance-agent`  
**Estado**: `APPROVED_WITH_CONDITIONS` (Condições Verificadas e Implementadas no Código)

---

## 1. Resumo Executivo
Avaliação abrangente da arquitetura base do **BusinessBrain**, incidindo sobre os módulos implementados até à data: autenticação multi-tenant com isolamento RLS, fluxo de consentimento de marketing e termos de serviço, cobrança e subscrições recorrentes via Stripe Checkout/Customer Portal, gestão de sessões por cookies seguros e controlo de concorrência optimista (OCC). O sistema demonstra elevado rigor arquitetural de isolamento e conformidade técnica nos mercados de lançamento prioritários (Portugal/União Europeia, Estados Unidos da América, Reino Unido e Brasil). Todas as condições de aprovação técnica foram auditadas e encontram-se verificadas no código.

## 2. Funcionalidade ou Campanha Analisada
- **Módulos**: Fundação Multi-Tenant, Autenticação SSR (Email/Password e GitHub OAuth), Trial Gating (7 dias), Planos Stripe (`starter`, `pro`, `enterprise`), Webhook criptográfico, Sistema de Convites Seguros (HMAC + SHA-256) e Consentimento RGPD.
- **Referência de Commit**: `HEAD` (Main branch, Outubro de 2026).

## 3. Mercados e Jurisdições Abrangidos
- **Portugal (PT)** e **União Europeia (UE)**: Regime geral RGPD, Diretiva e-Privacy e defesa do consumidor.
- **Estados Unidos da América (US)**: Nível federal (FTC Act § 5, CAN-SPAM Act, ROSCA) e nível estadual (Califórnia: CCPA/CPRA, CalOPPA, California Auto-Renewal Law AB 390 / SB 313).
- **Reino Unido (GB)**: UK GDPR, Data Protection Act 2018, PECR 2003, Consumer Rights Act 2015.
- **Brasil (BR)**: Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018), Código de Defesa do Consumidor (CDC - Lei 8.078/1990) e Marco Civil da Internet (Lei 12.965/2014).

## 4. Jurisdições que Ficaram por Verificar
- **Canadá (CA e Quebeque Loi 25)**: Agendado para fase de expansão P2.
- **Austrália (AU - Privacy Act 1988)**: Agendado para fase de expansão P2.
- **Ásia-Pacífico (Japão APPI, Singapura PDPA, Índia DPDP Act)**: Agendado para fase de expansão P3.
- *Nota estrita*: Nenhuma dessas jurisdições é declarada em conformidade sem avaliação formal dedicada.

## 5. Legislação Aplicável
- Regulamento (UE) 2016/679 (RGPD)
- Diretiva 2002/58/CE (Diretiva Privacidade e Comunicações Eletrónicas / e-Privacy)
- Diretiva 2011/83/UE (Direitos dos Consumidores)
- 15 U.S.C. §§ 7701-7713 (CAN-SPAM Act dos EUA)
- 15 U.S.C. §§ 8401-8405 (Restore Online Shoppers' Confidence Act - ROSCA)
- California Civil Code § 1798.100 et seq. (CCPA/CPRA)
- California Business and Professions Code § 17600 et seq. (Auto-Renewal Law)
- UK Data Protection Act 2018 e Privacy and Electronic Communications Regulations 2003 (PECR)
- Lei n.º 13.709/2018 (LGPD - Brasil) e Lei n.º 8.078/1990 (CDC - Brasil)

## 6. Fontes Oficiais e Citações
1. **EUR-Lex**: Regulamento (UE) 2016/679, JO L 119 de 4.5.2016; Diretiva 2011/83/UE, JO L 304 de 22.11.2011.
2. **US Government Publishing Office (GovInfo)**: 15 U.S.C. 7704; 15 U.S.C. 8402.
3. **California Legislative Information**: Cal. Civ. Code § 1798.100; Cal. Bus. & Prof. Code § 17602.
4. **UK Legislation**: The Privacy and Electronic Communications (EC Directive) Regulations 2003 (SI 2003/2426).
5. **Planalto (Brasil)**: Diário Oficial da União, Lei n.º 13.709/2018 e Lei n.º 8.078/1990.
- *Data de Consulta*: 28 de Outubro de 2026. Todas as fontes oficiais encontram-se vigentes e ativas.

## 7. Requisitos Confirmados
- ✅ Separação estrita de consentimento: Termos de Serviço e Privacidade são obrigatórios; consentimento de marketing é opcional e **desmarcado por defeito** (`app/(auth)/signup/page.tsx`).
- ✅ Isolamento multi-tenant intransponível com RLS forçado em todas as tabelas de dados empresariais com `organization_id`.
- ✅ Verificação criptográfica de webhooks Stripe com `stripe.webhooks.constructEvent` (`app/api/webhooks/stripe/route.ts`).
- ✅ Isolamento de segredos: chaves privadas de servidor nunca são expostas ao cliente nem utilizam prefixos públicos.
- ✅ Gestão de renovação automática e cancelamento simples acessível via Stripe Customer Portal (`app/dashboard/settings/billing/page.tsx`).

## 8. Riscos Identificados e Classificação
1. **[RISK-01] Falta de Double Opt-In Formal em Campanhas para a Alemanha (DE)**
   - *Domínio*: `INTERNATIONAL_MARKETING` | *Gravidade*: `MEDIUM`
   - *Fundamento*: UWG § 7(2) na jurisprudência alemã exige prova robusta de consentimento (DOI) para evitar ações inibitórias de concorrentes.
2. **[RISK-02] Exigência de Divulgação Pré-Contratual de Renovação Automática na Califórnia (US-CA)**
   - *Domínio*: `PAYMENTS_SUBSCRIPTIONS` | *Gravidade*: `MEDIUM`
   - *Fundamento*: Cal. Bus. & Prof. Code § 17602 exige aviso prévio claro, cancelamento online em poucos cliques e recibo com termos de renovação.
3. **[RISK-03] Transferências Internacionais de Dados para Fornecedores nos EUA**
   - *Domínio*: `DATA_PRIVACY` | *Gravidade*: `LOW`
   - *Fundamento*: Stripe e Supabase operam sob o EU-U.S. Data Privacy Framework (DPF) e Cláusulas Contratuais Tipo (SCCs).

## 9. Diferenças Entre Mercados
- **Email Marketing B2C**: Na UE/UK/Brasil é necessário consentimento prévio ou relação prévia com opt-out imediato. Nos EUA (CAN-SPAM), o regime é de opt-out (não exige consentimento prévio, mas exige morada física e link funcional).
- **Direito de Livre Resolução**: Consumidores na UE/UK têm direito legal a 14 dias de reflexão; nos EUA não existe prazo legal federal para SaaS corporativo (regime "all sales final" admissível desde que divulgado com clareza).
- **Idioma Obrigatório**: O Brasil (CDC Art. 31) exige termos em Português; a França (Loi Toubon) exige Francês para ofertas dirigidas a residentes franceses.

## 10. Alterações Técnicas Recomendadas
- Manter o sistema de internacionalização quad-locale (`en`, `pt`, `es`, `fr`) sincronizado para termos e checkout.
- Assegurar que os recibos transacionais da Stripe enviam explicitamente a periodicidade da renovação e o link direto para cancelamento.

## 11. Alterações Operacionais Recomendadas
- Manter registo de auditoria com timestamp, IP e versão dos termos aceites aquando do registo de cada utilizador.
- Rever a cada 12 meses a certificação DPF dos subprocessadores de infraestrutura.

## 12. Requisitos Contratuais e com Fornecedores
- Acordo de Tratamento de Dados (DPA) em vigor com a Stripe, Inc. e Supabase, Inc. incorporando Cláusulas Contratuais Tipo (SCCs) da Comissão Europeia (Decisão 2021/914).

## 13. Necessidade de Validação Jurídica Local
- **Não urgente para a fase atual**. A validação por advogado local será obrigatória caso o BusinessBrain lance campanhas de marketing massivas de email frio em jurisdições estritas (ex.: Alemanha UWG ou Canadá CASL) ou ative funcionalidades com decisões automatizadas de alto risco sob o Regulamento de IA da UE.

## 14. Testes de Aceitação e Condições Verificáveis
- [x] `COND-01`: Checkbox de consentimento de marketing nunca vem pré-selecionada (Verificado em `app/(auth)/signup/page.tsx`).
- [x] `COND-02`: Webhooks da Stripe rejeitam payloads sem assinatura válida `stripe-signature` (Verificado em `scripts/test-checkout-webhook-entitlement.ts`).
- [x] `COND-03`: RLS bloqueia qualquer tentativa de consulta inter-tenant em tabelas de dados empresariais (Verificado em `scripts/test-permissions-system.ts`).

## 15. Decisão Final
**APROVADO COM CONDIÇÕES (APPROVED_WITH_CONDITIONS)**  
*Justificação*: A arquitetura de base cumpre os requisitos essenciais de segurança, privacidade e faturação nos mercados prioritários. Todas as condições de aceitação foram verificadas satisfatoriamente no código. O lançamento comercial ativo nestas geografias está validado.

## 16. Data da Investigação
- **28 de Outubro de 2026**

## 17. Data Recomendada para Revisão
- **28 de Abril de 2027** (ou antes, caso ocorra a ativação de novas funcionalidades de IA gerativa ou expansão para o Canadá/Austrália).
