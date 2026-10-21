# Configuração de Custom SMTP com Resend no Supabase Auth

Este guia detalha o processo de integração do **Resend** como fornecedor de SMTP transacional no **Supabase Auth** para o **BusinessBrain**, garantindo alta entregabilidade sem expor chaves secretas ou credenciais ao cliente ou repositório Git.

---

## 1. Criar e Configurar Domínio no Resend

1. Acede a [https://resend.com](https://resend.com) e inicia sessão.
2. No menu lateral, acede a **Domains** e clica em **Add Domain**.
3. Introduz o teu domínio de envio (ex.: `companybrain.io` ou subdomínio `mail.companybrain.io`).
4. Adiciona os registos DNS gerados pelo Resend no teu fornecedor de DNS (Cloudflare, Vercel, Route53, GoDaddy, etc.):
   - **DKIM**: Registo `TXT` ou `CNAME` com o valor indicado pelo Resend.
   - **SPF**: Registo `TXT` com `v=spf1 include:resend.com ~all`.
   - **DMARC** (Recomendado): Registo `TXT` em `_dmarc.seudominio.com` com `v=DMARC1; p=none;`.
5. Clica em **Verify Records** até o domínio apresentar o estado **Verified**.

---

## 2. Gerar API Key no Resend

1. No menu lateral do Resend, acede a **API Keys**.
2. Clica em **Create API Key**.
3. Define um nome identificativo (ex.: `Supabase Auth Staging`).
4. Seleciona a permissão **Sending access** e restringe ao domínio verificado.
5. Copia a chave gerada (inicia com `re_`). **Guarda-a de imediato num gestor seguro de credenciais, pois não será exibida novamente.**

---

## 3. Configurar Custom SMTP no Supabase Dashboard

1. Acede ao [Supabase Dashboard](https://supabase.com/dashboard) e seleciona o teu projeto (**Staging** ou **Produção**).
2. No menu lateral esquerdo, clica em **Project Settings** (ícone de engrenagem) -> **Authentication**.
3. Rola a página até à secção **SMTP Settings**.
4. Ativa o botão **Enable Custom SMTP**.
5. Preenche os campos exatamente como se segue:

| Campo | Valor |
| :--- | :--- |
| **Sender email** | O endereço verificado no Resend (ex.: `auth@companybrain.io` ou `notifications@companybrain.io`) |
| **Sender name** | `Company Brain` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` (SSL) ou `587` (TLS) |
| **Minimum interval between emails** | `60` segundos (ou o valor desejado para rate limiting) |
| **User** | `resend` (sempre a palavra literal `resend` em minúsculas) |
| **Password** | A tua API Key do Resend gerada no passo anterior (`re_...`) |

6. Clica em **Save changes**.

---

## 4. Atualizar os Templates de Email no Supabase

No painel do Supabase, acede a **Authentication** -> **Email Templates**:

### A. Confirm signup (Confirmação de Registo)
- **Subject**: `Confirm your Company Brain account`
- **Body**: Copiar o conteúdo HTML do ficheiro [`docs/email-templates/confirm-signup.html`](./confirm-signup.html).

### B. Reset Password (Recuperação de Palavra-passe)
- **Subject**: `Reset your Company Brain password`
- **Body**: Copiar o conteúdo HTML do ficheiro [`docs/email-templates/reset-password.html`](./reset-password.html).

### C. Magic Link / OTP (Entrar com código por email)
- **Subject**: `Your Company Brain login code`
- **Body**: Copiar o conteúdo HTML do ficheiro [`docs/email-templates/magic-link-otp.html`](./magic-link-otp.html).

---

## 5. Regras de Segurança e Boas Práticas

1. **Zero Secret Leakage**: A chave `re_...` do Resend reside exclusivamente no cofre encriptado de SMTP do Supabase. Não deve ser colocada no ficheiro `.env`, em variáveis de ambiente expostas ao browser (`NEXT_PUBLIC_`) nem submetida para o Git.
2. **Prevenção de Abuso & Rate Limiting**:
   - O Supabase aplica limites por IP e por utilizador.
   - O BusinessBrain implementa rate limiting de aplicação no endpoint `sendEmailOtpAction` e cooldown de 60 segundos na interface visual.
3. **Impedir Criação Acidental de Contas**:
   - O fluxo de login por OTP utiliza estritamente `shouldCreateUser: false`.
   - Se o email não estiver previamente registado, a tentativa de login por código é rejeitada com mensagem informativa para efetuar o registo através do fluxo formal com aceitação dos Termos de Serviço.
