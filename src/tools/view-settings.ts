/**
 * view_settings — Control worksheet display: gridlines, headings, freeze panes, tab color.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { excelRun } from "../excel/helpers.js";
import { getErrorMessage } from "../utils/errors.js";

function StringEnum<T extends string[]>(values: [...T], opts?: { description?: string }) {
  return Type.Union(
    values.map((v) => Type.Literal(v)),
    opts,
  );
}

const schema = Type.Object({
  action: StringEnum(
    [
      "get",
      "show_gridlines",
      "hide_gridlines",
      "show_headings",
      "hide_headings",
      "freeze_rows",
      "freeze_columns",
      "freeze_at",
      "unfreeze",
      "set_tab_color",
    ],
    { description: "The view setting to read or change." },
  ),
  sheet: Type.Optional(
    Type.String({
      description: "Target sheet name. Defaults to the active sheet.",
    }),
  ),
  count: Type.Optional(
    Type.Number({
      description: "Number of rows or columns to freeze. Required for freeze_rows/freeze_columns.",
    }),
  ),
  range: Type.Optional(
    Type.String({
      description:
        "Cell range for freeze_at (e.g. \"B3\"). Everything above and to the left of " +
        "this cell will be frozen.",
    }),
  ),
  color: Type.Optional(
    Type.String({
      description: "Tab color in #RRGGBB format (e.g. \"#FF6600\"). Use \"\" to clear.",
    }),
  ),
});

type Params = Static<typeof schema>;

export function createViewSettingsTool(): AgentTool<typeof schema> {
  return {
    name: "view_settings",
    label: "View Settings",
    description:
      "Read or change worksheet view settings: gridlines, row/column headings, " +
      "freeze panes, and tab color. Use \"get\" to inspect the current state first.",
    parameters: schema,
    execute: async (
      _toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<undefined>> => {
      try {
        const result = await excelRun(async (context) => {
          const sheet = params.sheet
            ? context.workbook.worksheets.getItem(params.sheet)
            : context.workbook.worksheets.getActiveWorksheet();

          switch (params.action) {
            case "get": {
              sheet.load("name, showGridlines, showHeadings, tabColor");
              const frozen = sheet.freezePanes.getLocationOrNullObject();
              frozen.load("address");
              await context.sync();

              const lines: string[] = [
                `Sheet: "${sheet.name}"`,
                `Gridlines: ${sheet.showGridlines ? "visible" : "hidden"}`,
                `Headings: ${sheet.showHeadings ? "visible" : "hidden"}`,
                `Tab color: ${sheet.tabColor || "(none)"}`,
                `Frozen panes: ${frozen.isNullObject ? "none" : frozen.address}`,
              ];
              return lines.join("\n");
            }

            case "show_gridlines": {
              sheet.showGridlines = true;
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Gridlines visible on "${sheet.name}".`;
            }

            case "hide_gridlines": {
              sheet.showGridlines = false;
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Gridlines hidden on "${sheet.name}".`;
            }

            case "show_headings": {
              sheet.showHeadings = true;
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Headings visible on "${sheet.name}".`;
            }

            case "hide_headings": {
              sheet.showHeadings = false;
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Headings hidden on "${sheet.name}".`;
            }

            case "freeze_rows": {
              if (params.count === undefined) throw new Error("count is required for freeze_rows");
              sheet.freezePanes.freezeRows(params.count);
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Froze top ${params.count} row(s) on "${sheet.name}".`;
            }

            case "freeze_columns": {
              if (params.count === undefined) throw new Error("count is required for freeze_columns");
              sheet.freezePanes.freezeColumns(params.count);
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Froze first ${params.count} column(s) on "${sheet.name}".`;
            }

            case "freeze_at": {
              if (!params.range) throw new Error("range is required for freeze_at");
              const ref = params.sheet ? `${params.sheet}!${params.range}` : params.range;
              const freezeRange = params.sheet
                ? sheet.getRange(params.range)
                : context.workbook.worksheets.getActiveWorksheet().getRange(params.range);
              sheet.freezePanes.freezeAt(freezeRange);
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Froze panes at ${ref} on "${sheet.name}".`;
            }

            case "unfreeze": {
              sheet.freezePanes.unfreeze();
              await context.sync();
              sheet.load("name");
              await context.sync();
              return `Unfroze all panes on "${sheet.name}".`;
            }

            case "set_tab_color": {
              if (params.color === undefined) throw new Error("color is required for set_tab_color");
              sheet.tabColor = params.color;
              await context.sync();
              sheet.load("name");
              await context.sync();
              return params.color
                ? `Set tab color to ${params.color} on "${sheet.name}".`
                : `Cleared tab color on "${sheet.name}".`;
            }

            default:
              throw new Error(`Unknown action: ${params.action}`);
          }
        });

        return {
          content: [{ type: "text", text: result }],
          details: undefined,
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text", text: `Error: ${getErrorMessage(e)}` }],
          details: undefined,
        };
      }
    },
  };
}
