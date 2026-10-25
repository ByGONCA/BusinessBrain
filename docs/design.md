---
version: 1.0.0
name: BusinessBrain-design-system
description: "Especificação de Design System para o BusinessBrain — Enterprise Operating System com estética OLED Dark Minimalist, alta densidade e tipografia Geist. Combina os tokens e componentes reais do projeto com o rigor de especificação do awesome-design-md."

colors:
  # --- Superfícies e Canvas (Observados no Código) ---
  canvas: "#09090B"                 # [--background] Fundo principal OLED Dark Zinc
  canvas-pure-black: "#000000"      # Fundo do editor / overlay
  surface-card: "#121215"           # [--card] Painéis, cartões e blocos de workspace
  surface-secondary: "#16161A"      # [--surface-secondary, --muted] Listagens, barras internas
  surface-elevated: "#1B1B20"       # [--surface-elevated] Modais, popovers e menus flutuantes
  sidebar: "#0C0C0E"                # [--sidebar] Barra lateral de navegação
  hover: "#1A1A1F"                  # [--hover] Fundo em estado hover de itens interativos
  selected: "#202026"               # [--selected] Fundo de item selecionado/ativo

  # --- Bordas e Divisores (Observados no Código) ---
  hairline: "#1E1E22"               # [--border] Borda padrão de separação de layout
  hairline-subtle: "#161619"        # [--border-subtle] Divisores internos suaves
  hairline-strong: "#242427"        # Borda estruturada de botões, inputs e badges
  sidebar-border: "#18181B"         # [--sidebar-border] Borda direita da sidebar
  card-hover-border: "#2A2A30"      # Borda sutil de elevação no hover do Card

  # --- Tipografia e Textos (Observados no Código) ---
  ink-primary: "#F4F4F5"            # [--foreground, --card-foreground] Texto de alto contraste
  ink-secondary: "#A1A1AA"          # [--secondary-foreground] Rótulos, metadados e subtítulos
  ink-muted: "#71717A"              # [--muted-foreground] Placeholders, ícones inativos, legendas
  ink-pure-white: "#FFFFFF"         # Texto de destaque absoluto e botões com acento

  # --- Acentos e Funcionalidade (Observados no Código) ---
  accent: "#3B82F6"                 # [--accent] Azul primário corporativo (foco, links, botões)
  on-accent: "#FFFFFF"              # [--accent-foreground] Texto sobre acento
  accent-graph: "#6366F1"           # Índigo de nós e conexões do Company Graph

  # --- Semântica e Métricas (Observados no Código) ---
  semantic-green: "#10B981"         # [--metric-green] Sucesso, status ativo, taxa positiva
  semantic-red: "#EF4444"           # [--metric-red] Erro, remoção, perigo crítico
  semantic-amber: "#F59E0B"         # [--metric-amber] Alerta, trial em contagem decrescente

  # --- Modo de Alto Contraste (Observado no CSS [data-contrast="high"]) ---
  high-contrast-border: "#3F3F46"
  high-contrast-border-subtle: "#27272A"
  high-contrast-foreground: "#FFFFFF"
  high-contrast-muted-foreground: "#A1A1AA"

typography:
  font-sans: "var(--font-geist-sans), 'Geist', -apple-system, sans-serif"
  font-mono: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace"
  scales:
    display-xl:
      fontSize: "3rem"             # 48px
      fontWeight: 600
      lineHeight: 1.15
      letterSpacing: "-0.03em"     # [Proposta Nova de Padronização]
    display-lg:
      fontSize: "2.25rem"          # 36px
      fontWeight: 600
      lineHeight: 1.2
      letterSpacing: "-0.025em"    # [Proposta Nova de Padronização]
    headline:
      fontSize: "1.5rem"           # 24px
      fontWeight: 600
      lineHeight: 1.3
      letterSpacing: "-0.02em"     # [Proposta Nova de Padronização]
    card-title:
      fontSize: "1rem"             # 16px
      fontWeight: 600
      lineHeight: 1.0              # [Observado em CardTitle]
      letterSpacing: "-0.01em"
    body:
      fontSize: "0.875rem"         # 14px [Observado em inputs, botões e tabelas]
      fontWeight: 400
      lineHeight: 1.5
      letterSpacing: "-0.005em"
    body-sm:
      fontSize: "0.8125rem"        # 13px [Observado na sidebar e menus contextuais]
      fontWeight: 400
      lineHeight: 1.45
      letterSpacing: "0"
    caption:
      fontSize: "0.75rem"          # 12px [Observado em CardDescription e Badges]
      fontWeight: 400
      lineHeight: 1.4
      letterSpacing: "0"

radii:
  button: "0.5rem"                 # 8px (rounded-lg) [Observado em Button e Input]
  card: "1rem"                     # 16px (rounded-2xl) [Observado em Card]
  badge: "9999px"                  # (rounded-full) [Observado em Badge]
  menu: "0.75rem"                  # 12px (rounded-xl) [Observado em Modais e Dropdowns]
---

# BusinessBrain — Design System & Visual Specification

> **Missão:** Camada de memória e inteligência para empresas modernas.  
> **Estética:** OLED Dark Minimalist (alta densidade, foco analítico, precisão tipográfica).  
> **Padrão:** Google Stitch / Awesome DESIGN.md adaptado e integrado com Vibe Coding Toolkit.

---

## 1. Tabela de Auditoria: Valores Observados vs Propostas Novas

| Categoria | Elemento / Token | Valor no Código Atual (`globals.css` / UI) | Estado | Propósito / Diretriz |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas** | `--background` | `#09090B` (Zinc 950) | **Observado** | Superfície primária da aplicação; preto OLED anti-fadiga visual. |
| **Superfície** | `--card` | `#121215` (Zinc profundo) | **Observado** | Painéis, cartões analíticos e áreas de trabalho isoladas. |
| **Superfície** | `--surface-secondary` | `#16161A` | **Observado** | Fundo de cabeçalhos secundários, barras de ferramentas e listas. |
| **Superfície** | `--surface-elevated` | `#1B1B20` | **Observado** | Menus flutuantes, popovers e diálogos modais. |
| **Bordas** | `--border` | `#1E1E22` (Hairline 1px) | **Observado** | Separação perimetral sutil sem necessidade de sombras pesadas. |
| **Bordas** | Elementos Interativos | `#242427` (Hairline strong) | **Observado** | Borda estruturada de botões secundários, inputs e outlines. |
| **Acento** | `--accent` | `#3B82F6` (Azul corporativo) | **Observado** | Foco funcional, anéis de clique e links interativos. |
| **Grafo** | Indigo Accent | `#6366F1` | **Observado** | Nós e caminhos selecionados no Company Graph Canvas. |
| **Acessibilidade**| `[data-contrast="high"]` | Border: `#3F3F46`, FG: `#FFF` | **Observado** | Sobrescrita nativa para conformidade em monitores de baixo contraste. |
| **Tipografia** | Família Sans | `Geist Sans` | **Observado** | Fonte primária do Next.js para interface executiva. |
| **Tipografia** | Família Mono | `Geist Mono` | **Observado** | Códigos, identificadores de tenant, métricas e timestamps. |
| **Tipografia** | Tracking Escalar | `-0.03em` a `0` | **Proposta Nova** | Padronização de tracking negativo medido para títulos grandes (≥24px). |
| **Layout** | Densidade de Dados | Padding compacto (compact/cozy) | **Proposta Nova** | Proibir espaçamentos vazios > 32px dentro de cartões de dados analíticos. |

---

## 2. Princípios Fundamentais de Design

1. **Dark-First Funcional (Não Decorativo)**:
   - A interface utiliza superfícies profundas (`#09090B` a `#1B1B20`) com bordas *hairline* de 1px.
   - Proibição de gradientes difusos coloridos de fundo ("auroras") que gerem ruído visual ou dificultem a leitura de gráficos corporativos.
2. **Acento como Evento Pontual**:
   - As cores cromáticas (azul `#3B82F6`, índigo `#6366F1`, esmeralda `#10B981`) surgem apenas em resposta a interação, foco ativo ou estado de métrica.
   - Textos comuns, rótulos e divisores permanecem estritamente em escala monocromática (Zinc).
3. **Tipografia de Precisão (Geist)**:
   - Títulos em `Geist Sans` com peso 600 e tracking negativo proporcional para transmitir acabamento de engenharia de software de elite.
   - Dados tabulares, chaves de API, IDs de organização e métricas financeiras utilizam sempre `Geist Mono`.
4. **Respeito Estrito à Acessibilidade (WCAG AA)**:
   - Contraste texto/fundo nunca inferior a **4.5:1** para texto normal e **3.0:1** para texto grande.
   - Todos os elementos interativos possuem indicador de foco nítido (`focus-visible:ring-2 focus-visible:ring-accent`).
   - Alvos de clique possuem dimensão mínima de **44x44px** (ou padding equivalente).
   - Animações e transições respeitam `prefers-reduced-motion` (`motion-reduce:transition-none`).

---

## 3. Anatomia dos Componentes Base (`components/ui/`)

Ao criar ou estender interfaces, o agente deve reutilizar obrigatoriamente as primitivas já existentes:

### A. Botões ([`button.tsx`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/components/ui/button.tsx))
- **`primary`**: `bg-[#F5F5F5] text-[#080809] hover:bg-white active:bg-zinc-200 font-semibold rounded-lg`. Utilizado para o CTA principal da tela.
- **`secondary`**: `bg-[#19191B] text-[#F5F5F5] hover:bg-[#202023] border border-[#242427] rounded-lg`. Utilizado para ações secundárias e navegações neutras.
- **`outline`**: `border border-[#242427] bg-transparent hover:bg-[#1C1C1F] text-[#F5F5F5]`.
- **`ghost`**: `bg-transparent hover:bg-[#1C1C1F] text-[#A1A1AA] hover:text-[#F5F5F5]`. Ideal para barras de ferramentas e ícones.
- **`danger`**: `bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30`. Exclusivo para operações destrutivas.

### B. Cartões ([`card.tsx`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/components/ui/card.tsx))
- Contentor padrão para dados e painéis: `rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-xs hover:border-[#2a2a30] transition-colors`.
- Subcomponentes estruturados: `CardHeader`, `CardTitle` (`text-base font-semibold`), `CardDescription` (`text-xs text-muted-foreground`), `CardContent`.

### C. Campos de Entrada ([`input.tsx`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/components/ui/input.tsx))
- Campo de formulário padrão: `rounded-lg border border-[#242427] bg-[#141415] px-3.5 py-2 text-sm text-[#F5F5F5] placeholder:text-[#71717A]`.
- Foco ativo: `focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/50`.
- Estado de erro: `border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/50` com mensagem em `text-xs text-rose-400`.

### D. Badges e Etiquetas ([`badge.tsx`](file:///C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain/components/ui/badge.tsx))
- Formato pílula: `rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide`.
- Variantes semânticas: `default` (azul), `secondary` (zinco escuro), `outline`, `success` (esmeralda), `warning` (âmbar).

---

## 4. Governança de Contexto: Uso sob Demanda por Agentes

Para proteger a janela de contexto de agentes e evitar que tarefas de backend carreguem regras visuais desnecessárias:

1. **Tarefas de Frontend / UI**:
   - O agente consulta este documento (`docs/design.md` ou `DESIGN.md`) quando for solicitado a: criar uma nova página, desenhar um modal, estender o Company Graph, auditar acessibilidade ou aplicar estilos.
   - Skills correlatas ativadas: `frontend-design`, `ui-styling`, `web-design-guidelines`, `vercel-react-view-transitions`.
2. **Tarefas de Backend / Dados / Segurança**:
   - O agente **NÃO deve carregar** este documento ao trabalhar em: migrações SQL, políticas RLS, rotas de API (`app/api/`), Server Actions de faturação Stripe (`lib/stripe/`) ou testes unitários de permissões.
   - Nessas tarefas, o agente carrega apenas `docs/DATABASE.md`, `docs/ARCHITECTURE.md` e `docs/quality.md`.

---

## 5. Proibições Estritas de Design (O Que NÃO Fazer)

- ❌ **NÃO instalar bibliotecas de UI de terceiros** (e.g. MUI, Chakra, Ant Design, Mantine). Todas as interfaces são construídas com Tailwind e primitivas leves locais.
- ❌ **NÃO quebrar o modo de alto contraste**: Nunca sobrescrever diretamente `--border` ou `--foreground` com `!important` que ignore `[data-contrast="high"]`.
- ❌ **NÃO usar cores arbitrárias fora da paleta Zinc**: Não inventar novos tons de cinza ou fundos roxos/azuis sem necessidade.
- ❌ **NÃO eliminar anéis de foco**: `outline-none` só é permitido se acompanhado obrigatoriamente de `focus-visible:ring-2`.
- ❌ **NÃO usar tamanhos de fonte inferiores a 12px** (`text-xs`), exceto para monogramas ou micro-ícones específicos.
- ❌ **NÃO estampar termos ou secções de engenharia/segurança na UI**: Proibido exibir badges, cartões, slogans ou secções de segurança técnica (ex.: "Built with strict security perimeters", "Enterprise Workspace Isolation & Encryption", "Cryptographic Webhooks", "Least-Privilege Scopes", "Proprietary Tenant Scope", "RLS Guard", "Perímetro Ativo") no dashboard, nas páginas de marketing ou no footer. A segurança é uma garantia de infraestrutura/backend, nunca propaganda de jargão técnico na UI para o utilizador.
