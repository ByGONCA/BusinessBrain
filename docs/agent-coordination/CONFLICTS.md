# Shared Files, High-Conflict Areas & Ownership Matrix

Parallel development across six independent branches risks Git merge conflicts and regressions if multiple agents edit the same critical files. This document establishes **single-owner responsibility** and **rules of engagement** for all shared files.

---

## 1. Shared Files Ownership Matrix

| Shared File / Area | Primary Owner | Secondary Stakeholders | Rules of Engagement |
|---|---|---|---|
| `package.json` & `package-lock.json` | **LEAD / QA** | All Agents | **Ponytail Rule**: Never add dependencies unless strictly necessary. Propose additions via handoff ticket. Only primary owner approves package additions. |
| `app/layout.tsx` | **DESIGN** | Security, Product | Design owns layout shell, font imports, and theme providers. Security injects headers/CSP. Backend/Billing do not edit. |
| `middleware.ts` / `proxy.ts` | **SECURITY** | Backend, Lead | Security owns authentication middleware, route guards, and active workspace cookie validation. |
| `database/migrations/` | **BACKEND** | Security | Backend drafts SQL migrations; Security must review every RLS policy before merging. Never edit past migrations. |
| `lib/supabase/client.ts`, `server.ts` | **SECURITY** | Backend | Core auth & client factory. Strict SSR cookie handling. Never re-introduce service role key to user sessions. |
| `lib/i18n/dictionaries/*.ts` | **PRODUCT** | Design | Product owns copy in `en.ts`, `pt.ts`, `es.ts`, `fr.ts`. Design references keys. All 4 locales must remain synchronized. |
| `components/dashboard/sidebar.tsx` | **DESIGN** | Product | Navigation hierarchy, responsive drawer, icons. Links added only for approved routes. |
| `components/dashboard/home/` | **DESIGN** | Backend, Product | Executive home dashboard container. Backend provides data loaders; Design owns layout and rendering. |
| `.env.example` | **LEAD / SECURITY** | All Agents | Documents public and server variables. Zero secrets. Verified by `npm run env:check`. |
| `tailwind.config.ts` | **DESIGN** | Lead | Design tokens, color palette, animations. No ad-hoc classes that break the design system. |
| `tsconfig.json` & `next.config.ts` | **LEAD / QA** | Backend | Strict typechecking options, Next.js build configuration, image domains. |

---

## 2. Rules for Modifying Shared Files

1. **Check Ownership**: Before touching a shared file, determine whether your agent is the **Primary Owner**.
2. **If You Are Not the Primary Owner**:
   - Prefer isolating your changes to your own domain files (e.g., create a dedicated component or service module in `lib/<your-domain>/` and export a clean function).
   - If modification of the shared file is strictly necessary, submit a `Shared File Change Request` using the handoff template.
3. **Shortest Safe Diff (Ponytail Ladder)**:
   - When editing shared files, make the smallest possible diff.
   - Do NOT run auto-formatters that re-order imports or reformat unchanged lines.
   - Preserving existing comments, types, and logic is mandatory.
4. **Pre-Merge Rebase Check**:
   - The Lead Architect checks the diff of shared files against `main` before approving any integration.
