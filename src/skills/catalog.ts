/**
 * Bundled Agent Skills catalog.
 *
 * Source of truth: top-level `skills/<skill-name>/SKILL.md` files.
 */

import mcpGatewaySkillMarkdown from "../../skills/mcp-gateway/SKILL.md?raw";
import webSearchSkillMarkdown from "../../skills/web-search/SKILL.md?raw";

import { parseSkillDocument, type ParsedSkillFrontmatter } from "./frontmatter.js";

export interface AgentSkillDefinition {
  name: string;
  description: string;
  compatibility?: string;
  location: string;
  markdown: string;
  body: string;
}

export interface AgentSkillPromptEntry {
  name: string;
  description: string;
  location: string;
}

interface BundledSkillSource {
  location: string;
  markdown: string;
}

const BUNDLED_SKILL_SOURCES: readonly BundledSkillSource[] = [
  {
    location: "skills/web-search/SKILL.md",
    markdown: webSearchSkillMarkdown,
  },
  {
    location: "skills/mcp-gateway/SKILL.md",
    markdown: mcpGatewaySkillMarkdown,
  },
] as const;

function buildDefinition(args: {
  location: string;
  markdown: string;
  frontmatter: ParsedSkillFrontmatter;
  body: string;
}): AgentSkillDefinition {
  return {
    name: args.frontmatter.name,
    description: args.frontmatter.description,
    compatibility: args.frontmatter.compatibility,
    location: args.location,
    markdown: args.markdown,
    body: args.body,
  };
}

function buildCatalog(): AgentSkillDefinition[] {
  const definitions: AgentSkillDefinition[] = [];

  for (const source of BUNDLED_SKILL_SOURCES) {
    const parsed = parseSkillDocument(source.markdown);
    if (!parsed) {
      console.warn(`[skills] Invalid SKILL.md frontmatter: ${source.location}`);
      continue;
    }

    definitions.push(buildDefinition({
      location: source.location,
      markdown: source.markdown,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    }));
  }

  definitions.sort((left, right) => left.name.localeCompare(right.name));
  return definitions;
}

const CATALOG = buildCatalog();

export function listAgentSkills(): AgentSkillDefinition[] {
  return [...CATALOG];
}

export function getAgentSkillByName(name: string): AgentSkillDefinition | null {
  const needle = name.trim().toLowerCase();
  if (needle.length === 0) return null;

  const found = CATALOG.find((entry) => entry.name.toLowerCase() === needle);
  return found ?? null;
}

export function getAgentSkillPromptEntries(): AgentSkillPromptEntry[] {
  return CATALOG.map((entry) => ({
    name: entry.name,
    description: entry.description,
    location: entry.location,
  }));
}
