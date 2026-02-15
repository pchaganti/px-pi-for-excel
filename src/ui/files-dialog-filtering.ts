import type { WorkspaceFileEntry } from "../files/types.js";

export function normalizeFilesDialogFilterText(value: string): string {
  return value.trim().toLowerCase();
}

export function fileMatchesFilesDialogFilter(args: {
  file: WorkspaceFileEntry;
  filterText: string;
}): boolean {
  const query = normalizeFilesDialogFilterText(args.filterText);
  if (query.length === 0) {
    return true;
  }

  return args.file.path.toLowerCase().includes(query);
}

export function filterFilesDialogEntries(args: {
  files: readonly WorkspaceFileEntry[];
  filterText: string;
}): WorkspaceFileEntry[] {
  const query = normalizeFilesDialogFilterText(args.filterText);
  if (query.length === 0) {
    return [...args.files];
  }

  return args.files.filter((file) => file.path.toLowerCase().includes(query));
}
