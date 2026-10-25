# Graphify Knowledge Graph (Reference & Local Tool Documentation)

> **Status**: Local Optional Tool (Installed in `.venv/Scripts/graphify.exe`, v0.9.92).  
> **Environment**: Not on system-wide `PATH` by default. Accessible via `.venv/Scripts/graphify.exe`. Existing static visual artifacts remain available under `graphify-out/` (`graph.html`, `graph.json`).

---

## 1. Capabilities & Usage

This project has a pre-indexed knowledge graph at `graphify-out/` (last extracted 18/10/2026).

### Relationship to Codebase Map & Investigation
- **Primary**: Always consult `docs/CODEBASE_MAP.md` first. It provides immediate, zero-token, up-to-date lookups for files, domains, routes, and migrations.
- **Secondary / Optional**: Use Graphify only when deep cross-module call-graph tracing or dependency visual clustering is explicitly requested.

### Local Execution Commands (via `.venv`)
- **Query**: `& .venv/Scripts/graphify.exe query "<question>"`
- **Shortest Path**: `& .venv/Scripts/graphify.exe path "<NodeA>" "<NodeB>"`
- **Explain Node**: `& .venv/Scripts/graphify.exe explain "<concept>"`
- **Update Graph**: `& .venv/Scripts/graphify.exe update .` (re-extracts AST relationships)
- **Interactive Visual**: Open `graphify-out/graph.html` directly in the browser.
