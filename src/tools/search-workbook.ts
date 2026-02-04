/**
 * search_workbook — Search for text, values, or formulas across the workbook.
 *
 * Supports substring and formula search modes.
 * Returns matching cells with their sheet, address, value, and formula.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { excelRun, qualifiedAddress } from "../excel/helpers.js";

const schema = Type.Object({
  query: Type.String({
    description: 'Search term. For formula search, use references like "Sheet1!" to find cross-sheet links.',
  }),
  search_formulas: Type.Optional(
    Type.Boolean({
      description:
        "If true, search in formula text instead of values. " +
        'Useful for finding cross-sheet references (e.g. query "Inputs!" to find all cells referencing Inputs sheet).',
    }),
  ),
  sheet: Type.Optional(
    Type.String({
      description: "Restrict search to this sheet. If omitted, searches all sheets.",
    }),
  ),
  max_results: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return. Default: 20.",
    }),
  ),
});

type Params = Static<typeof schema>;

interface SearchMatch {
  sheet: string;
  address: string;
  value: any;
  formula?: string;
}

export function createSearchWorkbookTool(): AgentTool<typeof schema> {
  return {
    name: "search_workbook",
    label: "Search Workbook",
    description:
      "Search for text, values, or formulas across the workbook. " +
      "Returns matching cells with sheet name, address, value, and formula. " +
      "Use this to find specific data, locate cells by label, or trace cross-sheet references.",
    parameters: schema,
    execute: async (
      _toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<undefined>> => {
      try {
        const maxResults = params.max_results || 20;
        const searchFormulas = params.search_formulas || false;
        const query = params.query.toLowerCase();

        const matches = await excelRun(async (context: any) => {
          const allMatches: SearchMatch[] = [];
          const sheets = context.workbook.worksheets;
          sheets.load("items/name,items/visibility");
          await context.sync();

          const targetSheets = params.sheet
            ? sheets.items.filter((s: any) => s.name === params.sheet)
            : sheets.items.filter((s: any) => s.visibility === "Visible");

          for (const sheet of targetSheets) {
            const used = sheet.getUsedRangeOrNullObject();
            used.load("values,formulas,address,rowCount,columnCount");
            await context.sync();

            if (used.isNullObject) continue;

            const values = used.values;
            const formulas = used.formulas;

            // Parse start address for cell computation
            const addr = used.address;
            const cellPart = addr.includes("!") ? addr.split("!")[1] : addr;
            const startMatch = cellPart.split(":")[0].match(/^([A-Z]+)(\d+)$/i);
            if (!startMatch) continue;

            let startCol = 0;
            for (let i = 0; i < startMatch[1].length; i++) {
              startCol = startCol * 26 + (startMatch[1].charCodeAt(i) - 64);
            }
            startCol--;
            const startRow = parseInt(startMatch[2], 10);

            for (let r = 0; r < values.length; r++) {
              for (let c = 0; c < values[r].length; c++) {
                if (allMatches.length >= maxResults) break;

                const value = values[r][c];
                const formula = formulas[r][c];

                let match = false;
                if (searchFormulas) {
                  match = typeof formula === "string" && formula.toLowerCase().includes(query);
                } else {
                  match = String(value).toLowerCase().includes(query);
                }

                if (match) {
                  // Compute cell address
                  let col = startCol + c;
                  let letter = "";
                  let temp = col;
                  while (temp >= 0) {
                    letter = String.fromCharCode((temp % 26) + 65) + letter;
                    temp = Math.floor(temp / 26) - 1;
                  }
                  const cellAddr = `${letter}${startRow + r}`;

                  allMatches.push({
                    sheet: sheet.name,
                    address: cellAddr,
                    value,
                    formula: typeof formula === "string" && formula.startsWith("=") ? formula : undefined,
                  });
                }
              }
              if (allMatches.length >= maxResults) break;
            }
          }
          return allMatches;
        });

        if (matches.length === 0) {
          const scope = params.sheet ? `in "${params.sheet}"` : "in any sheet";
          const mode = searchFormulas ? "formulas" : "values";
          return {
            content: [{ type: "text", text: `No matches for "${params.query}" ${scope} (searched ${mode}).` }],
            details: undefined,
          };
        }

        const lines: string[] = [];
        lines.push(`**${matches.length} match(es)** for "${params.query}"${matches.length >= maxResults ? " (limit reached)" : ""}:`);
        lines.push("");

        for (const m of matches) {
          const addr = qualifiedAddress(m.sheet, m.address);
          const val = typeof m.value === "string" && m.value.length > 60
            ? m.value.substring(0, 60) + "…"
            : String(m.value);
          const formulaStr = m.formula ? ` ← ${m.formula}` : "";
          lines.push(`- **${addr}**: ${val}${formulaStr}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: undefined,
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error searching: ${e.message}` }],
          details: undefined,
        };
      }
    },
  };
}
