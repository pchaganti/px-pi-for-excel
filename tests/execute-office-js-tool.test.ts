import assert from "node:assert/strict";
import { test } from "node:test";

import { createExecuteOfficeJsTool } from "../src/tools/execute-office-js.ts";
import type { AppendWorkbookChangeAuditEntryArgs } from "../src/audit/workbook-change-audit.ts";

function firstText(result: { content: Array<{ type: string; text: string }> }): string {
  const block = result.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Expected first content block to be text.");
  }

  return block.text;
}

void test("execute_office_js runs code, serializes result, and appends audit entry", async () => {
  const auditEntries: AppendWorkbookChangeAuditEntryArgs[] = [];

  const tool = createExecuteOfficeJsTool({
    runCode: () => Promise.resolve({
      ok: true,
      sheet: "Sheet1",
      changedCells: 4,
    }),
    appendAuditEntry: (entry) => {
      auditEntries.push(entry);
      return Promise.resolve();
    },
  });

  const result = await tool.execute("tool-call-1", {
    explanation: "Recalculate dashboard totals",
    code: "return { ok: true };",
  });

  const text = firstText(result);
  assert.match(text, /Executed Office\.js: Recalculate dashboard totals/u);
  assert.match(text, /```json/u);
  assert.match(text, /"ok": true/u);

  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.toolName, "execute_office_js");
  assert.equal(auditEntries[0]?.blocked, false);
  assert.match(auditEntries[0]?.summary ?? "", /Recalculate dashboard totals/u);
});

void test("execute_office_js blocks nested Excel.run usage", async () => {
  const auditEntries: AppendWorkbookChangeAuditEntryArgs[] = [];
  let runCalled = false;

  const tool = createExecuteOfficeJsTool({
    runCode: () => {
      runCalled = true;
      return Promise.resolve(null);
    },
    appendAuditEntry: (entry) => {
      auditEntries.push(entry);
      return Promise.resolve();
    },
  });

  const result = await tool.execute("tool-call-2", {
    explanation: "Update workbook",
    code: "return Excel.run(async (context) => { await context.sync(); });",
  });

  const text = firstText(result);
  assert.match(text, /Do not call Excel\.run\(\)/u);
  assert.equal(runCalled, false);

  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.blocked, true);
});

void test("execute_office_js reports non-serializable result payloads", async () => {
  const auditEntries: AppendWorkbookChangeAuditEntryArgs[] = [];
  const circular: { self?: unknown } = {};
  circular.self = circular;

  const tool = createExecuteOfficeJsTool({
    runCode: () => Promise.resolve(circular),
    appendAuditEntry: (entry) => {
      auditEntries.push(entry);
      return Promise.resolve();
    },
  });

  const result = await tool.execute("tool-call-3", {
    explanation: "Inspect workbook state",
    code: "return {};",
  });

  const text = firstText(result);
  assert.match(text, /Result is not JSON-serializable/u);

  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.blocked, true);
});
