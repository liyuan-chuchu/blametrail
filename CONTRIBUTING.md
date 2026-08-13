# Contributing to BlameTrail

Thanks for helping maintainers recover the context behind code changes.

## Before opening a change

- Search existing issues and pull requests.
- For a new integration or large feature, open a short design issue first.
- Do not include repository tokens, private history, or copied private discussions in fixtures.

## Development

Requirements: Node.js 20 or newer and Git.

```bash
npm ci
npm run check
npm test
```

Run the CLI from a built checkout:

```bash
npm run build
node dist/cli.js explain src/git.ts:1 --offline
```

## Pull requests

- Keep changes focused and explain the maintainer problem being solved.
- Add or update tests for behavior changes.
- Preserve the read-only and evidence-first invariants in `AGENTS.md`.
- Update the README or architecture document when user-visible behavior changes.
- Add a changelog entry under `Unreleased`.

By contributing, you agree that your contribution is licensed under Apache-2.0.
