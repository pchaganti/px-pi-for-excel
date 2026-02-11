# Context Management Policy (cache-safe)

**Status:** Active policy (2026-02-11)  
**Scope:** How Pi for Excel builds model context across normal turns, tool loops, and long sessions **without regressing prompt caching**.

---

## Why this exists

We optimize for **answer quality and stability first**, then token/cost.

In practice, quality drops when we repeatedly inject low-signal context (large tool schemas, stale tool outputs, oversized workbook snapshots), even if caching reduces billed tokens.

This policy sets clear guardrails so we can improve context quality while preserving cache performance.

---

## Current baseline (implemented)

- Each model call is built from: `systemPrompt + messages + tools`.
- Tool-result continuation calls strip `tools` in `src/auth/stream-proxy.ts` (`isToolContinuation()`).
- Session IDs are stable per chat runtime (`agent.sessionId`), which is used by providers for cache continuity.
- Status/debug UI already shows payload composition counters (`systemChars`, `toolSchemaChars`, `messageChars`, call count).

---

## Cache-preserving invariants (must hold)

1. **Stable session identity**
   - Keep `agent.sessionId` stable for the lifetime of a session.

2. **Stable base prompt inside a session**
   - Treat the base system prompt as immutable during a session.
   - Avoid per-turn noise in the system prompt.

3. **Deterministic tool schemas**
   - Deterministic order for tools/schemas.
   - No random IDs/timestamps in tool descriptions/schemas.

4. **Dynamic context at the tail**
   - Put volatile data (selection, recent edits, latest tool outputs) near the end of message history.

5. **Discrete context resets only**
   - Compaction should be explicit/discrete, not continuous churn.

---

## Policy by context layer

| Layer | Policy | Reinjection trigger |
|---|---|---|
| Base system prompt | Keep minimal and stable per session | Every call (provider APIs are request-based) |
| Tool schemas | Include on first call after user turn; strip on tool-result continuations | First call only |
| Workbook structural context | Inject as separate context block (not baked repeatedly into base prompt) | Session start + workbook hash/version change |
| Per-turn auto-context (selection + recent changes) | Keep bounded and high-signal | Per user turn when non-empty |
| Tool results in model-facing history | Keep fresh full detail short-term, summarize/prune older bulky outputs | On pressure/threshold |
| Compaction | Trigger before hard limits to protect quality | Soft and hard thresholds |

---

## Implementation plan (next slices)

### Slice 1 — Payload snapshots (observability first)

**Goal:** make optimization decisions with real payload evidence.

- Add a small ring buffer of recent request snapshots (debug-only).
- Retention defaults:
  - keep the latest **24 request snapshots**
  - keep latest-context entries for up to **24 sessions**
  - rationale: enough history to inspect multi-step tool loops while keeping taskpane memory bounded
- Capture, per call:
  - call index
  - continuation vs first call
  - tools included yes/no
  - section sizes (system/tool/messages)
  - optional provider payload shape via `onPayload` (redacted)

**Success:** we can compare before/after context composition on real sessions without guesswork.

---

### Slice 2 — Cache-safe progressive tool disclosure

**Goal:** reduce first-call schema weight without cache thrash.

- Define a few fixed tool bundles (example: `core`, `analysis`, `formatting`, `structure`).
- Select bundle by intent/routing, but keep bundle definitions stable and deterministic.
- Preserve a manual fallback to expose all tools.

**Success:** lower average `toolSchemaChars` while maintaining stable cache patterns.

---

### Slice 3 — Tool-result history shaping

**Goal:** cut transcript noise from large tool outputs.

- Add model-facing truncation/summarization for older or oversized tool results.
- Keep full raw output in UI/tool cards (no loss of user-visible detail).
- Keep recency window for exact details (latest N tool results untouched).

**Success:** lower message-context growth rate with no UX regression.

---

### Slice 4 — Workbook context invalidation policy

**Goal:** refresh structural workbook context only when necessary.

- Compute workbook context hash/version from structural signals.
- Reinject structural context on hash/version change, workbook switch, or explicit refresh.
- Avoid re-sending large workbook snapshots every turn.

**Success:** fewer large context swings; better cache reuse.

---

### Slice 5 — Compaction tuning + hygiene UX

**Goal:** protect quality earlier in long threads.

- Tune soft/hard compaction thresholds for earlier quality protection.
- Keep compaction summary compact and action-oriented.
- Add easier “summarize + start fresh” flow for noisy sessions.

**Success:** fewer degraded late-thread responses.

---

## Verification checklist (each slice)

- `npm run check`
- `npm run build`
- `npm run test:models`
- Manual Excel smoke test (read/write/format flow)
- Real-session payload comparison with debug snapshots:
  - tools included only where expected
  - `toolSchemaChars` down (target: meaningful reduction)
  - cache usage remains healthy (`cacheRead`/`cacheWrite` trend not regressing)

---

## Non-goals

- We are **not** replacing provider caching behavior.
- We are **not** changing user-visible tool result text as part of metadata-only slices.
- We are **not** introducing transport-level append semantics in this phase.

---

## Open decisions

1. Exact tool bundle definitions + routing heuristics.
2. Tool-result shaping thresholds (size and recency).
3. Workbook hash signal set (what counts as structural change).
4. Soft/hard compaction thresholds by model family.
