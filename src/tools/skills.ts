/**
 * skills — list/read bundled Agent Skills (SKILL.md).
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AgentSkillDefinition } from "../skills/catalog.js";
import type { SkillReadCache } from "../skills/read-cache.js";

const schema = Type.Object({
  action: Type.Union([
    Type.Literal("list"),
    Type.Literal("read"),
  ], {
    description: "list = show available skills, read = return full SKILL.md for a named skill.",
  }),
  name: Type.Optional(Type.String({
    description: "Skill name (required when action=read).",
  })),
});

type Params = Static<typeof schema>;

export interface SkillsToolCatalog {
  list: () => AgentSkillDefinition[];
  getByName: (name: string) => AgentSkillDefinition | null;
}

let defaultCatalog: SkillsToolCatalog | null = null;

async function getDefaultCatalog(): Promise<SkillsToolCatalog> {
  if (defaultCatalog) {
    return defaultCatalog;
  }

  const catalogModule = await import("../skills/catalog.js");
  defaultCatalog = {
    list: catalogModule.listAgentSkills,
    getByName: catalogModule.getAgentSkillByName,
  };
  return defaultCatalog;
}

export interface SkillsToolDependencies {
  getSessionId?: () => string | null;
  readCache?: SkillReadCache;
  catalog?: SkillsToolCatalog;
}

function renderSkillListMarkdown(skills: AgentSkillDefinition[]): string {
  if (skills.length === 0) {
    return "No Agent Skills are bundled in this build.";
  }

  const lines: string[] = [
    `Available Agent Skills (${skills.length}):`,
    "",
  ];

  for (const skill of skills) {
    lines.push(`- \`${skill.name}\` — ${skill.description}`);
  }

  lines.push("");
  lines.push("Use action=read with a skill name to load the full SKILL.md instructions.");
  return lines.join("\n");
}

function renderReadError(name: string, skills: AgentSkillDefinition[]): string {
  const available = skills.map((skill) => `\`${skill.name}\``).join(", ");
  return [
    `Skill not found: \`${name}\`.`,
    available.length > 0 ? `Available: ${available}.` : "No skills are available.",
  ].join(" ");
}

function normalizeSessionId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createSkillsTool(
  dependencies: SkillsToolDependencies = {},
): AgentTool<typeof schema, undefined> {
  const getSessionId = dependencies.getSessionId;
  const readCache = dependencies.readCache;

  return {
    name: "skills",
    label: "Skills",
    description:
      "List and read bundled Agent Skills (SKILL.md). "
      + "Use this to load detailed, task-specific workflows on demand.",
    parameters: schema,
    execute: async (_toolCallId: string, params: Params): Promise<AgentToolResult<undefined>> => {
      const catalog = dependencies.catalog ?? await getDefaultCatalog();
      const skills = catalog.list();

      if (params.action === "list") {
        return {
          content: [{ type: "text", text: renderSkillListMarkdown(skills) }],
          details: undefined,
        };
      }

      const requestedName = params.name?.trim() ?? "";
      if (requestedName.length === 0) {
        return {
          content: [{ type: "text", text: "Error: name is required when action=read." }],
          details: undefined,
        };
      }

      const sessionId = normalizeSessionId(getSessionId?.());
      if (sessionId && readCache) {
        const cached = readCache.get(sessionId, requestedName);
        if (cached) {
          return {
            content: [{ type: "text", text: cached.markdown }],
            details: undefined,
          };
        }
      }

      const skill = catalog.getByName(requestedName);
      if (!skill) {
        return {
          content: [{ type: "text", text: renderReadError(requestedName, skills) }],
          details: undefined,
        };
      }

      if (sessionId && readCache) {
        readCache.set(sessionId, skill.name, skill.markdown);
      }

      return {
        content: [{ type: "text", text: skill.markdown }],
        details: undefined,
      };
    },
  };
}
