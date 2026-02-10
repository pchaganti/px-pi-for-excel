/**
 * Shared compaction defaults.
 *
 * These mirror pi-coding-agent defaults (see
 * /opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/compaction.md).
 */

export const DEFAULT_COMPACTION_RESERVE_TOKENS = 16_384;
export const DEFAULT_COMPACTION_KEEP_RECENT_TOKENS = 20_000;

/**
 * Reserve token budget used to ensure we always have room for the model's response.
 *
 * Pi uses a fixed default (16,384). For smaller context windows, we clamp to
 * half the context window (and a small minimum) to avoid pathological behavior.
 */
export function effectiveReserveTokens(contextWindow: number): number {
  return Math.min(
    DEFAULT_COMPACTION_RESERVE_TOKENS,
    Math.max(256, Math.floor(contextWindow / 2)),
  );
}

/**
 * How many tokens of the recent conversation to keep verbatim after compaction.
 *
 * Pi defaults to 20k. For smaller context windows, clamp so that the kept tail
 * fits into the prompt budget (contextWindow - reserveTokens).
 */
export function effectiveKeepRecentTokens(contextWindow: number, reserveTokens: number): number {
  return Math.min(
    DEFAULT_COMPACTION_KEEP_RECENT_TOKENS,
    Math.max(0, contextWindow - reserveTokens),
  );
}
