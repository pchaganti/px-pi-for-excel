import type { WorkspaceFileEntry } from "../files/types.js";

export type FilesDialogFilterValue = "all" | "current" | "untagged" | "builtin" | `tag:${string}`;

export interface FilesDialogFilterOption {
  value: FilesDialogFilterValue;
  label: string;
  disabled?: boolean;
}

function makeTagFilterValue(workbookId: string): `tag:${string}` {
  return `tag:${workbookId}`;
}

function buildWorkbookTagFilterOptions(files: WorkspaceFileEntry[]): FilesDialogFilterOption[] {
  const byWorkbook = new Map<string, { label: string; count: number }>();

  for (const file of files) {
    const tag = file.workbookTag;
    if (!tag) continue;

    const existing = byWorkbook.get(tag.workbookId);
    if (existing) {
      existing.count += 1;
      continue;
    }

    byWorkbook.set(tag.workbookId, {
      label: tag.workbookLabel,
      count: 1,
    });
  }

  const entries = [...byWorkbook.entries()]
    .sort((left, right) => left[1].label.localeCompare(right[1].label));

  return entries.map(([workbookId, info]) => ({
    value: makeTagFilterValue(workbookId),
    label: `${info.label} (${info.count})`,
  }));
}

export function countBuiltInDocs(files: WorkspaceFileEntry[]): number {
  return files.filter((file) => file.sourceKind === "builtin-doc").length;
}

export function buildFilesDialogFilterOptions(args: {
  files: WorkspaceFileEntry[];
  currentWorkbookId: string | null;
  currentWorkbookLabel: string | null;
  builtinDocsCount: number;
}): FilesDialogFilterOption[] {
  return [
    { value: "all", label: "All files" },
    {
      value: "current",
      label: args.currentWorkbookLabel
        ? `Current workbook: ${args.currentWorkbookLabel}`
        : "Current workbook (unavailable)",
      disabled: args.currentWorkbookId === null,
    },
    { value: "builtin", label: `Built-in docs (${args.builtinDocsCount})` },
    { value: "untagged", label: "Untagged files" },
    ...buildWorkbookTagFilterOptions(args.files),
  ];
}

export function parseFilesDialogFilterValue(value: string): FilesDialogFilterValue {
  if (value === "all" || value === "current" || value === "untagged" || value === "builtin") {
    return value;
  }

  const tagPrefix = "tag:";
  if (value.startsWith(tagPrefix) && value.length > tagPrefix.length) {
    return makeTagFilterValue(value.slice(tagPrefix.length));
  }

  return "all";
}

export function isFilesDialogFilterSelectable(args: {
  filter: FilesDialogFilterValue;
  options: FilesDialogFilterOption[];
}): boolean {
  return args.options.some((option) => option.value === args.filter && option.disabled !== true);
}

export function fileMatchesFilesDialogFilter(args: {
  file: WorkspaceFileEntry;
  filter: FilesDialogFilterValue;
  currentWorkbookId: string | null;
}): boolean {
  if (args.filter === "all") return true;

  if (args.filter === "untagged") {
    return args.file.workbookTag === undefined;
  }

  if (args.filter === "current") {
    if (!args.currentWorkbookId) return false;
    return args.file.workbookTag?.workbookId === args.currentWorkbookId;
  }

  if (args.filter === "builtin") {
    return args.file.sourceKind === "builtin-doc";
  }

  const tagPrefix = "tag:";
  if (args.filter.startsWith(tagPrefix)) {
    const workbookId = args.filter.slice(tagPrefix.length);
    return args.file.workbookTag?.workbookId === workbookId;
  }

  return true;
}
