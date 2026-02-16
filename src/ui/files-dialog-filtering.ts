import type { WorkspaceBackendStatus, WorkspaceFileEntry } from "../files/types.js";

export interface FilesDialogBadge {
  tone: "ok" | "muted" | "info";
  label: string;
}

export interface FilesDialogSection {
  key: string;
  label: string;
  files: WorkspaceFileEntry[];
}

const YOUR_FILES_SECTION_KEY = "your-files";
const BUILTIN_DOCS_SECTION_KEY = "built-in-docs";

export function normalizeFilesDialogFilterText(value: string): string {
  return value.trim().toLowerCase();
}

export function isFilesDialogBuiltInDoc(file: WorkspaceFileEntry): boolean {
  return file.sourceKind === "builtin-doc" || file.locationKind === "builtin-doc";
}

export function isFilesDialogConnectedFolderFile(file: WorkspaceFileEntry): boolean {
  return file.locationKind === "native-directory";
}

export function isAgentWrittenNotesFilePath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return lowerPath.startsWith("notes/") && lowerPath.endsWith(".md");
}

export function resolveFilesDialogBadge(file: WorkspaceFileEntry): FilesDialogBadge | null {
  if (isFilesDialogBuiltInDoc(file)) {
    return { tone: "muted", label: "Read only" };
  }

  if (file.workbookTag) {
    return { tone: "ok", label: file.workbookTag.workbookLabel };
  }

  if (isAgentWrittenNotesFilePath(file.path)) {
    return { tone: "muted", label: "Agent" };
  }

  if (isFilesDialogConnectedFolderFile(file)) {
    return { tone: "info", label: "Folder" };
  }

  return null;
}

export function resolveFilesDialogSourceLabel(file: WorkspaceFileEntry): string {
  if (isFilesDialogBuiltInDoc(file)) {
    return "Pi documentation";
  }

  if (isAgentWrittenNotesFilePath(file.path)) {
    return "Written by agent";
  }

  if (isFilesDialogConnectedFolderFile(file)) {
    return "Local file";
  }

  return "Uploaded";
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

function sortByModifiedAtDescending(files: readonly WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return [...files].sort((left, right) => {
    if (left.modifiedAt !== right.modifiedAt) {
      return right.modifiedAt - left.modifiedAt;
    }

    return left.path.localeCompare(right.path);
  });
}

function connectedFolderSectionLabel(backendStatus: WorkspaceBackendStatus | null): string {
  const folderName = backendStatus?.nativeDirectoryName?.trim();
  if (!folderName) {
    return "FROM CONNECTED FOLDER";
  }

  return `FROM ${folderName.toUpperCase()}`;
}

function connectedFolderSectionKey(backendStatus: WorkspaceBackendStatus | null): string {
  const folderName = backendStatus?.nativeDirectoryName?.trim().toLowerCase();
  if (!folderName) {
    return "from-connected-folder";
  }

  return `from-${folderName}`;
}

export function buildFilesDialogSections(args: {
  files: readonly WorkspaceFileEntry[];
  filterText: string;
  backendStatus: WorkspaceBackendStatus | null;
}): FilesDialogSection[] {
  const filteredFiles = filterFilesDialogEntries({
    files: args.files,
    filterText: args.filterText,
  });

  const yourFiles = sortByModifiedAtDescending(filteredFiles.filter((file) => {
    if (isFilesDialogBuiltInDoc(file)) {
      return false;
    }

    return !isFilesDialogConnectedFolderFile(file);
  }));

  const connectedFolderFiles = sortByModifiedAtDescending(filteredFiles.filter((file) => {
    if (isFilesDialogBuiltInDoc(file)) {
      return false;
    }

    return isFilesDialogConnectedFolderFile(file);
  }));

  const builtInDocs = [...filteredFiles]
    .filter((file) => isFilesDialogBuiltInDoc(file))
    .sort((left, right) => left.path.localeCompare(right.path));

  const sections: FilesDialogSection[] = [];

  if (yourFiles.length > 0) {
    sections.push({
      key: YOUR_FILES_SECTION_KEY,
      label: "YOUR FILES",
      files: yourFiles,
    });
  }

  if (connectedFolderFiles.length > 0) {
    sections.push({
      key: connectedFolderSectionKey(args.backendStatus),
      label: connectedFolderSectionLabel(args.backendStatus),
      files: connectedFolderFiles,
    });
  }

  if (builtInDocs.length > 0) {
    sections.push({
      key: BUILTIN_DOCS_SECTION_KEY,
      label: "BUILT-IN DOCS",
      files: builtInDocs,
    });
  }

  return sections;
}

export interface FilesDialogConnectFolderButtonState {
  hidden: boolean;
  disabled: boolean;
  label: string;
}

export function resolveFilesDialogConnectFolderButtonState(
  backendStatus: WorkspaceBackendStatus | null,
): FilesDialogConnectFolderButtonState {
  if (!backendStatus || !backendStatus.nativeSupported) {
    return {
      hidden: true,
      disabled: true,
      label: "Connect folder",
    };
  }

  if (backendStatus.nativeConnected) {
    return {
      hidden: false,
      disabled: true,
      label: "Connected ✓",
    };
  }

  return {
    hidden: false,
    disabled: false,
    label: "Connect folder",
  };
}
