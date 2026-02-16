import assert from "node:assert/strict";
import { test } from "node:test";

import type { WorkspaceBackendStatus, WorkspaceFileEntry } from "../src/files/types.ts";
import {
  buildFilesDialogSections,
  filterFilesDialogEntries,
  fileMatchesFilesDialogFilter,
  normalizeFilesDialogFilterText,
  resolveFilesDialogBadge,
  resolveFilesDialogConnectFolderButtonState,
  resolveFilesDialogSourceLabel,
} from "../src/ui/files-dialog-filtering.ts";

function makeFile(path: string, overrides: Partial<WorkspaceFileEntry> = {}): WorkspaceFileEntry {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    size: 10,
    modifiedAt: 0,
    mimeType: "text/plain",
    kind: "text",
    sourceKind: "workspace",
    readOnly: false,
    ...overrides,
  };
}

const connectedBackendStatus: WorkspaceBackendStatus = {
  kind: "native-directory",
  label: "Local folder",
  nativeSupported: true,
  nativeConnected: true,
  nativeDirectoryName: "Project Docs",
};

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

void test("buildFilesDialogSections groups and orders files by source", () => {
  const files = [
    makeFile("uploads/raw.csv", { modifiedAt: 35 }),
    makeFile("notes/summary.md", { modifiedAt: 12 }),
    makeFile("folder/model-spec.pdf", { modifiedAt: 8, locationKind: "native-directory" }),
    makeFile("folder/assumptions.md", { modifiedAt: 16, locationKind: "native-directory" }),
    makeFile("assistant-docs/docs/extensions.md", {
      sourceKind: "builtin-doc",
      locationKind: "builtin-doc",
      readOnly: true,
      modifiedAt: 1,
    }),
    makeFile("assistant-docs/docs/README.md", {
      sourceKind: "builtin-doc",
      locationKind: "builtin-doc",
      readOnly: true,
      modifiedAt: 2,
    }),
  ];

  const sections = buildFilesDialogSections({
    files,
    filterText: "",
    backendStatus: connectedBackendStatus,
  });

  assert.deepEqual(sections.map((section) => section.label), [
    "YOUR FILES",
    "FROM PROJECT DOCS",
    "BUILT-IN DOCS",
  ]);

  assert.deepEqual(sections[0]?.files.map((file) => file.path), [
    "uploads/raw.csv",
    "notes/summary.md",
  ]);

  assert.deepEqual(sections[1]?.files.map((file) => file.path), [
    "folder/assumptions.md",
    "folder/model-spec.pdf",
  ]);

  assert.deepEqual(sections[2]?.files.map((file) => file.path), [
    "assistant-docs/docs/extensions.md",
    "assistant-docs/docs/README.md",
  ]);
});

void test("resolveFilesDialogBadge follows priority rules", () => {
  const builtInWithTag = makeFile("assistant-docs/docs/README.md", {
    sourceKind: "builtin-doc",
    locationKind: "builtin-doc",
    readOnly: true,
    workbookTag: {
      workbookId: "wb-a",
      workbookLabel: "Budget.xlsx",
      taggedAt: 1,
    },
  });
  assert.deepEqual(resolveFilesDialogBadge(builtInWithTag), { tone: "muted", label: "Read only" });

  const tagged = makeFile("uploads/plan.md", {
    workbookTag: {
      workbookId: "wb-a",
      workbookLabel: "Budget.xlsx",
      taggedAt: 1,
    },
  });
  assert.deepEqual(resolveFilesDialogBadge(tagged), { tone: "ok", label: "Budget.xlsx" });

  const agentNotes = makeFile("notes/today.md");
  assert.deepEqual(resolveFilesDialogBadge(agentNotes), { tone: "muted", label: "Agent" });

  const connected = makeFile("folder/readme.md", { locationKind: "native-directory" });
  assert.deepEqual(resolveFilesDialogBadge(connected), { tone: "info", label: "Folder" });

  const uploaded = makeFile("uploads/raw.csv");
  assert.equal(resolveFilesDialogBadge(uploaded), null);
});

void test("resolveFilesDialogSourceLabel maps each source", () => {
  assert.equal(resolveFilesDialogSourceLabel(makeFile("assistant-docs/docs/README.md", {
    sourceKind: "builtin-doc",
    locationKind: "builtin-doc",
    readOnly: true,
  })), "Pi documentation");

  assert.equal(resolveFilesDialogSourceLabel(makeFile("notes/today.md")), "Written by agent");
  assert.equal(resolveFilesDialogSourceLabel(makeFile("folder/readme.md", { locationKind: "native-directory" })), "Local file");
  assert.equal(resolveFilesDialogSourceLabel(makeFile("uploads/raw.csv")), "Uploaded");
});

void test("resolveFilesDialogConnectFolderButtonState reflects backend status", () => {
  assert.deepEqual(resolveFilesDialogConnectFolderButtonState(null), {
    hidden: true,
    disabled: true,
    label: "Connect folder",
    title: "",
  });

  assert.deepEqual(resolveFilesDialogConnectFolderButtonState({
    kind: "opfs",
    label: "Sandboxed workspace",
    nativeSupported: false,
    nativeConnected: false,
  }), {
    hidden: true,
    disabled: true,
    label: "Connect folder",
    title: "",
  });

  assert.deepEqual(resolveFilesDialogConnectFolderButtonState({
    kind: "opfs",
    label: "Sandboxed workspace",
    nativeSupported: true,
    nativeConnected: false,
  }), {
    hidden: false,
    disabled: false,
    label: "Connect folder",
    title: "Connect local folder",
  });

  assert.deepEqual(resolveFilesDialogConnectFolderButtonState(connectedBackendStatus), {
    hidden: false,
    disabled: true,
    label: "Connected ✓",
    title: "Folder already connected",
  });
});
