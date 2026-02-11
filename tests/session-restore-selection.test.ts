import assert from "node:assert/strict";
import { test } from "node:test";

import { getRestoreCandidateSessionIds } from "../src/taskpane/sessions.ts";

void test("known workbook restores only workbook-linked latest session", () => {
  const candidates = getRestoreCandidateSessionIds({
    workbookId: "url_sha256:workbook-a",
    workbookLatestSessionId: "session-a",
    globalLatestSessionId: "session-global",
  });

  assert.deepEqual(candidates, ["session-a"]);
});

void test("known workbook with no workbook-linked latest does not fall back to global", () => {
  const candidates = getRestoreCandidateSessionIds({
    workbookId: "url_sha256:workbook-b",
    workbookLatestSessionId: null,
    globalLatestSessionId: "session-global",
  });

  assert.deepEqual(candidates, []);
});

void test("unknown workbook falls back to global latest", () => {
  const candidates = getRestoreCandidateSessionIds({
    workbookId: null,
    workbookLatestSessionId: "session-workbook",
    globalLatestSessionId: "session-global",
  });

  assert.deepEqual(candidates, ["session-global"]);
});

void test("candidate selection normalizes empty session IDs", () => {
  const candidates = getRestoreCandidateSessionIds({
    workbookId: null,
    workbookLatestSessionId: "",
    globalLatestSessionId: "   ",
  });

  assert.deepEqual(candidates, []);
});
