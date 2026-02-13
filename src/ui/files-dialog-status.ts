import type { FilesDialogFilterValue } from "./files-dialog-filtering.js";

export function buildFilesDialogStatusMessage(args: {
  filesExperimentEnabled: boolean;
  totalCount: number;
  filteredCount: number;
  selectedFilter: FilesDialogFilterValue;
  activeFilterLabel: string;
  builtinDocsCount: number;
  workspaceFilesCount: number;
}): string {
  if (!args.filesExperimentEnabled) {
    return (
      `Built-in docs stay available (${args.builtinDocsCount}). `
      + "Enable files-workspace for assistant write/delete "
      + `on workspace files (${args.workspaceFilesCount}).`
    );
  }

  if (args.selectedFilter === "all") {
    return `${args.totalCount} file${args.totalCount === 1 ? "" : "s"} available to the assistant.`;
  }

  return (
    `${args.filteredCount} of ${args.totalCount} file${args.totalCount === 1 ? "" : "s"} shown`
    + ` · ${args.activeFilterLabel}.`
  );
}
