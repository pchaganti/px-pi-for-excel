import assert from "node:assert/strict";
import { test } from "node:test";

import type { WorkspaceFileEntry } from "../src/files/types.ts";
import {
  buildFilesDialogFilterOptions,
  countBuiltInDocs,
  fileMatchesFilesDialogFilter,
  isFilesDialogFilterSelectable,
  parseFilesDialogFilterValue,
} from "../src/ui/files-dialog-filtering.ts";

function makeFile(args: {
  path: string;
  sourceKind?: "workspace" | "builtin-doc";
  workbookId?: string;
}): WorkspaceFileEntry {
  return {
    path: args.path,
    name: args.path.split("/").at(-1) ?? args.path,
    size: 10,
    modifiedAt: 0,
    mimeType: "text/plain",
    kind: "text",
    sourceKind: args.sourceKind ?? "workspace",
    readOnly: args.sourceKind === "builtin-doc",
    workbookTag: args.workbookId
      ? {
        workbookId: args.workbookId,
        workbookLabel: "Book",
        taggedAt: 0,
      }
      : undefined,
  };
}

void test("filter options include built-in docs and current workbook state", () => {
  const files = [
    makeFile({ path: "notes.md" }),
    makeFile({ path: "assistant-docs/docs/extensions.md", sourceKind: "builtin-doc" }),
  ];

  const options = buildFilesDialogFilterOptions({
    files,
    currentWorkbookId: null,
    currentWorkbookLabel: null,
    builtinDocsCount: countBuiltInDocs(files),
  });

  const builtin = options.find((option) => option.value === "builtin");
  const current = options.find((option) => option.value === "current");

  assert.equal(builtin?.label, "Built-in docs (1)");
  assert.equal(current?.disabled, true);
  assert.equal(isFilesDialogFilterSelectable({ filter: "current", options }), false);
});

void test("parseFilesDialogFilterValue handles known and unknown values", () => {
  assert.equal(parseFilesDialogFilterValue("builtin"), "builtin");
  assert.equal(parseFilesDialogFilterValue("tag:abc"), "tag:abc");
  assert.equal(parseFilesDialogFilterValue("unknown"), "all");
});

void test("fileMatchesFilesDialogFilter handles builtin/current/tag filters", () => {
  const builtin = makeFile({ path: "assistant-docs/README.md", sourceKind: "builtin-doc" });
  const tagged = makeFile({ path: "notes.md", workbookId: "wb-1" });

  assert.equal(fileMatchesFilesDialogFilter({
    file: builtin,
    filter: "builtin",
    currentWorkbookId: null,
  }), true);

  assert.equal(fileMatchesFilesDialogFilter({
    file: tagged,
    filter: "current",
    currentWorkbookId: "wb-1",
  }), true);

  assert.equal(fileMatchesFilesDialogFilter({
    file: tagged,
    filter: "tag:wb-1",
    currentWorkbookId: null,
  }), true);
});
