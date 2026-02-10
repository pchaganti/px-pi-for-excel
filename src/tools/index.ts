/**
 * Tool registry — creates all 10 Excel tools for the agent.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";
import { createGetWorkbookOverviewTool } from "./get-workbook-overview.js";
import { createReadRangeTool } from "./read-range.js";
import { createWriteCellsTool } from "./write-cells.js";
import { createSearchWorkbookTool } from "./search-workbook.js";
import { createModifyStructureTool } from "./modify-structure.js";
import { createFormatCellsTool } from "./format-cells.js";
import { createTraceDependenciesTool } from "./trace-dependencies.js";
import { createConditionalFormatTool } from "./conditional-format.js";
import { createFillFormulaTool } from "./fill-formula.js";
import { createViewSettingsTool } from "./view-settings.js";
import { createCommentsTool } from "./comments.js";

type AnyTool = AgentTool<TSchema, unknown>;

/** Create all 11 Excel tools */
export function createAllTools(): AnyTool[] {
  return [
    createGetWorkbookOverviewTool(),
    createReadRangeTool(),
    createWriteCellsTool(),
    createFillFormulaTool(),
    createSearchWorkbookTool(),
    createModifyStructureTool(),
    createFormatCellsTool(),
    createConditionalFormatTool(),
    createTraceDependenciesTool(),
    createViewSettingsTool(),
    createCommentsTool(),
  ] as unknown as AnyTool[];
}
