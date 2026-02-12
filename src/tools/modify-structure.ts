/**
 * modify_structure — Insert/delete rows, columns, and sheets.
 *
 * Single tool for all structural changes (sheets, rows, columns).
 * into a single tool.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { excelRun } from "../excel/helpers.js";
import { getWorkbookChangeAuditLog } from "../audit/workbook-change-audit.js";
import { dispatchWorkbookSnapshotCreated } from "../workbook/recovery-events.js";
import { getWorkbookRecoveryLog } from "../workbook/recovery-log.js";
import { captureModifyStructureState, type RecoveryModifyStructureState } from "../workbook/recovery-states.js";
import { getErrorMessage } from "../utils/errors.js";
import type { ModifyStructureDetails } from "./tool-details.js";
import {
  CHECKPOINT_SKIPPED_NOTE,
  CHECKPOINT_SKIPPED_REASON,
  recoveryCheckpointCreated,
  recoveryCheckpointUnavailable,
} from "./recovery-metadata.js";

// Helper for string enum (TypeBox doesn't have a built-in StringEnum)
function StringEnum<T extends string[]>(values: [...T], opts?: { description?: string }) {
  return Type.Union(
    values.map((v) => Type.Literal(v)),
    opts,
  );
}

const schema = Type.Object({
  action: StringEnum(
    [
      "insert_rows",
      "delete_rows",
      "insert_columns",
      "delete_columns",
      "add_sheet",
      "delete_sheet",
      "rename_sheet",
      "duplicate_sheet",
      "hide_sheet",
      "unhide_sheet",
    ],
    { description: "The structural modification to perform." },
  ),
  sheet: Type.Optional(
    Type.String({
      description:
        "Target sheet name. Required for sheet operations and row/column operations on a specific sheet. " +
        "If omitted for row/column ops, uses the active sheet.",
    }),
  ),
  position: Type.Optional(
    Type.Number({
      description:
        "For insert_rows/delete_rows: the 1-indexed row number. " +
        "For insert_columns/delete_columns: the 1-indexed column number. " +
        "For add_sheet: the 0-indexed position to insert the new sheet.",
    }),
  ),
  count: Type.Optional(
    Type.Number({
      description: "Number of rows or columns to insert/delete. Default: 1.",
    }),
  ),
  new_name: Type.Optional(
    Type.String({
      description: 'New name for rename_sheet or add_sheet. Also used for duplicate_sheet target name.',
    }),
  ),
});

type Params = Static<typeof schema>;

interface StructureMutationResult {
  message: string;
  changedCount: number;
  outputAddress?: string;
  summary: string;
}

type SupportedStructureCheckpointAction = "rename_sheet" | "hide_sheet" | "unhide_sheet";

function supportedCheckpointActionFor(
  action: Params["action"],
): SupportedStructureCheckpointAction | null {
  if (action === "rename_sheet" || action === "hide_sheet" || action === "unhide_sheet") {
    return action;
  }

  return null;
}

function checkpointStateKindFor(
  action: SupportedStructureCheckpointAction,
): RecoveryModifyStructureState["kind"] {
  return action === "rename_sheet" ? "sheet_name" : "sheet_visibility";
}

function unsupportedStructureCheckpointReason(action: Params["action"]): string {
  return `Checkpoint capture is not yet supported for modify_structure action \`${action}\`.`;
}

function appendResultNote(result: AgentToolResult<ModifyStructureDetails>, note: string): void {
  const first = result.content[0];
  if (!first || first.type !== "text") return;
  first.text = `${first.text}\n\n${note}`;
}

function columnNumberToLetter(position: number): string {
  let col = position - 1; // 0-indexed
  let letter = "";

  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }

  return letter;
}

export function createModifyStructureTool(): AgentTool<typeof schema, ModifyStructureDetails> {
  return {
    name: "modify_structure",
    label: "Modify Structure",
    description:
      "Modify the workbook structure: insert/delete rows and columns, " +
      "add/delete/rename/duplicate/hide/unhide sheets. " +
      "Be careful with deletions — there is no undo.",
    parameters: schema,
    execute: async (
      toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<ModifyStructureDetails>> => {
      try {
        const checkpointAction = supportedCheckpointActionFor(params.action);
        const checkpointKind = checkpointAction ? checkpointStateKindFor(checkpointAction) : null;

        let checkpointState: RecoveryModifyStructureState | null = null;
        let checkpointUnavailableReason = checkpointAction
          ? null
          : unsupportedStructureCheckpointReason(params.action);

        if (checkpointKind && typeof params.sheet === "string" && params.sheet.trim().length > 0) {
          checkpointState = await captureModifyStructureState({
            kind: checkpointKind,
            sheetRef: params.sheet,
          });

          if (!checkpointState) {
            checkpointUnavailableReason =
              `Checkpoint capture was skipped for \`${params.action}\` (sheet state unavailable).`;
          }
        }

        const result = await excelRun<StructureMutationResult>(async (context) => {
          const action = params.action;
          const count = params.count || 1;

          const getSheet = () => {
            if (params.sheet) {
              return context.workbook.worksheets.getItem(params.sheet);
            }
            return context.workbook.worksheets.getActiveWorksheet();
          };

          switch (action) {
            case "insert_rows": {
              if (!params.position) throw new Error("position is required for insert_rows");
              const startRow = params.position;
              const endRow = params.position + count - 1;
              const sheet = getSheet();
              const range = sheet.getRange(`${startRow}:${endRow}`);
              range.insert("Down");
              await context.sync();
              sheet.load("name");
              await context.sync();
              return {
                message: `Inserted ${count} row(s) at row ${startRow} in "${sheet.name}".`,
                changedCount: count,
                outputAddress: `${sheet.name}!${startRow}:${endRow}`,
                summary: `inserted ${count} row(s)`,
              };
            }

            case "delete_rows": {
              if (!params.position) throw new Error("position is required for delete_rows");
              const startRow = params.position;
              const endRow = params.position + count - 1;
              const sheet = getSheet();
              const range = sheet.getRange(`${startRow}:${endRow}`);
              range.delete("Up");
              await context.sync();
              sheet.load("name");
              await context.sync();
              return {
                message: `Deleted ${count} row(s) starting at row ${startRow} in "${sheet.name}".`,
                changedCount: count,
                outputAddress: `${sheet.name}!${startRow}:${endRow}`,
                summary: `deleted ${count} row(s)`,
              };
            }

            case "insert_columns": {
              if (!params.position) throw new Error("position is required for insert_columns");
              const startLetter = columnNumberToLetter(params.position);
              const endLetter = columnNumberToLetter(params.position + count - 1);
              const sheet = getSheet();
              const range = sheet.getRange(`${startLetter}:${startLetter}`);
              for (let i = 0; i < count; i++) {
                range.insert("Right");
              }
              await context.sync();
              sheet.load("name");
              await context.sync();
              return {
                message: `Inserted ${count} column(s) at column ${params.position} (${startLetter}) in "${sheet.name}".`,
                changedCount: count,
                outputAddress: `${sheet.name}!${startLetter}:${endLetter}`,
                summary: `inserted ${count} column(s)`,
              };
            }

            case "delete_columns": {
              if (!params.position) throw new Error("position is required for delete_columns");
              const startLetter = columnNumberToLetter(params.position);
              const endLetter = columnNumberToLetter(params.position + count - 1);
              const sheet = getSheet();
              const range = sheet.getRange(`${startLetter}:${endLetter}`);
              range.delete("Left");
              await context.sync();
              sheet.load("name");
              await context.sync();
              return {
                message: `Deleted ${count} column(s) starting at column ${params.position} (${startLetter}) in "${sheet.name}".`,
                changedCount: count,
                outputAddress: `${sheet.name}!${startLetter}:${endLetter}`,
                summary: `deleted ${count} column(s)`,
              };
            }

            case "add_sheet": {
              const name = params.new_name || `Sheet${Date.now()}`;
              const newSheet = context.workbook.worksheets.add(name);
              if (params.position !== undefined) {
                newSheet.position = params.position;
              }
              await context.sync();
              return {
                message: `Added sheet "${name}".`,
                changedCount: 1,
                outputAddress: name,
                summary: `added sheet ${name}`,
              };
            }

            case "delete_sheet": {
              if (!params.sheet) throw new Error("sheet name is required for delete_sheet");
              const sheetName = params.sheet;
              const sheet = context.workbook.worksheets.getItem(sheetName);
              sheet.delete();
              await context.sync();
              return {
                message: `Deleted sheet "${sheetName}".`,
                changedCount: 1,
                outputAddress: sheetName,
                summary: `deleted sheet ${sheetName}`,
              };
            }

            case "rename_sheet": {
              if (!params.sheet) throw new Error("sheet name is required for rename_sheet");
              if (!params.new_name) throw new Error("new_name is required for rename_sheet");
              const previousName = params.sheet;
              const newName = params.new_name;
              const sheet = context.workbook.worksheets.getItem(previousName);
              sheet.name = newName;
              await context.sync();
              return {
                message: `Renamed sheet "${previousName}" to "${newName}".`,
                changedCount: 1,
                outputAddress: newName,
                summary: `renamed sheet ${previousName} to ${newName}`,
              };
            }

            case "duplicate_sheet": {
              if (!params.sheet) throw new Error("sheet name is required for duplicate_sheet");
              const source = context.workbook.worksheets.getItem(params.sheet);
              const copy = source.copy("End");
              await context.sync();
              if (params.new_name) {
                copy.load("name");
                await context.sync();
                copy.name = params.new_name;
                await context.sync();
                return {
                  message: `Duplicated "${params.sheet}" as "${params.new_name}".`,
                  changedCount: 1,
                  outputAddress: params.new_name,
                  summary: `duplicated sheet ${params.sheet} as ${params.new_name}`,
                };
              }
              copy.load("name");
              await context.sync();
              return {
                message: `Duplicated "${params.sheet}" as "${copy.name}".`,
                changedCount: 1,
                outputAddress: copy.name,
                summary: `duplicated sheet ${params.sheet}`,
              };
            }

            case "hide_sheet": {
              if (!params.sheet) throw new Error("sheet name is required for hide_sheet");
              const sheet = context.workbook.worksheets.getItem(params.sheet);
              sheet.visibility = "Hidden";
              await context.sync();
              return {
                message: `Hidden sheet "${params.sheet}".`,
                changedCount: 1,
                outputAddress: params.sheet,
                summary: `hidden sheet ${params.sheet}`,
              };
            }

            case "unhide_sheet": {
              if (!params.sheet) throw new Error("sheet name is required for unhide_sheet");
              const sheet = context.workbook.worksheets.getItem(params.sheet);
              sheet.visibility = "Visible";
              await context.sync();
              return {
                message: `Unhidden sheet "${params.sheet}".`,
                changedCount: 1,
                outputAddress: params.sheet,
                summary: `unhidden sheet ${params.sheet}`,
              };
            }

            default:
              throw new Error(`Unknown action: ${String(action as string)}`);
          }
        });

        await getWorkbookChangeAuditLog().append({
          toolName: "modify_structure",
          toolCallId,
          blocked: false,
          outputAddress: result.outputAddress,
          changedCount: result.changedCount,
          changes: [],
          summary: result.summary,
        });

        const toolResult: AgentToolResult<ModifyStructureDetails> = {
          content: [{ type: "text", text: result.message }],
          details: {
            kind: "modify_structure",
            action: params.action,
          },
        };

        const checkpointAddress = result.outputAddress ?? params.sheet ?? params.action;

        if (checkpointAction && checkpointState) {
          const checkpoint = await getWorkbookRecoveryLog().appendModifyStructure({
            toolName: "modify_structure",
            toolCallId,
            address: checkpointAddress,
            changedCount: result.changedCount,
            modifyStructureState: checkpointState,
          });

          if (checkpoint) {
            toolResult.details.recovery = recoveryCheckpointCreated(checkpoint.id);
            dispatchWorkbookSnapshotCreated({
              snapshotId: checkpoint.id,
              toolName: checkpoint.toolName,
              address: checkpoint.address,
              changedCount: checkpoint.changedCount,
            });
          } else {
            toolResult.details.recovery = recoveryCheckpointUnavailable(CHECKPOINT_SKIPPED_REASON);
            appendResultNote(toolResult, CHECKPOINT_SKIPPED_NOTE);
          }
        } else {
          const reason = checkpointUnavailableReason ?? CHECKPOINT_SKIPPED_REASON;
          toolResult.details.recovery = recoveryCheckpointUnavailable(reason);
          appendResultNote(toolResult, CHECKPOINT_SKIPPED_NOTE);
        }

        return toolResult;
      } catch (e: unknown) {
        const message = getErrorMessage(e);

        await getWorkbookChangeAuditLog().append({
          toolName: "modify_structure",
          toolCallId,
          blocked: true,
          outputAddress: params.sheet,
          changedCount: 0,
          changes: [],
          summary: `error: ${message}`,
        });

        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: {
            kind: "modify_structure",
            action: params.action,
          },
        };
      }
    },
  };
}
