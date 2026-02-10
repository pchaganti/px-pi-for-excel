/**
 * Structured tool result metadata for the UI.
 *
 * Tools still return human-readable markdown in `content`, but also attach a
 * small stable `details` payload so the UI doesn't need to parse strings.
 */

import { isRecord } from "../utils/type-guards.js";

export interface WriteCellsDetails {
  kind: "write_cells";
  blocked: boolean;
  /** Sheet-qualified range when known, e.g. "Sheet1!A1:C3" */
  address?: string;
  existingCount?: number;
  formulaErrorCount?: number;
}

export interface FillFormulaDetails {
  kind: "fill_formula";
  blocked: boolean;
  /** Sheet-qualified range when known, e.g. "Sheet1!B2:B20" */
  address?: string;
  existingCount?: number;
  formulaErrorCount?: number;
}

export interface FormatCellsDetails {
  kind: "format_cells";
  /** Sheet-qualified range when known. May be a multi-range string. */
  address?: string;
  warningsCount?: number;
}

export type ExcelToolDetails =
  | WriteCellsDetails
  | FillFormulaDetails
  | FormatCellsDetails;

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}

export function isWriteCellsDetails(value: unknown): value is WriteCellsDetails {
  if (!isRecord(value)) return false;

  if (value.kind !== "write_cells") return false;
  if (typeof value.blocked !== "boolean") return false;

  return (
    isOptionalString(value.address) &&
    isOptionalNumber(value.existingCount) &&
    isOptionalNumber(value.formulaErrorCount)
  );
}

export function isFillFormulaDetails(value: unknown): value is FillFormulaDetails {
  if (!isRecord(value)) return false;

  if (value.kind !== "fill_formula") return false;
  if (typeof value.blocked !== "boolean") return false;

  return (
    isOptionalString(value.address) &&
    isOptionalNumber(value.existingCount) &&
    isOptionalNumber(value.formulaErrorCount)
  );
}

export function isFormatCellsDetails(value: unknown): value is FormatCellsDetails {
  if (!isRecord(value)) return false;

  if (value.kind !== "format_cells") return false;

  return (
    isOptionalString(value.address) &&
    isOptionalNumber(value.warningsCount)
  );
}
