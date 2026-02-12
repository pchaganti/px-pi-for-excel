/**
 * skills — list/read bundled Agent Skills (SKILL.md).
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

import { getAgentSkillByName, listAgentSkills } from "../skills/catalog.js";

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

function renderSkillListMarkdown(): string {
  const skills = listAgentSkills();
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

function renderReadError(name: string): string {
  const available = listAgentSkills().map((skill) => `\`${skill.name}\``).join(", ");
  return [
    `Skill not found: \`${name}\`.`,
    available.length > 0 ? `Available: ${available}.` : "No skills are available.",
  ].join(" ");
}

export function createSkillsTool(): AgentTool<typeof schema, undefined> {
  return {
    name: "skills",
    label: "Skills",
    description:
      "List and read bundled Agent Skills (SKILL.md). "
      + "Use this to load detailed, task-specific workflows on demand.",
    parameters: schema,
    execute: (_toolCallId: string, params: Params): Promise<AgentToolResult<undefined>> => {
      if (params.action === "list") {
        return Promise.resolve({
          content: [{ type: "text", text: renderSkillListMarkdown() }],
          details: undefined,
        });
      }

      const requestedName = params.name?.trim() ?? "";
      if (requestedName.length === 0) {
        return Promise.resolve({
          content: [{ type: "text", text: "Error: name is required when action=read." }],
          details: undefined,
        });
      }

      const skill = getAgentSkillByName(requestedName);
      if (!skill) {
        return Promise.resolve({
          content: [{ type: "text", text: renderReadError(requestedName) }],
          details: undefined,
        });
      }

      return Promise.resolve({
        content: [{ type: "text", text: skill.markdown }],
        details: undefined,
      });
    },
  };
}
