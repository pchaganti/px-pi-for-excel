/**
 * Tool registry — creates all Excel tools for the agent.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createGetWorkbookOverviewTool } from "./get-workbook-overview.js";
import { createReadRangeTool } from "./read-range.js";
import { createWriteCellsTool } from "./write-cells.js";
import { createSearchWorkbookTool } from "./search-workbook.js";
import { createModifyStructureTool } from "./modify-structure.js";
import { createFormatCellsTool } from "./format-cells.js";
import { createTraceDependenciesTool } from "./trace-dependencies.js";

/** Create all 7 Excel tools */
export function createAllTools(): AgentTool<any>[] {
  return [
    createGetWorkbookOverviewTool(),
    createReadRangeTool(),
    createWriteCellsTool(),
    createSearchWorkbookTool(),
    createModifyStructureTool(),
    createFormatCellsTool(),
    createTraceDependenciesTool(),
  ];
}
