# Architecture

BlameTrail is intentionally a small pipeline with explicit trust boundaries.

```text
file:line or PR number
        |
        v
local Git evidence -----> GitHub read-only enrichment
        |                         |
        +------------+------------+
                     v
          deterministic risk leads
                     |
                     v
            text / Markdown / JSON
```

## Local evidence

`src/git.ts` calls the installed Git executable with argument arrays rather than shell strings. This avoids shell interpolation and preserves the repository's native Git behavior.

- `git blame --line-porcelain` maps selected lines to commits.
- `git show` provides commit metadata and a bounded patch excerpt.
- `git log --follow` provides recent and risk-bearing history for changed files.

Targets are resolved against the repository root and rejected if they escape it.

## Remote enrichment

`src/github.ts` uses read-only GitHub REST endpoints:

- pull requests associated with a commit;
- pull request metadata and changed files;
- pull request reviews;
- explicitly linked issues.

Public repositories work without authentication at GitHub's lower anonymous rate limit. `GITHUB_TOKEN` or `GH_TOKEN` can provide private-repository access and higher limits.

The remote layer never receives source code from BlameTrail. GitHub naturally already stores the repository and its pull request data; requests contain repository coordinates, commit SHAs, and pull or issue numbers.

## Risk leads

The first release uses transparent keyword rules. They are cheap, deterministic, inspectable, and work offline. A flag means "inspect this history," not "this change is wrong."

Future semantic ranking must remain optional and cite the deterministic evidence it summarizes.

## Output

The analysis layer returns typed reports independent of presentation. Formatters produce:

- concise terminal text;
- Markdown suitable for a workflow summary or maintainer discussion;
- stable JSON for editor and agent integrations.

## GitHub Action

The compiled action reads the pull request event, runs the same review pipeline, appends Markdown to `GITHUB_STEP_SUMMARY`, and exposes the report as an output. It intentionally does not post a comment, approve a pull request, or modify files.
