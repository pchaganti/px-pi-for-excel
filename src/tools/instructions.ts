/**
 * instructions — update persistent user/workbook instructions.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import {
  applyInstructionAction,
  getUserInstructions,
  getWorkbookInstructions,
  setUserInstructions,
  setWorkbookInstructions,
  USER_INSTRUCTIONS_SOFT_LIMIT,
  WORKBOOK_INSTRUCTIONS_SOFT_LIMIT,
} from "../instructions/store.js";
import { getWorkbookContext } from "../workbook/context.js";
import { getErrorMessage } from "../utils/errors.js";

const schema = Type.Object({
  action: Type.Union([
    Type.Literal("append"),
    Type.Literal("replace"),
  ], {
    description: "append = add to existing instructions, replace = rewrite the full instructions text",
  }),
  level: Type.Union([
    Type.Literal("user"),
    Type.Literal("workbook"),
  ], {
    description: "Target instruction scope.",
  }),
  content: Type.String({
    description:
      "Instruction text to save. For append, this is the new line/note to add. For replace, this becomes the full text.",
  }),
});

type Params = Static<typeof schema>;

function getSoftLimit(level: Params["level"]): number {
  return level === "user" ? USER_INSTRUCTIONS_SOFT_LIMIT : WORKBOOK_INSTRUCTIONS_SOFT_LIMIT;
}

function emitInstructionsUpdatedEvent(): void {
  if (typeof document === "undefined") return;

  document.dispatchEvent(new CustomEvent("pi:instructions-updated"));
  document.dispatchEvent(new CustomEvent("pi:status-update"));
}

export function createInstructionsTool(): AgentTool<typeof schema, undefined> {
  return {
    name: "instructions",
    label: "Instructions",
    description:
      "Update persistent instructions for the agent. " +
      "Use level=user for personal preferences and level=workbook for workbook-specific notes.",
    parameters: schema,
    execute: async (
      _toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<undefined>> => {
      try {
        const storage = getAppStorage();
        const settings = storage.settings;

        if (params.action === "append" && params.content.trim().length === 0) {
          return {
            content: [{ type: "text", text: "Error: content is required for append." }],
            details: undefined,
          };
        }

        if (params.level === "user") {
          const current = await getUserInstructions(settings);
          const updated = applyInstructionAction({
            currentValue: current,
            action: params.action,
            content: params.content,
          });

          const saved = await setUserInstructions(settings, updated);
          emitInstructionsUpdatedEvent();

          const body = saved ?? "(No user instructions set.)";
          const warning =
            saved && saved.length > USER_INSTRUCTIONS_SOFT_LIMIT
              ? `\n\n⚠️ User instructions are above the ${USER_INSTRUCTIONS_SOFT_LIMIT}-char soft limit.`
              : "";

          return {
            content: [
              {
                type: "text",
                text: `Updated user instructions (${saved?.length ?? 0}/${USER_INSTRUCTIONS_SOFT_LIMIT} chars):\n\n${body}${warning}`,
              },
            ],
            details: undefined,
          };
        }

        const workbookContext = await getWorkbookContext();
        const workbookId = workbookContext.workbookId;

        if (!workbookId) {
          return {
            content: [{
              type: "text",
              text: "Error: workbook identity unavailable. Can't update workbook instructions right now.",
            }],
            details: undefined,
          };
        }

        const current = await getWorkbookInstructions(settings, workbookId);
        const updated = applyInstructionAction({
          currentValue: current,
          action: params.action,
          content: params.content,
        });

        const saved = await setWorkbookInstructions(settings, workbookId, updated);
        emitInstructionsUpdatedEvent();

        const limit = getSoftLimit(params.level);
        const body = saved ?? "(No workbook instructions set.)";
        const warning =
          saved && saved.length > limit
            ? `\n\n⚠️ Workbook instructions are above the ${limit}-char soft limit.`
            : "";

        return {
          content: [
            {
              type: "text",
              text: `Updated workbook instructions (${saved?.length ?? 0}/${limit} chars):\n\n${body}${warning}`,
            },
          ],
          details: undefined,
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text", text: `Error updating instructions: ${getErrorMessage(error)}` }],
          details: undefined,
        };
      }
    },
  };
}
