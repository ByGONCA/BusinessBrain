# BusinessBrain — Developer & Agent Onboarding

> **Referência:** Vibe Coding Toolkit (`templates/project-docs/onboarding.md.template`)  
> **Target:** BusinessBrain (`CompanyBrain`)  
> **Data:** 18 de Outubro de 2026

---

## 1. Pré-Requisitos de Ambiente

Para executar e desenvolver no BusinessBrain:
- **Node.js:** Versão 22.x LTS (compatível com Next.js 16.3+ e React 19).
- **Gestor de Pacotes:** `npm` (versão 10+).
- **Sistema Operativo:** Windows, macOS ou Linux.
- **Git:** Versão 2.40+ com suporte a caminhos longos configurado se no Windows (`core.longpaths=true`).

---

## 2. Configuração Local Passo a Passo

### Passo 1: Obter o Código e Dependências
```bash
git clone https://github.com/ByGONCA/BusinessBrain.git
cd BusinessBrain
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
Copie o ficheiro de exemplo para o ficheiro local (não versionado no Git):
```bash
cp .env.example .env.local
```

Preencha apenas as chaves necessárias para desenvolvimento local:
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase Staging/Local.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Chave pública do Supabase.
- `STRIPE_SECRET_KEY`: Chave de testes Stripe (`sk_test_...`).
- `STRIPE_WEBHOOK_SECRET`: Segredo de webhook Stripe de testes local (`whsec_...`).

> [!WARNING]
> **Zero Secret Leakage:** Nunca versione `.env.local` ou chaves de produção. Apenas variáveis públicas de frontend podem ter o prefixo `NEXT_PUBLIC_`.

### Passo 3: Iniciar o Servidor de Desenvolvimento
```bash
npm run dev:turbo
```
A aplicação ficará disponível em `http://localhost:3000`.

---

## 3. Comandos de Verificação do Estado Local

Antes de submeter alterações ou criar uma nova fase de funcionalidades, execute:

```bash
# 1. Checagem de tipagem estrita
npm run typecheck

# 2. Checagem de conformidade de linter
npm run lint

# 3. Compilação de teste de produção
npm run build
```

---

## 4. Guia Rápido para Agentes de IA

Ao operar no BusinessBrain:
1. **Leia sempre `AGENTS.md` e a documentação em `docs/`** antes de propor modificações.
2. **Respeite o isolamento multi-tenant**: Nunca crie consultas sem filtro por `organization_id` ou sem passar pela camada de entitlement (`lib/organizations/entitlements.ts`).
3. **Mantenha alterações mínimas e completas (*Ponytail*)**: Reutilize componentes e serviços existentes; não crie abstrações desnecessárias.
4. **Comunique de forma concisa (*Caveman*)**: Foque nas decisões, evidências e resultados das verificações.
