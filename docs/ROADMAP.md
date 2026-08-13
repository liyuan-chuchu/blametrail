# Roadmap

BlameTrail's roadmap is organized around maintainer outcomes rather than feature count.

## v0.1 — Evidence trail

- [x] Explain a committed line or range.
- [x] Connect commits to pull requests, reviews, and linked issues.
- [x] Review changed files for historical risk leads.
- [x] Text, Markdown, and JSON output.
- [x] Read-only GitHub Action.

## v0.2 — Revert intelligence

- [ ] Pair revert commits with the changes they undo.
- [ ] Detect reintroduced deleted code using Git pickaxe searches.
- [ ] Rank evidence by path overlap, recency, and explicit review language.
- [ ] Add recorded fixtures from mature public repositories.

## v0.3 — Maintainer integrations

- [ ] GitLab merge request and issue adapter.
- [ ] VS Code command for the current selection.
- [ ] Agent Skill for Codex, Claude Code, Cursor, and compatible runtimes.
- [ ] Stable JSON schema and integration contract.

## v1.0 — Trusted repository memory

- [ ] Optional local evidence index for large repositories.
- [ ] Decision cards that maintainers can curate and version.
- [ ] Optional citation-grounded summaries with provider-neutral model support.
- [ ] Performance budgets and compatibility test matrix for large monorepos.

The project will not require a hosted service, upload source by default, or turn heuristic flags into automated correctness verdicts.
