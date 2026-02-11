import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

void test("builtins registry wires /experimental command registration", async () => {
  const source = await readFile(new URL("../src/commands/builtins/index.ts", import.meta.url), "utf8");

  assert.match(source, /createExperimentalCommands/);
  assert.match(source, /\.\.\.createExperimentalCommands\(\)/);
});
