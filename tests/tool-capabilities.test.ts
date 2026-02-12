import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

import {
  buildCoreToolPromptLines,
  CORE_TOOL_CAPABILITIES,
  UI_TOOL_NAMES,
} from "../src/tools/capabilities.ts";
import { CORE_TOOL_NAMES } from "../src/tools/names.ts";
import { buildSystemPrompt } from "../src/prompt/system-prompt.ts";

void test("core capability metadata covers all core tools", () => {
  assert.equal(CORE_TOOL_CAPABILITIES.length, CORE_TOOL_NAMES.length);

  const capabilityNames = CORE_TOOL_CAPABILITIES.map((capability) => capability.name);
  assert.deepEqual(capabilityNames, [...CORE_TOOL_NAMES]);

  for (const capability of CORE_TOOL_CAPABILITIES) {
    assert.equal(capability.tier, "core");
    assert.ok(capability.promptDescription.length > 0);
  }
});

void test("system prompt core tool section is generated from capability metadata", () => {
  const prompt = buildSystemPrompt();
  const toolLines = buildCoreToolPromptLines();

  for (const line of toolLines.split("\n")) {
    assert.equal(prompt.includes(line), true);
  }
});

void test("UI tool registration derives from centralized UI tool names", async () => {
  const rendererSource = await readFile(new URL("../src/ui/tool-renderers.ts", import.meta.url), "utf8");
  assert.match(rendererSource, /import\s*\{\s*UI_TOOL_NAMES/);
  assert.match(rendererSource, /CUSTOM_RENDERED_TOOL_NAMES:\s*readonly SupportedToolName\[\]\s*=\s*UI_TOOL_NAMES/);

  const uniqueNames = new Set(UI_TOOL_NAMES);
  assert.equal(uniqueNames.size, UI_TOOL_NAMES.length);
  assert.ok(UI_TOOL_NAMES.includes("execute_office_js"));
});
