/**
 * External Agent Skills discovery store (feature-flagged).
 *
 * Source of truth: Files workspace path `skills/external/<name>/SKILL.md`.
 */

import { getFilesWorkspace, type FilesWorkspace } from "../files/workspace.js";
import type { WorkspaceFileEntry } from "../files/types.js";
import type {
  AgentSkillDefinition,
  AgentSkillSourceKind,
} from "./types.js";
import { parseSkillDocument } from "./frontmatter.js";

const EXTERNAL_SKILLS_ROOT_PATH = "skills/external";
const EXTERNAL_SKILL_FILENAME = "SKILL.md";
const MAX_EXTERNAL_SKILL_MARKDOWN_CHARS = 1_000_000;

export type ExternalSkillWorkspace = Pick<
  FilesWorkspace,
  "listFiles" | "readFile" | "writeTextFile" | "deleteFile"
>;

function isWorkspaceExternalSkillFile(file: WorkspaceFileEntry): boolean {
  if (file.sourceKind !== "workspace") {
    return false;
  }

  const parts = file.path.split("/");
  return (
    parts.length === 4
    && parts[0] === "skills"
    && parts[1] === "external"
    && parts[2] !== ""
    && parts[3] === EXTERNAL_SKILL_FILENAME
  );
}

function normalizeSkillName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Skill name cannot be empty.");
  }

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("Skill name cannot contain path separators.");
  }

  if (trimmed === "." || trimmed === "..") {
    throw new Error("Skill name cannot be '.' or '..'.");
  }

  return trimmed;
}

function getExternalSkillPath(name: string): string {
  const normalized = normalizeSkillName(name);
  return `${EXTERNAL_SKILLS_ROOT_PATH}/${normalized}/${EXTERNAL_SKILL_FILENAME}`;
}

function buildExternalSkillDefinition(args: {
  location: string;
  markdown: string;
  sourceKind: AgentSkillSourceKind;
}): AgentSkillDefinition | null {
  const parsed = parseSkillDocument(args.markdown);
  if (!parsed) {
    return null;
  }

  return {
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
    compatibility: parsed.frontmatter.compatibility,
    location: args.location,
    sourceKind: args.sourceKind,
    markdown: args.markdown,
    body: parsed.body,
  };
}

/**
 * Loads external skills from the canonical Files workspace location:
 * `skills/external/<name>/SKILL.md`.
 */
export async function loadExternalAgentSkillsFromWorkspace(
  workspace: ExternalSkillWorkspace,
): Promise<AgentSkillDefinition[]> {
  const files = await workspace.listFiles();
  const externalFiles = files
    .filter((file) => isWorkspaceExternalSkillFile(file))
    .sort((left, right) => left.path.localeCompare(right.path));

  const byName = new Map<string, AgentSkillDefinition>();

  for (const file of externalFiles) {
    let readResult: Awaited<ReturnType<ExternalSkillWorkspace["readFile"]>>;

    try {
      readResult = await workspace.readFile(file.path, {
        mode: "text",
        maxChars: MAX_EXTERNAL_SKILL_MARKDOWN_CHARS,
      });
    } catch (error: unknown) {
      console.warn(`[skills] Failed reading external skill file: ${file.path}`, error);
      continue;
    }

    if (typeof readResult.text !== "string") {
      console.warn(`[skills] External skill file is not readable text: ${file.path}`);
      continue;
    }

    if (readResult.truncated) {
      console.warn(`[skills] External skill file is too large to load fully: ${file.path}`);
      continue;
    }

    const skill = buildExternalSkillDefinition({
      location: file.path,
      markdown: readResult.text,
      sourceKind: "external",
    });

    if (!skill) {
      console.warn(`[skills] Invalid external SKILL.md frontmatter: ${file.path}`);
      continue;
    }

    const normalizedName = skill.name.toLowerCase();
    if (byName.has(normalizedName)) {
      console.warn(`[skills] Duplicate external skill ignored: ${skill.name} (${file.path})`);
      continue;
    }

    byName.set(normalizedName, skill);
  }

  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadExternalAgentSkills(): Promise<AgentSkillDefinition[]> {
  return loadExternalAgentSkillsFromWorkspace(getFilesWorkspace());
}

export interface UpsertExternalAgentSkillResult {
  name: string;
  location: string;
}

export async function upsertExternalAgentSkillInWorkspace(args: {
  workspace: ExternalSkillWorkspace;
  markdown: string;
  expectedName?: string;
}): Promise<UpsertExternalAgentSkillResult> {
  const parsed = parseSkillDocument(args.markdown);
  if (!parsed) {
    throw new Error("Invalid SKILL.md document: expected frontmatter with name and description.");
  }

  if (args.expectedName !== undefined) {
    const normalizedExpected = normalizeSkillName(args.expectedName);
    if (parsed.frontmatter.name.toLowerCase() !== normalizedExpected.toLowerCase()) {
      throw new Error(
        `Skill name mismatch: expected "${normalizedExpected}" but markdown declares "${parsed.frontmatter.name}".`,
      );
    }
  }

  const location = getExternalSkillPath(parsed.frontmatter.name);
  await args.workspace.writeTextFile(location, args.markdown, "text/markdown");

  return {
    name: parsed.frontmatter.name,
    location,
  };
}

export async function upsertExternalAgentSkill(args: {
  markdown: string;
  expectedName?: string;
}): Promise<UpsertExternalAgentSkillResult> {
  return upsertExternalAgentSkillInWorkspace({
    workspace: getFilesWorkspace(),
    markdown: args.markdown,
    expectedName: args.expectedName,
  });
}

export async function removeExternalAgentSkillFromWorkspace(args: {
  workspace: ExternalSkillWorkspace;
  name: string;
}): Promise<boolean> {
  const normalizedName = normalizeSkillName(args.name).toLowerCase();
  const externalSkills = await loadExternalAgentSkillsFromWorkspace(args.workspace);

  const match = externalSkills.find((skill) => skill.name.toLowerCase() === normalizedName);
  if (!match) {
    return false;
  }

  await args.workspace.deleteFile(match.location);
  return true;
}

export async function removeExternalAgentSkill(args: {
  name: string;
}): Promise<boolean> {
  return removeExternalAgentSkillFromWorkspace({
    workspace: getFilesWorkspace(),
    name: args.name,
  });
}
