import assert from "node:assert/strict";
import { test } from "node:test";

import { getToolContextImpact, getToolExecutionMode } from "../src/tools/execution-policy.ts";

void test("classifies read_range as read with no workbook-context impact", () => {
  assert.equal(getToolExecutionMode("read_range", {}), "read");
  assert.equal(getToolContextImpact("read_range", {}), "none");
});

void test("classifies modify_structure as structure-impact mutate", () => {
  assert.equal(getToolExecutionMode("modify_structure", { action: "add_sheet" }), "mutate");
  assert.equal(getToolContextImpact("modify_structure", { action: "add_sheet" }), "structure");
});

void test("classifies comments read vs mutate actions", () => {
  assert.equal(getToolExecutionMode("comments", { action: "read" }), "read");
  assert.equal(getToolContextImpact("comments", { action: "read" }), "none");

  assert.equal(getToolExecutionMode("comments", { action: "delete" }), "mutate");
  assert.equal(getToolContextImpact("comments", { action: "delete" }), "content");
});

void test("unknown tools default to mutate with content impact", () => {
  assert.equal(getToolExecutionMode("extension_tool", { any: true }), "mutate");
  assert.equal(getToolContextImpact("extension_tool", { any: true }), "content");
});
