import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSystemPrompt } from "../src/prompt/system-prompt.ts";

void test("system prompt includes default placeholders when instructions are absent", () => {
  const prompt = buildSystemPrompt();

  assert.match(prompt, /## Persistent Instructions/);
  assert.match(prompt, /\(No user instructions set\.\)/);
  assert.match(prompt, /\(No workbook instructions set\.\)/);
});

void test("system prompt embeds provided user and workbook instructions", () => {
  const prompt = buildSystemPrompt({
    userInstructions: "Always use EUR",
    workbookInstructions: "Summary sheet is read-only",
  });

  assert.match(prompt, /Always use EUR/);
  assert.match(prompt, /Summary sheet is read-only/);
  assert.match(prompt, /\*\*instructions\*\* tool/);
});
