/**
 * skills — list/read bundled Agent Skills (SKILL.md).
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AgentSkillDefinition } from "../skills/catalog.js";
import type { SkillReadCache } from "../skills/read-cache.js";
import type {
  SkillsErrorDetails,
  SkillsListDetails,
  SkillsReadDetails,
  SkillsToolDetails,
} from "./tool-details.js";

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
  refresh: Type.Optional(Type.Boolean({
    description: "When true (read only), bypass the session cache and reload from catalog.",
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

function buildSkillsListDetails(skills: AgentSkillDefinition[]): SkillsListDetails {
  return {
    kind: "skills_list",
    count: skills.length,
    names: skills.map((skill) => skill.name),
  };
}

function buildSkillsErrorDetails(args: {
  message: string;
  requestedName?: string;
  availableNames?: string[];
}): SkillsErrorDetails {
  return {
    kind: "skills_error",
    action: "read",
    message: args.message,
    requestedName: args.requestedName,
    availableNames: args.availableNames,
  };
}

function buildSkillsReadDetails(args: {
  skillName: string;
  cacheHit: boolean;
  refreshed: boolean;
  sessionScoped: boolean;
  readCount?: number;
}): SkillsReadDetails {
  return {
    kind: "skills_read",
    skillName: args.skillName,
    cacheHit: args.cacheHit,
    refreshed: args.refreshed,
    sessionScoped: args.sessionScoped,
    readCount: args.readCount,
  };
}

export function createSkillsTool(
  dependencies: SkillsToolDependencies = {},
): AgentTool<typeof schema, SkillsToolDetails> {
  const getSessionId = dependencies.getSessionId;
  const readCache = dependencies.readCache;

  return {
    name: "skills",
    label: "Skills",
    description:
      "List and read bundled Agent Skills (SKILL.md). "
      + "Use this to load detailed, task-specific workflows on demand.",
    parameters: schema,
    execute: async (_toolCallId: string, params: Params): Promise<AgentToolResult<SkillsToolDetails>> => {
      const catalog = dependencies.catalog ?? await getDefaultCatalog();
      const skills = catalog.list();

      if (params.action === "list") {
        return {
          content: [{ type: "text", text: renderSkillListMarkdown(skills) }],
          details: buildSkillsListDetails(skills),
        };
      }

      const requestedName = params.name?.trim() ?? "";
      if (requestedName.length === 0) {
        const message = "Error: name is required when action=read.";
        return {
          content: [{ type: "text", text: message }],
          details: buildSkillsErrorDetails({
            message,
            availableNames: skills.map((skill) => skill.name),
          }),
        };
      }

      const refresh = params.refresh === true;
      const sessionId = normalizeSessionId(getSessionId?.());
      const sessionScoped = sessionId !== null && readCache !== undefined;

      if (!refresh && sessionId && readCache) {
        const cached = readCache.get(sessionId, requestedName);
        if (cached) {
          return {
            content: [{ type: "text", text: cached.markdown }],
            details: buildSkillsReadDetails({
              skillName: cached.skillName,
              cacheHit: true,
              refreshed: false,
              sessionScoped,
              readCount: cached.readCount,
            }),
          };
        }
      }

      const skill = catalog.getByName(requestedName);
      if (!skill) {
        const message = renderReadError(requestedName, skills);
        return {
          content: [{ type: "text", text: message }],
          details: buildSkillsErrorDetails({
            message,
            requestedName,
            availableNames: skills.map((entry) => entry.name),
          }),
        };
      }

      const cachedEntry = sessionId && readCache
        ? readCache.set(sessionId, skill.name, skill.markdown)
        : null;

      return {
        content: [{ type: "text", text: skill.markdown }],
        details: buildSkillsReadDetails({
          skillName: skill.name,
          cacheHit: false,
          refreshed: refresh,
          sessionScoped,
          readCount: cachedEntry?.readCount,
        }),
      };
    },
  };
}
