# Refactor Execution Plan (Phase 1)

**Date:** 2026-02-13  
**Scope:** Execute the two highest-ROI refactors from `docs/archive/deep-refactor-review-2026-02-13.md`:
1. Recovery subsystem modularization
2. Shared mutation-tool pipeline extraction

---

## Goals

- Reduce complexity hotspots without changing behavior.
- Keep all public tool contracts and persisted storage keys stable.
- Make recovery and mutation paths easier to extend/test safely.

### Success criteria

- `src/workbook/recovery-states.ts` and `src/workbook/recovery-log.ts` become thin facades.
- Mutation tools share common audit/checkpoint/result-note helpers.
- Existing tests remain green; targeted new tests added where extraction introduces risk.

---

## Non-goals (for this phase)

- No UX redesign.
- No new tool behavior.
- No migration of persisted snapshot schema (`workbook.recovery-snapshots.v1`).
- No performance tuning/chunking work (that is Phase 4 from the review).

---

## Guardrails

- **Strict compatibility:** preserve these APIs/signatures:
  - `getWorkbookRecoveryLog()`
  - `captureFormatCellsState`, `applyFormatCellsState`
  - `captureModifyStructureState`, `applyModifyStructureState`
  - `captureConditionalFormatState`, `applyConditionalFormatState`
  - `captureCommentThreadState`, `applyCommentThreadState`
- **No tool copy changes unless unavoidable** (to avoid snapshot/golden test churn).
- **Small PRs only**: each PR should be reviewable independently and pass gates.

---

## PR-by-PR plan

## PR 0 — Baseline + guard tests (prep)

**Purpose:** freeze expected behavior before structural extraction.

### Changes
- Add baseline assertions where coverage is thin around recovery restore paths:
  - structure states (`sheet_absent/present`, rows, columns)
  - conditional format rule round-trips
  - comment thread restore round-trips
- Add a short developer note to `docs/codebase-simplification-plan.md` linking this execution plan.

### Validation
- `npm run check`
- `npm run test:context`
- `npm run build`

### Exit criteria
- Baseline tests protect current behavior before refactor starts.

---

## PR 1 — Create recovery package structure + compatibility facades

**Purpose:** establish modular boundaries with near-zero behavior change.

### Changes
- Create new folder:
  - `src/workbook/recovery/`
- Add foundational modules:
  - `types.ts` (public recovery types)
  - `guards.ts` (type guards)
  - `clone.ts` (clone helpers)
  - `address.ts` (address/range parsing helpers)
- Keep existing entrypoints as facades:
  - `src/workbook/recovery-states.ts` re-exports from new modules (no call-site churn initially).

### Validation
- `npm run check`
- `node --test --experimental-strip-types tests/workbook-recovery-log.test.ts`
- `npm run build`

### Exit criteria
- No behavior change; module boundaries ready for incremental extraction.

---

## PR 2 — Extract format-state capture/apply logic

**Purpose:** isolate the most complex subset first.

### Changes
- New modules:
  - `src/workbook/recovery/format-state.ts`
  - `src/workbook/recovery/format-selection.ts`
- Move from `recovery-states.ts`:
  - format selection planning helpers
  - capture logic (`captureFormatCellsState` and internals)
  - apply logic (`applyFormatCellsState` and internals)
  - format cell-count estimation (`estimateFormatCaptureCellCount`)
- Keep exports stable via facade.

### Validation
- `npm run check`
- `node --test --experimental-strip-types tests/workbook-recovery-log.test.ts`
- `npm run build`

### Exit criteria
- `recovery-states.ts` shrinks substantially with format logic removed.

---

## PR 3 — Extract structure / conditional-format / comment state logic

**Purpose:** complete recovery-state decomposition.

### Changes
- New modules:
  - `src/workbook/recovery/structure-state.ts`
  - `src/workbook/recovery/conditional-format-state.ts`
  - `src/workbook/recovery/comment-state.ts`
- Move capture/apply logic and rule handlers out of `recovery-states.ts`.
- Keep existing exports and behavior via facade.

### Validation
- `npm run check`
- `node --test --experimental-strip-types tests/workbook-recovery-log.test.ts`
- `npm run build`

### Exit criteria
- `recovery-states.ts` reduced to orchestration + re-exports.

---

## PR 4 — Split recovery log into codec/store/restore modules

**Purpose:** reduce `recovery-log.ts` complexity while preserving runtime behavior.

### Changes
- New modules:
  - `src/workbook/recovery/log-codec.ts` (payload parsing/serialization)
  - `src/workbook/recovery/log-store.ts` (settings load/persist + filtering)
  - `src/workbook/recovery/log-restore.ts` (restore strategy by snapshot kind)
- Keep public class API stable:
  - `WorkbookRecoveryLog`
  - `getWorkbookRecoveryLog()`
- Persisted key and schema remain unchanged:
  - `workbook.recovery-snapshots.v1`

### Validation
- `npm run check`
- `node --test --experimental-strip-types tests/workbook-recovery-log.test.ts`
- `npm run build`

### Exit criteria
- `recovery-log.ts` becomes thin composition root.

---

## PR 5 — Introduce shared mutation pipeline helpers (first migration set)

**Purpose:** remove duplication across primary cell mutation tools.

### Changes
- New module(s):
  - `src/tools/mutation/finalize.ts`
  - `src/tools/mutation/result-note.ts`
  - `src/tools/mutation/types.ts`
- Shared responsibilities:
  - append checkpoint note consistently
  - checkpoint created/unavailable wiring
  - snapshot-created event dispatch helper
  - standardized audit append wrappers
- Migrate first set:
  - `src/tools/write-cells.ts`
  - `src/tools/fill-formula.ts`
  - `src/tools/python-transform-range.ts`

### Validation
- `npm run check`
- `node --test --experimental-strip-types tests/tool-result-shaping.test.ts tests/workbook-recovery-log.test.ts tests/workbook-change-audit.test.ts tests/python-transform-range-tool.test.ts`
- `npm run build`

### Exit criteria
- These tools no longer duplicate checkpoint/audit plumbing.

---

## PR 6 — Migrate remaining mutating tools to shared pipeline

**Purpose:** finish consistency pass for mutation/recovery/audit flows.

### Changes
- Migrate where applicable:
  - `src/tools/format-cells.ts`
  - `src/tools/modify-structure.ts`
  - `src/tools/comments.ts`
  - `src/tools/conditional-format.ts`
  - `src/tools/view-settings.ts` (non-checkpointed mutation path)
  - `src/tools/workbook-history.ts` (restore audit path alignment)
- Remove local helper duplication (`appendResultNote`, repeated checkpoint fallbacks, etc.).

### Validation
- `npm run check`
- `npm run test:context`
- `npm run build`

### Exit criteria
- Mutation behavior remains same, but instrumentation/recovery plumbing is centralized.

---

## PR 7 — Test decomposition + docs closeout

**Purpose:** reduce future maintenance burden and finalize documentation.

### Changes
- Split `tests/workbook-recovery-log.test.ts` into focused files:
  - `tests/recovery-log-persistence.test.ts`
  - `tests/recovery-log-restore.test.ts`
  - `tests/recovery-log-format.test.ts`
  - `tests/recovery-log-structure.test.ts`
- Update docs:
  - `docs/codebase-simplification-plan.md`
  - `src/tools/DECISIONS.md` (only if any implementation details changed)

### Validation
- `npm run check`
- `npm run test:context`
- `npm run build`

### Exit criteria
- Phase 1 complete with smaller modules + clearer tests + updated docs.

---

## Risk register

1. **Risk:** subtle restore behavior regression after extraction.  
   **Mitigation:** PR0 baseline tests + PR2/PR3/PR4 targeted test runs.

2. **Risk:** accidental output text drift in mutation tools.  
   **Mitigation:** keep content strings unchanged; only centralize plumbing.

3. **Risk:** increased import churn creates cyclic dependencies.  
   **Mitigation:** keep recovery modules dependency direction one-way (`types/guards` → domain modules → facade).

4. **Risk:** long-lived PRs become hard to review.  
   **Mitigation:** keep PRs scoped to one extraction axis each.

---

## Suggested execution order and effort

- PR0: 0.5 day
- PR1: 0.5 day
- PR2: 1 day
- PR3: 1 day
- PR4: 1 day
- PR5: 1 day
- PR6: 1 day
- PR7: 0.5 day

**Total:** ~6.5 developer-days (can be parallelized partly after PR1).

---

## Ready-to-start sequence

If executing immediately, start with:
1. PR0 (baseline tests)
2. PR1 (recovery package scaffolding)
3. PR2 (format-state extraction)

These three PRs derisk the rest of the phase and keep behavioral confidence high.
