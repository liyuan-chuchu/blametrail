# Agent guide

## Project intent

BlameTrail reconstructs evidence for why code exists. It is a read-only, local-first developer tool. Its output must distinguish verifiable evidence from heuristic leads.

## Commands

- Install dependencies: `npm ci`
- Type-check: `npm run check`
- Build: `npm run build`
- Test: `npm test`
- Package inspection: `npm pack --dry-run`

## Non-negotiable invariants

1. Never modify the analyzed repository.
2. Never accept credentials as CLI arguments or print credentials.
3. Local analysis must work without GitHub, a model, a daemon, or a database.
4. Remote claims must carry a source URL whenever GitHub provides one.
5. Risk flags are leads, not findings; user-facing copy must say so.
6. Bound remote requests and text excerpts. Avoid unbounded repository scans.
7. Preserve Windows, macOS, and Linux behavior.
8. Add a regression test for every parsing or evidence-ranking bug.

## Structure

- `src/git.ts`: local Git execution, parsing, history, and deterministic flags.
- `src/github.ts`: read-only GitHub REST API adapter.
- `src/analyze.ts`: evidence orchestration for `explain` and `review`.
- `src/format.ts`: text, Markdown, and JSON presentation.
- `src/cli.ts`: CLI parsing and process boundary.
- `src/action.ts`: GitHub Action entry point.

Keep provider-specific data behind adapters. Avoid adding runtime dependencies unless a standard Node API cannot safely perform the task.
