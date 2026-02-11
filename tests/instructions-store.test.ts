import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyInstructionAction,
  getUserInstructions,
  getWorkbookInstructions,
  hasAnyInstructions,
  setUserInstructions,
  setWorkbookInstructions,
  type InstructionsStore,
} from "../src/instructions/store.ts";

class MemoryStore implements InstructionsStore {
  private values = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.get(key));
  }

  set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

void test("append action adds new text on a new line", () => {
  const updated = applyInstructionAction({
    currentValue: "Use EUR",
    action: "append",
    content: "Check circular refs",
  });

  assert.equal(updated, "Use EUR\nCheck circular refs");
});

void test("replace action clears instructions when content is blank", () => {
  const updated = applyInstructionAction({
    currentValue: "Use EUR",
    action: "replace",
    content: "   ",
  });

  assert.equal(updated, null);
});

void test("user and workbook instructions round-trip through storage", async () => {
  const store = new MemoryStore();

  await setUserInstructions(store, "Always use dd-mmm-yyyy");
  await setWorkbookInstructions(store, "url_sha256:abc", "Summary sheet is read-only");

  assert.equal(await getUserInstructions(store), "Always use dd-mmm-yyyy");
  assert.equal(
    await getWorkbookInstructions(store, "url_sha256:abc"),
    "Summary sheet is read-only",
  );
});

void test("hasAnyInstructions reports active state correctly", () => {
  assert.equal(
    hasAnyInstructions({
      userInstructions: null,
      workbookInstructions: null,
    }),
    false,
  );

  assert.equal(
    hasAnyInstructions({
      userInstructions: "Use EUR",
      workbookInstructions: null,
    }),
    true,
  );
});
