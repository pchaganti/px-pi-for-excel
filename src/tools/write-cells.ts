/**
 * write_cells — Write values and formulas to Excel cells.
 *
 * Features:
 * - Overwrite protection (blocks by default if target has data)
 * - Auto-verify: reads back after writing, reports formula errors
 * - Supports formulas (strings starting with "=")
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  excelRun, getRange, qualifiedAddress, parseCell,
  colToLetter, computeRangeAddress, padValues,
} from "../excel/helpers.js";
import { formatAsMarkdownTable, findErrors, countNonEmpty } from "../utils/format.js";

const schema = Type.Object({
  start_cell: Type.String({
    description:
      'Top-left cell to write from, e.g. "A1", "Sheet2!B3". ' +
      "If no sheet is specified, uses the active sheet.",
  }),
  values: Type.Array(Type.Array(Type.Any()), {
    description:
      "2D array of values. Each inner array is a row. " +
      'Strings starting with "=" are formulas. ' +
      'Example: [["Name", "Total"], ["Alice", "=SUM(B2:B10)"]]',
  }),
  allow_overwrite: Type.Optional(
    Type.Boolean({
      description:
        "Set to true to overwrite existing data. Default: false. " +
        "If false and the target range contains data, the write is blocked " +
        "and the existing data is returned so you can ask the user.",
    }),
  ),
});

type Params = Static<typeof schema>;

export function createWriteCellsTool(): AgentTool<typeof schema> {
  return {
    name: "write_cells",
    label: "Write Cells",
    description:
      "Write values and formulas to Excel cells. Provide a start cell and a 2D array. " +
      'Strings starting with "=" are treated as formulas. ' +
      "By default, blocks if the target range already contains data — " +
      "set allow_overwrite=true after confirming with the user. " +
      "After writing, automatically verifies results and reports any formula errors.",
    parameters: schema,
    execute: async (
      _toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<undefined>> => {
      try {
        if (!params.values || params.values.length === 0) {
          return {
            content: [{ type: "text", text: "Error: values array is empty." }],
            details: undefined,
          };
        }

        const { padded, rows, cols } = padValues(params.values);

        const result = await excelRun(async (context: any) => {
          const { sheet, range: startRange } = getRange(context, params.start_cell);
          sheet.load("name");

          // Parse start cell for address computation
          const cellRef = params.start_cell.includes("!")
            ? params.start_cell.split("!")[1]
            : params.start_cell;
          const rangeAddr = computeRangeAddress(cellRef, rows, cols);
          const targetRange = sheet.getRange(rangeAddr);

          // Overwrite protection: check if target has existing data
          if (!params.allow_overwrite) {
            targetRange.load("values");
            await context.sync();

            const existingCount = countNonEmpty(targetRange.values);
            if (existingCount > 0) {
              return {
                blocked: true,
                sheetName: sheet.name,
                address: rangeAddr,
                existingCount,
                existingValues: targetRange.values,
              };
            }
          }

          // Write
          targetRange.values = padded;
          targetRange.format.autofitColumns();
          await context.sync();

          // Read back to verify
          const verify = sheet.getRange(rangeAddr);
          verify.load("values,formulas,address");
          await context.sync();

          return {
            blocked: false,
            sheetName: sheet.name,
            address: verify.address,
            readBackValues: verify.values,
            readBackFormulas: verify.formulas,
          };
        });

        if (result.blocked) {
          return formatBlocked(result);
        }
        return formatSuccess(result, rows, cols);
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error writing cells: ${e.message}` }],
          details: undefined,
        };
      }
    },
  };
}

function formatBlocked(result: any): AgentToolResult<undefined> {
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  const lines: string[] = [];
  lines.push(`⛔ **Write blocked** — ${fullAddr} contains ${result.existingCount} non-empty cell(s).`);
  lines.push("");
  lines.push("**Existing data:**");
  lines.push(formatAsMarkdownTable(result.existingValues));
  lines.push("");
  lines.push(
    "To overwrite, confirm with the user and retry with `allow_overwrite: true`.",
  );
  return { content: [{ type: "text", text: lines.join("\n") }], details: undefined };
}

function formatSuccess(result: any, rows: number, cols: number): AgentToolResult<undefined> {
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  const cellPart = result.address.includes("!") ? result.address.split("!")[1] : result.address;
  const startCell = cellPart.split(":")[0];

  const lines: string[] = [];
  lines.push(`✅ Written to **${fullAddr}** (${rows}×${cols})`);

  // Check for formula errors
  const errors = findErrors(result.readBackValues, startCell);
  if (errors.length > 0) {
    // Attach formula info to errors
    const start = parseCell(startCell);
    for (const err of errors) {
      const errCell = parseCell(err.address);
      const r = errCell.row - start.row;
      const c = errCell.col - start.col;
      if (r >= 0 && c >= 0 && r < result.readBackFormulas.length && c < result.readBackFormulas[r].length) {
        err.formula = result.readBackFormulas[r][c];
      }
    }

    lines.push("");
    lines.push(`⚠️ **${errors.length} formula error(s):**`);
    for (const e of errors) {
      lines.push(`- ${e.address}: ${e.error}${e.formula ? ` (formula: ${e.formula})` : ""}`);
    }
    lines.push("");
    lines.push("Review and fix with another write_cells call.");
  } else {
    lines.push("");
    lines.push("**Verified values:**");
    lines.push(formatAsMarkdownTable(result.readBackValues));
  }

  return { content: [{ type: "text", text: lines.join("\n") }], details: undefined };
}
