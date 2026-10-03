# Company Brain

> **The memory and intelligence layer for modern companies.**

Company Brain is an enterprise operating system built to unify company knowledge, decisions, projects, tasks, meetings, and business context, providing a unified foundation for future AI operations.

---

## Architecture & Principles

- **Multi-Tenant First**: Organizations represent isolated workspaces. A user can belong to multiple organizations with granular roles (`owner`, `admin`, `member`).
- **Database-Level Isolation**: Supabase PostgreSQL Row Level Security (RLS) guarantees complete tenant isolation.
- **Modern Next.js Architecture**: Next.js App Router with Server Components, Server Actions, and `@supabase/ssr` cookie-based authentication.
- **Prepared for Multi-Platform**: Clean domain interfaces and token-friendly authentication ready for future iOS, Android, macOS, and Windows clients.
- **Decoupled AI & Billing Modules**: Stripe and Google Gemini are isolated behind clean abstraction layers (`lib/stripe/` and `lib/ai/`) without introducing tight couplings or premature features.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Storage, RLS)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Validation**: [Zod](https://zod.dev/)
- **Billing Preparation**: [Stripe](https://stripe.com/)
- **AI Abstraction**: [Google Gemini](https://ai.google.dev/)

---

## Directory Structure

```text
app/
  (marketing)/        # Public landing page
  (auth)/             # Login, signup, auth callback routes
  onboarding/         # Organization creation flow for new users
  dashboard/          # Authenticated workspace dashboard
    brain/            # AI brain placeholder
    knowledge/        # Company knowledge base
    projects/         # Projects management
    tasks/            # Action items & tasks
    meetings/         # Meeting notes & summaries
    decisions/        # Architectural and business decisions
    settings/         # Workspace and member settings
  api/                # Webhook & API endpoints
components/
  ui/                 # Design system primitives (buttons, inputs, cards, dialogs)
  layout/             # Common layout wrappers
  dashboard/          # Dashboard sidebar, top nav, org switcher, user menu
lib/
  supabase/           # Supabase client, server, admin, middleware
  organizations/      # Workspace actions, queries, membership management
  auth/               # Session handling & authentication actions
  stripe/             # Stripe configuration, plans, webhook verification
  ai/                 # AI provider interface & Gemini abstraction
database/
  migrations/         # SQL migration scripts (schema, RLS policies)
docs/                 # Comprehensive system documentation
```

---

## Getting Started

### 1. Prerequisites
- Node.js 18.18+ (tested on Node 20 / 22 / 24)
- npm or pnpm
- A Supabase project (local CLI or [supabase.com](https://supabase.com))

### 2. Environment Setup
Copy the environment variables template:
```bash
cp .env.example .env.local
```
Fill in your credentials from the Supabase dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 3. Database Migrations
Apply the migrations in `database/migrations/` via the Supabase SQL editor or Supabase CLI:
1. `00001_initial_schema.sql` (Creates `profiles`, `organizations`, `organization_members` tables and triggers)
2. `00002_rls_policies.sql` (Enables Row Level Security and security definer isolation policies)

### 4. Install Dependencies & Run Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation

- [AGENTS.md](AGENTS.md) — Architecture invariants & rules for AI assistants
- [docs/PRODUCT.md](docs/PRODUCT.md) — Product vision & MVP specification
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture & security boundaries
- [docs/DATABASE.md](docs/DATABASE.md) — Database design, RLS policies & future entities
- [docs/ROADMAP.md](docs/ROADMAP.md) — Phase 0 through Phase 6 roadmap
