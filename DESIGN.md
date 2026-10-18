---
version: 1.0.0
name: BusinessBrain-design-system
description: "Especificação de Design System para o BusinessBrain — Enterprise Operating System com estética OLED Dark Minimalist, alta densidade e tipografia Geist. Documento canónico consolidado em docs/design.md."

colors:
  canvas: "#09090B"
  surface-card: "#121215"
  surface-secondary: "#16161A"
  surface-elevated: "#1B1B20"
  sidebar: "#0C0C0E"
  hairline: "#1E1E22"
  hairline-strong: "#242427"
  ink-primary: "#F4F4F5"
  ink-secondary: "#A1A1AA"
  ink-muted: "#71717A"
  accent: "#3B82F6"
  accent-graph: "#6366F1"
  semantic-green: "#10B981"
  semantic-red: "#EF4444"
  semantic-amber: "#F59E0B"

typography:
  font-sans: "var(--font-geist-sans), 'Geist', -apple-system, sans-serif"
  font-mono: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace"

radii:
  button: "0.5rem"
  card: "1rem"
  badge: "9999px"
  menu: "0.75rem"
---

# BusinessBrain — DESIGN.md

> Este ficheiro serve como ponto de entrada canónico de design para ferramentas do ecossistema Google Stitch, Awesome DESIGN.md e agentes de IA focados em frontend.

Para a especificação completa e detalhada, anatomia de componentes (`components/ui/`), tabela de tokens observados vs propostas e diretrizes de acessibilidade WCAG AA, consulte o documento consolidado do projeto:

👉 **[docs/design.md](./docs/design.md)**

---

## Resumo Rápido para Agentes de UI

1. **Estética Principal:** OLED Dark Minimalist (Canvas `#09090B`, Superfícies `#121215` / `#16161A`, Texto Primário `#F4F4F5`).
2. **Componentes Base:** Reutilizar estritamente as primitivas em `components/ui/` (`Button`, `Card`, `Input`, `Badge`). Proibido instalar bibliotecas UI de terceiros.
3. **Tipografia:** `Geist Sans` para títulos e corpo; `Geist Mono` para métricas, identificadores e tabelas.
4. **Acessibilidade:** Contraste mínimo 4.5:1, foco visível (`focus-visible:ring-2 focus-visible:ring-accent`), alvos de clique ≥ 44x44px, respeito integral a `[data-contrast="high"]` e `prefers-reduced-motion`.
5. **Carregamento sob Demanda:** Consulte as diretrizes visuais apenas ao trabalhar em ficheiros de páginas (`app/`), componentes (`components/`) ou estilos (`app/globals.css`). Ignorar em tarefas de backend e banco de dados.
