# Release Smoke Runs

This folder stores timestamped smoke-run evidence for release prep (#179).

## Naming

Use `YYYY-MM-DD-<platform>-<scope>.md`.

Examples:
- `2026-02-14-macos-preflight.md`
- `2026-02-14-windows-install-login.md`

## Minimum contents

- commit SHA tested
- environment/platform details
- checklist IDs covered (from `docs/release-smoke-test-checklist.md`)
- pass/fail/blocked with short rationale and evidence pointers

Keep each run append-only; create a new file for each run instead of rewriting older runs.
