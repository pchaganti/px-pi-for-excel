import assert from "node:assert/strict";
import { test } from "node:test";

import type { WorkspaceFileEntry } from "../src/files/types.ts";
import {
  filterFilesDialogEntries,
  fileMatchesFilesDialogFilter,
  normalizeFilesDialogFilterText,
} from "../src/ui/files-dialog-filtering.ts";

function makeFile(path: string): WorkspaceFileEntry {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    size: 10,
    modifiedAt: 0,
    mimeType: "text/plain",
    kind: "text",
    sourceKind: "workspace",
    readOnly: false,
  };
}

void test("normalizeFilesDialogFilterText trims and lowercases", () => {
  assert.equal(normalizeFilesDialogFilterText("  Notes/Q1  "), "notes/q1");
  assert.equal(normalizeFilesDialogFilterText("   "), "");
});

void test("fileMatchesFilesDialogFilter uses case-insensitive path substring", () => {
  const file = makeFile("notes/Quarterly-Plan.md");

  assert.equal(fileMatchesFilesDialogFilter({ file, filterText: "quarterly" }), true);
  assert.equal(fileMatchesFilesDialogFilter({ file, filterText: "NOTES/QU" }), true);
  assert.equal(fileMatchesFilesDialogFilter({ file, filterText: "missing" }), false);
});

void test("filterFilesDialogEntries returns all files when filter is empty", () => {
  const files = [
    makeFile("notes/index.md"),
    makeFile("imports/budget.csv"),
  ];

  const result = filterFilesDialogEntries({
    files,
    filterText: "   ",
  });

  assert.deepEqual(result.map((file) => file.path), [
    "notes/index.md",
    "imports/budget.csv",
  ]);
});

void test("filterFilesDialogEntries returns only matching paths", () => {
  const files = [
    makeFile("notes/index.md"),
    makeFile("notes/meeting-notes.md"),
    makeFile("imports/raw.csv"),
  ];

  const result = filterFilesDialogEntries({
    files,
    filterText: "notes/meeting",
  });

  assert.deepEqual(result.map((file) => file.path), ["notes/meeting-notes.md"]);
});
