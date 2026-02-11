import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCrossWorkbookResumeConfirmMessage,
  getResumeTargetLabel,
} from "../src/commands/builtins/resume-target.ts";
import { isReopenLastClosedShortcut } from "../src/taskpane/keyboard-shortcuts.ts";
import { RecentlyClosedStack } from "../src/taskpane/recently-closed.ts";
import {
  getRestoreCandidateSessionIds,
  shouldPersistSession,
} from "../src/taskpane/sessions.ts";

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

void test("session persistence guard allows forced saves before first assistant response", () => {
  assert.equal(
    shouldPersistSession({ firstAssistantSeen: false }),
    false,
  );
  assert.equal(
    shouldPersistSession({ firstAssistantSeen: false, force: true }),
    true,
  );
  assert.equal(
    shouldPersistSession({ firstAssistantSeen: true }),
    true,
  );
});

void test("recently closed stack reopens newest first and enforces max size", () => {
  const stack = new RecentlyClosedStack(2);

  stack.push({
    sessionId: "session-1",
    title: "One",
    closedAt: "2026-02-11T10:00:00.000Z",
    workbookId: "wb-a",
  });
  stack.push({
    sessionId: "session-2",
    title: "Two",
    closedAt: "2026-02-11T10:01:00.000Z",
    workbookId: "wb-a",
  });
  stack.push({
    sessionId: "session-3",
    title: "Three",
    closedAt: "2026-02-11T10:02:00.000Z",
    workbookId: "wb-b",
  });

  assert.equal(stack.size, 2);
  assert.deepEqual(
    stack.snapshot().map((item) => item.sessionId),
    ["session-3", "session-2"],
  );

  assert.equal(stack.popMostRecent()?.sessionId, "session-3");
  assert.equal(stack.popMostRecent()?.sessionId, "session-2");
  assert.equal(stack.popMostRecent(), null);
});

void test("resume target labels and workbook confirmation copy follow selected target", () => {
  assert.equal(getResumeTargetLabel("new_tab"), "Open in new tab");
  assert.equal(getResumeTargetLabel("replace_current"), "Replace current tab");

  assert.match(
    getCrossWorkbookResumeConfirmMessage("new_tab"),
    /new tab/i,
  );
  assert.match(
    getCrossWorkbookResumeConfirmMessage("replace_current"),
    /replace the current chat/i,
  );
});

void test("Cmd/Ctrl+Shift+T detection ignores Alt-modified chords", () => {
  assert.equal(
    isReopenLastClosedShortcut({
      key: "t",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    }),
    true,
  );

  assert.equal(
    isReopenLastClosedShortcut({
      key: "T",
      metaKey: false,
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    }),
    true,
  );

  assert.equal(
    isReopenLastClosedShortcut({
      key: "t",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: true,
    }),
    false,
  );
});
