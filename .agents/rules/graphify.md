---
trigger: always_on
description: Consult the graphify knowledge graph at graphify-out/ for codebase and architecture questions.
---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- **Relationship to Codebase Map**: Consult `docs/CODEBASE_MAP.md` first for direct file, domain, route, and migration locations. Use Graphify as a complementary tool when deep semantic relationship tracing or AST call graphs are needed.
- For codebase relationship questions, when `graphify-out/graph.json` exists and the tool is available, use `graphify query "<question>"` (CLI) or `query_graph` (MCP). Use `graphify path "<A>" "<B>"` / `shortest_path` for relationships and `graphify explain "<concept>"` / `get_node` for focused concepts.
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- When modifying code files, run `graphify update .` only if the `graphify` CLI tool is available in your shell environment.
