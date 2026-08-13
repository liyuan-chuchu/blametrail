# Changelog

All notable changes to BlameTrail are documented here.

## Unreleased

### Fixed

- Accept global flags such as `--version` before a command.
- Avoid assigning unrelated risk flags from other hunks in a large commit.

## 0.1.0 - 2026-08-14

### Added

- `explain` command for line-level local Git evidence.
- GitHub pull request, review, and linked issue enrichment.
- `review` command for historical risk context across changed files.
- Text, Markdown, and JSON output formats.
- Read-only GitHub Action that writes a workflow summary.
- Deterministic flags for fixes, reverts, security, regressions, compatibility, performance, and workarounds.
- Windows, macOS, and Linux-compatible Node.js implementation.
