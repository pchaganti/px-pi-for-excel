import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveTabTitle } from "../src/taskpane/session-title.ts";

void test("resolveTabTitle uses explicit title when provided", () => {
  assert.equal(
    resolveTabTitle({
      hasExplicitTitle: true,
      sessionTitle: "  Revenue Model  ",
      tabIndex: 2,
    }),
    "Revenue Model",
  );
});

void test("resolveTabTitle falls back to Chat N when no explicit title", () => {
  assert.equal(
    resolveTabTitle({
      hasExplicitTitle: false,
      sessionTitle: "Please can we do ...",
      tabIndex: 0,
    }),
    "Chat 1",
  );
});

void test("resolveTabTitle falls back to Chat N when explicit title is blank", () => {
  assert.equal(
    resolveTabTitle({
      hasExplicitTitle: true,
      sessionTitle: "   ",
      tabIndex: 3,
    }),
    "Chat 4",
  );
});
