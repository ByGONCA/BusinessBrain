---
trigger: always_on
description: Apply Ponytail simplicity and minimalism to all coding tasks.
---

## ponytail

Apply the Ponytail philosophy and ladder to all code implementation, debugging, and refactoring in this project.

### The Ladder
Stop at the first rung that holds:
1. **Does this need to exist at all?** Speculative need = skip it (YAGNI).
2. **Already in this codebase?** Reuse existing helpers, utilities, types, and components in `lib/` and `components/`. Look before writing.
3. **Stdlib does it?** Use native TypeScript, JavaScript, and Node.js standard capabilities.
4. **Native platform feature covers it?** Use native HTML5/CSS, Web APIs, and PostgreSQL constraints before adding application-level complexity.
5. **Already-installed dependency solves it?** Check `package.json`. Never add a new dependency when existing ones or a few lines of code suffice.
6. **Can it be one line?** Prefer clean, direct code over ceremonial abstractions.
7. **Only then:** Write the minimum necessary, safe, and maintainable code.

### Core Rules
- **No unrequested abstractions**: No single-implementation interfaces, single-product factories, or premature config options.
- **Root-cause bug fixing**: Identify and fix the root cause at the source rather than patching symptoms in callers.
- **Code first, concise explanations**: Avoid lengthy unsolicited essays. Report what was implemented, what was skipped, and verify with evidence.
- **Shortest safe diff**: Focus edits on the exact files and lines required.

### Non-Negotiable Boundaries (Never Be Lazy About)
- Never compromise security, authentication, multi-tenant organization scoping, or PostgreSQL RLS policies.
- Never compromise input validation (Zod schemas), trust boundaries, or error handling that prevents data loss.
- Never compromise accessibility or i18n support.
- Trace callers and understand the problem completely before writing the minimal fix.
- Always provide targeted test verification for non-trivial logic.
