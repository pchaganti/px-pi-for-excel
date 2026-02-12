/**
 * External Agent Skills discovery store (feature-flagged).
 *
 * This is intentionally opt-in and local-only.
 */

import type {
  AgentSkillDefinition,
  AgentSkillSourceKind,
} from "./types.js";
import { parseSkillDocument } from "./frontmatter.js";
import { isRecord } from "../utils/type-guards.js";

export const EXTERNAL_AGENT_SKILLS_STORAGE_KEY = "skills.external.v1.catalog";

export interface ExternalSkillSettingsStore {
  get: (key: string) => Promise<unknown>;
}

interface StoredExternalSkillItem {
  location: string;
  markdown: string;
}

function isStoredExternalSkillItem(value: unknown): value is StoredExternalSkillItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.location === "string"
    && typeof value.markdown === "string"
  );
}

function parseStoredExternalSkillItems(raw: unknown): StoredExternalSkillItem[] {
  if (!isRecord(raw)) return [];

  const version = raw.version;
  if (version !== 1) return [];

  const items = raw.items;
  if (!Array.isArray(items)) return [];

  return items.filter((item) => isStoredExternalSkillItem(item));
}

function buildExternalSkillDefinition(args: {
  item: StoredExternalSkillItem;
  sourceKind: AgentSkillSourceKind;
}): AgentSkillDefinition | null {
  const parsed = parseSkillDocument(args.item.markdown);
  if (!parsed) {
    return null;
  }

  return {
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
    compatibility: parsed.frontmatter.compatibility,
    location: args.item.location,
    sourceKind: args.sourceKind,
    markdown: args.item.markdown,
    body: parsed.body,
  };
}

/**
 * Loads externally configured skills from settings.
 *
 * Expected shape:
 * {
 *   version: 1,
 *   items: [{ location: string, markdown: string }, ...]
 * }
 */
export async function loadExternalAgentSkillsFromSettings(
  settings: ExternalSkillSettingsStore,
): Promise<AgentSkillDefinition[]> {
  const raw = await settings.get(EXTERNAL_AGENT_SKILLS_STORAGE_KEY);
  const storedItems = parseStoredExternalSkillItems(raw);

  const loaded: AgentSkillDefinition[] = [];

  for (const item of storedItems) {
    const skill = buildExternalSkillDefinition({
      item,
      sourceKind: "external",
    });

    if (!skill) {
      console.warn(`[skills] Invalid external SKILL.md frontmatter: ${item.location}`);
      continue;
    }

    loaded.push(skill);
  }

  loaded.sort((left, right) => left.name.localeCompare(right.name));
  return loaded;
}
