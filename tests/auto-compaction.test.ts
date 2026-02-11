import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldAutoCompactForProjectedTokens } from "../src/compaction/auto-compaction.ts";

void test("does not trigger auto-compaction before hard threshold", () => {
  const shouldCompact = shouldAutoCompactForProjectedTokens({
    projectedTokens: 169_999,
    contextWindow: 200_000,
  });

  assert.equal(shouldCompact, false);
});

void test("triggers auto-compaction after hard threshold", () => {
  const shouldCompact = shouldAutoCompactForProjectedTokens({
    projectedTokens: 170_001,
    contextWindow: 200_000,
  });

  assert.equal(shouldCompact, true);
});

void test("small context windows still use reserve-based hard threshold", () => {
  const below = shouldAutoCompactForProjectedTokens({
    projectedTokens: 16_384,
    contextWindow: 32_768,
  });
  const above = shouldAutoCompactForProjectedTokens({
    projectedTokens: 16_385,
    contextWindow: 32_768,
  });

  assert.equal(below, false);
  assert.equal(above, true);
});
