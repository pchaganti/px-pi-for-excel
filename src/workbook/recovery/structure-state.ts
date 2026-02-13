/** Structure-state capture/apply for workbook recovery snapshots. */

import { excelRun } from "../../excel/helpers.js";
import { cloneRecoveryModifyStructureState } from "./clone.js";
import type {
  RecoveryModifyStructureState,
  RecoverySheetVisibility,
} from "./types.js";

function isRecoverySheetVisibility(value: unknown): value is RecoverySheetVisibility {
  return value === "Visible" || value === "Hidden" || value === "VeryHidden";
}

type CaptureModifyStructureStateArgs =
  | {
    kind: "sheet_name" | "sheet_visibility" | "sheet_absent";
    sheetRef: string;
  }
  | {
    kind: "rows_absent" | "columns_absent";
    sheetRef: string;
    position: number;
    count: number;
  };

function normalizePositiveInteger(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return null;
  }

  return normalized;
}

function columnNumberToLetter(position: number): string {
  let col = position - 1;
  let letter = "";

  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }

  return letter;
}

async function loadSheetById(
  context: Excel.RequestContext,
  sheetId: string,
): Promise<Excel.Worksheet | null> {
  const sheet = context.workbook.worksheets.getItemOrNullObject(sheetId);
  sheet.load("isNullObject,id,name,visibility,position");
  await context.sync();

  if (sheet.isNullObject) {
    return null;
  }

  return sheet;
}

async function loadSheetByIdOrName(
  context: Excel.RequestContext,
  sheetId: string,
  sheetName: string,
): Promise<Excel.Worksheet | null> {
  const byId = await loadSheetById(context, sheetId);
  if (byId) {
    return byId;
  }

  const byName = context.workbook.worksheets.getItemOrNullObject(sheetName);
  byName.load("isNullObject,id,name,visibility,position");
  await context.sync();

  if (byName.isNullObject) {
    return null;
  }

  return byName;
}

async function sheetHasValueData(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
): Promise<boolean> {
  const usedRange = sheet.getUsedRangeOrNullObject(true);
  usedRange.load("isNullObject");
  await context.sync();
  return !usedRange.isNullObject;
}

async function rangeHasValueData(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
  targetRange: Excel.Range,
): Promise<boolean> {
  const usedRange = sheet.getUsedRangeOrNullObject(true);
  usedRange.load("isNullObject");
  await context.sync();

  if (usedRange.isNullObject) {
    return false;
  }

  const overlap = usedRange.getIntersectionOrNullObject(targetRange);
  overlap.load("isNullObject");
  await context.sync();

  return !overlap.isNullObject;
}

export async function captureModifyStructureState(
  args: CaptureModifyStructureStateArgs,
): Promise<RecoveryModifyStructureState | null> {
  return excelRun<RecoveryModifyStructureState | null>(async (context) => {
    const sheet = context.workbook.worksheets.getItemOrNullObject(args.sheetRef);
    sheet.load("isNullObject,id,name,visibility");
    await context.sync();

    if (sheet.isNullObject) {
      return null;
    }

    if (args.kind === "sheet_name") {
      return {
        kind: "sheet_name",
        sheetId: sheet.id,
        name: sheet.name,
      };
    }

    if (args.kind === "sheet_visibility") {
      const visibility = sheet.visibility;
      if (!isRecoverySheetVisibility(visibility)) {
        return null;
      }

      return {
        kind: "sheet_visibility",
        sheetId: sheet.id,
        visibility,
      };
    }

    if (args.kind === "sheet_absent") {
      return {
        kind: "sheet_absent",
        sheetId: sheet.id,
        sheetName: sheet.name,
      };
    }

    if (args.kind !== "rows_absent" && args.kind !== "columns_absent") {
      return null;
    }

    const position = normalizePositiveInteger(args.position);
    const count = normalizePositiveInteger(args.count);
    if (position === null || count === null) {
      return null;
    }

    return {
      kind: args.kind,
      sheetId: sheet.id,
      sheetName: sheet.name,
      position,
      count,
    };
  });
}

export async function applyModifyStructureState(
  targetState: RecoveryModifyStructureState,
): Promise<RecoveryModifyStructureState> {
  return excelRun<RecoveryModifyStructureState>(async (context) => {
    if (targetState.kind === "sheet_name") {
      const sheet = await loadSheetById(context, targetState.sheetId);
      if (!sheet) {
        throw new Error("Sheet referenced by structure checkpoint no longer exists.");
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "sheet_name",
        sheetId: sheet.id,
        name: sheet.name,
      };

      sheet.name = targetState.name;
      await context.sync();
      return currentState;
    }

    if (targetState.kind === "sheet_visibility") {
      const sheet = await loadSheetById(context, targetState.sheetId);
      if (!sheet) {
        throw new Error("Sheet referenced by structure checkpoint no longer exists.");
      }

      const currentVisibility = sheet.visibility;
      if (!isRecoverySheetVisibility(currentVisibility)) {
        throw new Error("Sheet visibility is unsupported for structure checkpoint restore.");
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "sheet_visibility",
        sheetId: sheet.id,
        visibility: currentVisibility,
      };

      sheet.visibility = targetState.visibility;
      await context.sync();
      return currentState;
    }

    if (targetState.kind === "sheet_absent") {
      const sheet = await loadSheetByIdOrName(context, targetState.sheetId, targetState.sheetName);
      if (!sheet) {
        return cloneRecoveryModifyStructureState(targetState);
      }

      const currentVisibility = sheet.visibility;
      if (!isRecoverySheetVisibility(currentVisibility)) {
        throw new Error("Sheet visibility is unsupported for structure checkpoint restore.");
      }

      if (await sheetHasValueData(context, sheet)) {
        throw new Error(
          "Structure checkpoint restore is blocked: target sheet contains data and cannot be deleted safely.",
        );
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "sheet_present",
        sheetId: sheet.id,
        sheetName: sheet.name,
        position: sheet.position,
        visibility: currentVisibility,
      };

      sheet.delete();
      await context.sync();
      return currentState;
    }

    if (targetState.kind === "sheet_present") {
      const existing = await loadSheetByIdOrName(context, targetState.sheetId, targetState.sheetName);

      if (!existing) {
        const currentState: RecoveryModifyStructureState = {
          kind: "sheet_absent",
          sheetId: targetState.sheetId,
          sheetName: targetState.sheetName,
        };

        const created = context.workbook.worksheets.add(targetState.sheetName);
        created.position = targetState.position;
        created.visibility = targetState.visibility;
        await context.sync();
        return currentState;
      }

      const currentVisibility = existing.visibility;
      if (!isRecoverySheetVisibility(currentVisibility)) {
        throw new Error("Sheet visibility is unsupported for structure checkpoint restore.");
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "sheet_present",
        sheetId: existing.id,
        sheetName: existing.name,
        position: existing.position,
        visibility: currentVisibility,
      };

      existing.name = targetState.sheetName;
      existing.position = targetState.position;
      existing.visibility = targetState.visibility;
      await context.sync();
      return currentState;
    }

    if (targetState.kind === "rows_absent" || targetState.kind === "rows_present") {
      const position = normalizePositiveInteger(targetState.position);
      const count = normalizePositiveInteger(targetState.count);
      if (position === null || count === null) {
        throw new Error("Structure checkpoint is invalid: row position/count is invalid.");
      }

      const sheet = await loadSheetById(context, targetState.sheetId);
      if (!sheet) {
        throw new Error("Sheet referenced by row checkpoint no longer exists.");
      }

      const endRow = position + count - 1;
      const range = sheet.getRange(`${position}:${endRow}`);

      if (targetState.kind === "rows_absent") {
        if (await rangeHasValueData(context, sheet, range)) {
          throw new Error(
            "Structure checkpoint restore is blocked: target rows contain data and cannot be deleted safely.",
          );
        }

        const currentState: RecoveryModifyStructureState = {
          kind: "rows_present",
          sheetId: sheet.id,
          sheetName: sheet.name,
          position,
          count,
        };

        range.delete("Up");
        await context.sync();
        return currentState;
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "rows_absent",
        sheetId: sheet.id,
        sheetName: sheet.name,
        position,
        count,
      };

      range.insert("Down");
      await context.sync();
      return currentState;
    }

    const position = normalizePositiveInteger(targetState.position);
    const count = normalizePositiveInteger(targetState.count);
    if (position === null || count === null) {
      throw new Error("Structure checkpoint is invalid: column position/count is invalid.");
    }

    const sheet = await loadSheetById(context, targetState.sheetId);
    if (!sheet) {
      throw new Error("Sheet referenced by column checkpoint no longer exists.");
    }

    const startLetter = columnNumberToLetter(position);
    const endLetter = columnNumberToLetter(position + count - 1);

    if (targetState.kind === "columns_absent") {
      const range = sheet.getRange(`${startLetter}:${endLetter}`);
      if (await rangeHasValueData(context, sheet, range)) {
        throw new Error(
          "Structure checkpoint restore is blocked: target columns contain data and cannot be deleted safely.",
        );
      }

      const currentState: RecoveryModifyStructureState = {
        kind: "columns_present",
        sheetId: sheet.id,
        sheetName: sheet.name,
        position,
        count,
      };

      range.delete("Left");
      await context.sync();
      return currentState;
    }

    const currentState: RecoveryModifyStructureState = {
      kind: "columns_absent",
      sheetId: sheet.id,
      sheetName: sheet.name,
      position,
      count,
    };

    const range = sheet.getRange(`${startLetter}:${startLetter}`);
    for (let index = 0; index < count; index += 1) {
      range.insert("Right");
    }

    await context.sync();
    return currentState;
  });
}
