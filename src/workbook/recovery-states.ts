import { excelRun, getRange, parseRangeRef } from "../excel/helpers.js";
import { isRecord } from "../utils/type-guards.js";

export type RecoveryConditionalCellValueOperator =
  | "Between"
  | "NotBetween"
  | "EqualTo"
  | "NotEqualTo"
  | "GreaterThan"
  | "LessThan"
  | "GreaterThanOrEqual"
  | "LessThanOrEqual";

export interface RecoveryConditionalFormatRule {
  type: "custom" | "cell_value";
  stopIfTrue?: boolean;
  formula?: string;
  operator?: RecoveryConditionalCellValueOperator;
  formula1?: string;
  formula2?: string;
  fillColor?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  appliesToAddress?: string;
}

export interface RecoveryConditionalFormatCaptureResult {
  supported: boolean;
  rules: RecoveryConditionalFormatRule[];
  reason?: string;
}

export interface RecoveryCommentThreadState {
  exists: boolean;
  content: string;
  resolved: boolean;
  replies: string[];
}

export interface RecoveryFormatSelection {
  numberFormat?: boolean;
  fillColor?: boolean;
  fontColor?: boolean;
  bold?: boolean;
  italic?: boolean;
  underlineStyle?: boolean;
  fontName?: boolean;
  fontSize?: boolean;
  horizontalAlignment?: boolean;
  verticalAlignment?: boolean;
  wrapText?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  borderInsideHorizontal?: boolean;
  borderInsideVertical?: boolean;
}

export interface RecoveryFormatBorderState {
  style: string;
  weight?: string;
  color?: string;
}

export interface RecoveryFormatAreaState {
  address: string;
  rowCount: number;
  columnCount: number;
  numberFormat?: string[][];
  fillColor?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underlineStyle?: string;
  fontName?: string;
  fontSize?: number;
  horizontalAlignment?: string;
  verticalAlignment?: string;
  wrapText?: boolean;
  borderTop?: RecoveryFormatBorderState;
  borderBottom?: RecoveryFormatBorderState;
  borderLeft?: RecoveryFormatBorderState;
  borderRight?: RecoveryFormatBorderState;
  borderInsideHorizontal?: RecoveryFormatBorderState;
  borderInsideVertical?: RecoveryFormatBorderState;
}

export interface RecoveryFormatRangeState {
  selection: RecoveryFormatSelection;
  areas: RecoveryFormatAreaState[];
  cellCount: number;
}

export interface RecoveryFormatCaptureResult {
  supported: boolean;
  state?: RecoveryFormatRangeState;
  reason?: string;
}

const SUPPORTED_CELL_VALUE_OPERATORS: readonly RecoveryConditionalCellValueOperator[] = [
  "Between",
  "NotBetween",
  "EqualTo",
  "NotEqualTo",
  "GreaterThan",
  "LessThan",
  "GreaterThanOrEqual",
  "LessThanOrEqual",
];

const RECOVERY_BORDER_KEYS = [
  "borderTop",
  "borderBottom",
  "borderLeft",
  "borderRight",
  "borderInsideHorizontal",
  "borderInsideVertical",
] as const;

type RecoveryBorderKey = (typeof RECOVERY_BORDER_KEYS)[number];

type RecoveryBorderEdge =
  | "EdgeTop"
  | "EdgeBottom"
  | "EdgeLeft"
  | "EdgeRight"
  | "InsideHorizontal"
  | "InsideVertical";

const BORDER_KEY_TO_EDGE: Record<RecoveryBorderKey, RecoveryBorderEdge> = {
  borderTop: "EdgeTop",
  borderBottom: "EdgeBottom",
  borderLeft: "EdgeLeft",
  borderRight: "EdgeRight",
  borderInsideHorizontal: "InsideHorizontal",
  borderInsideVertical: "InsideVertical",
};

function isRecoveryConditionalCellValueOperator(value: unknown): value is RecoveryConditionalCellValueOperator {
  if (typeof value !== "string") return false;

  for (const operator of SUPPORTED_CELL_VALUE_OPERATORS) {
    if (operator === value) {
      return true;
    }
  }

  return false;
}

type RecoveryUnderlineStyle = "None" | "Single" | "Double" | "SingleAccountant" | "DoubleAccountant";

const RECOVERY_UNDERLINE_STYLES: readonly RecoveryUnderlineStyle[] = [
  "None",
  "Single",
  "Double",
  "SingleAccountant",
  "DoubleAccountant",
];

function isRecoveryUnderlineStyle(value: unknown): value is RecoveryUnderlineStyle {
  if (typeof value !== "string") return false;

  for (const candidate of RECOVERY_UNDERLINE_STYLES) {
    if (candidate === value) return true;
  }

  return false;
}

type RecoveryHorizontalAlignment =
  | "General"
  | "Left"
  | "Center"
  | "Right"
  | "Fill"
  | "Justify"
  | "CenterAcrossSelection"
  | "Distributed";

const RECOVERY_HORIZONTAL_ALIGNMENTS: readonly RecoveryHorizontalAlignment[] = [
  "General",
  "Left",
  "Center",
  "Right",
  "Fill",
  "Justify",
  "CenterAcrossSelection",
  "Distributed",
];

function isRecoveryHorizontalAlignment(value: unknown): value is RecoveryHorizontalAlignment {
  if (typeof value !== "string") return false;

  for (const candidate of RECOVERY_HORIZONTAL_ALIGNMENTS) {
    if (candidate === value) return true;
  }

  return false;
}

type RecoveryVerticalAlignment = "Top" | "Center" | "Bottom" | "Justify" | "Distributed";

const RECOVERY_VERTICAL_ALIGNMENTS: readonly RecoveryVerticalAlignment[] = [
  "Top",
  "Center",
  "Bottom",
  "Justify",
  "Distributed",
];

function isRecoveryVerticalAlignment(value: unknown): value is RecoveryVerticalAlignment {
  if (typeof value !== "string") return false;

  for (const candidate of RECOVERY_VERTICAL_ALIGNMENTS) {
    if (candidate === value) return true;
  }

  return false;
}

type RecoveryRangeBorderStyle =
  | "None"
  | "Continuous"
  | "Dash"
  | "DashDot"
  | "DashDotDot"
  | "Dot"
  | "Double"
  | "SlantDashDot";

const RECOVERY_RANGE_BORDER_STYLES: readonly RecoveryRangeBorderStyle[] = [
  "None",
  "Continuous",
  "Dash",
  "DashDot",
  "DashDotDot",
  "Dot",
  "Double",
  "SlantDashDot",
];

function isRecoveryRangeBorderStyle(value: unknown): value is RecoveryRangeBorderStyle {
  if (typeof value !== "string") return false;

  for (const candidate of RECOVERY_RANGE_BORDER_STYLES) {
    if (candidate === value) return true;
  }

  return false;
}

type RecoveryRangeBorderWeight = "Hairline" | "Thin" | "Medium" | "Thick";

const RECOVERY_RANGE_BORDER_WEIGHTS: readonly RecoveryRangeBorderWeight[] = [
  "Hairline",
  "Thin",
  "Medium",
  "Thick",
];

function isRecoveryRangeBorderWeight(value: unknown): value is RecoveryRangeBorderWeight {
  if (typeof value !== "string") return false;

  for (const candidate of RECOVERY_RANGE_BORDER_WEIGHTS) {
    if (candidate === value) return true;
  }

  return false;
}

function normalizeConditionalFormatType(type: unknown): "custom" | "cell_value" | null {
  if (type === "Custom" || type === "custom") {
    return "custom";
  }

  if (type === "CellValue" || type === "cellValue") {
    return "cell_value";
  }

  return null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeUnderline(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return value !== "None";
  }

  return undefined;
}

function emptyCommentThreadState(): RecoveryCommentThreadState {
  return {
    exists: false,
    content: "",
    resolved: false,
    replies: [],
  };
}

function localAddressPart(address: string): string {
  const trimmed = address.trim();
  const separatorIndex = trimmed.lastIndexOf("!");
  if (separatorIndex < 0) {
    return trimmed;
  }

  return trimmed.slice(separatorIndex + 1);
}

function quoteSheetName(sheetName: string): string {
  const escaped = sheetName.replace(/'/g, "''");
  const needsQuote = /[\s'!]/.test(sheetName);
  return needsQuote ? `'${escaped}'` : sheetName;
}

function qualifyAddressWithSheet(sheetName: string, address: string): string {
  const local = localAddressPart(address);
  return `${quoteSheetName(sheetName)}!${local}`;
}

export function firstCellAddress(address: string): string {
  const local = localAddressPart(address);
  const firstArea = local.split(",")[0] ?? local;
  const first = firstArea.split(":")[0] ?? firstArea;
  return first.trim();
}

function cloneRecoveryConditionalFormatRule(rule: RecoveryConditionalFormatRule): RecoveryConditionalFormatRule {
  return {
    type: rule.type,
    stopIfTrue: rule.stopIfTrue,
    formula: rule.formula,
    operator: rule.operator,
    formula1: rule.formula1,
    formula2: rule.formula2,
    fillColor: rule.fillColor,
    fontColor: rule.fontColor,
    bold: rule.bold,
    italic: rule.italic,
    underline: rule.underline,
    appliesToAddress: rule.appliesToAddress,
  };
}

export function cloneRecoveryConditionalFormatRules(
  rules: readonly RecoveryConditionalFormatRule[],
): RecoveryConditionalFormatRule[] {
  return rules.map((rule) => cloneRecoveryConditionalFormatRule(rule));
}

export function cloneRecoveryCommentThreadState(state: RecoveryCommentThreadState): RecoveryCommentThreadState {
  return {
    exists: state.exists,
    content: state.content,
    resolved: state.resolved,
    replies: [...state.replies],
  };
}

function cloneRecoveryFormatSelection(selection: RecoveryFormatSelection): RecoveryFormatSelection {
  return {
    numberFormat: selection.numberFormat,
    fillColor: selection.fillColor,
    fontColor: selection.fontColor,
    bold: selection.bold,
    italic: selection.italic,
    underlineStyle: selection.underlineStyle,
    fontName: selection.fontName,
    fontSize: selection.fontSize,
    horizontalAlignment: selection.horizontalAlignment,
    verticalAlignment: selection.verticalAlignment,
    wrapText: selection.wrapText,
    borderTop: selection.borderTop,
    borderBottom: selection.borderBottom,
    borderLeft: selection.borderLeft,
    borderRight: selection.borderRight,
    borderInsideHorizontal: selection.borderInsideHorizontal,
    borderInsideVertical: selection.borderInsideVertical,
  };
}

function cloneRecoveryFormatBorderState(state: RecoveryFormatBorderState): RecoveryFormatBorderState {
  return {
    style: state.style,
    weight: state.weight,
    color: state.color,
  };
}

function cloneStringGrid(grid: readonly string[][]): string[][] {
  return grid.map((row) => [...row]);
}

function cloneRecoveryFormatAreaState(area: RecoveryFormatAreaState): RecoveryFormatAreaState {
  return {
    address: area.address,
    rowCount: area.rowCount,
    columnCount: area.columnCount,
    numberFormat: area.numberFormat ? cloneStringGrid(area.numberFormat) : undefined,
    fillColor: area.fillColor,
    fontColor: area.fontColor,
    bold: area.bold,
    italic: area.italic,
    underlineStyle: area.underlineStyle,
    fontName: area.fontName,
    fontSize: area.fontSize,
    horizontalAlignment: area.horizontalAlignment,
    verticalAlignment: area.verticalAlignment,
    wrapText: area.wrapText,
    borderTop: area.borderTop ? cloneRecoveryFormatBorderState(area.borderTop) : undefined,
    borderBottom: area.borderBottom ? cloneRecoveryFormatBorderState(area.borderBottom) : undefined,
    borderLeft: area.borderLeft ? cloneRecoveryFormatBorderState(area.borderLeft) : undefined,
    borderRight: area.borderRight ? cloneRecoveryFormatBorderState(area.borderRight) : undefined,
    borderInsideHorizontal: area.borderInsideHorizontal
      ? cloneRecoveryFormatBorderState(area.borderInsideHorizontal)
      : undefined,
    borderInsideVertical: area.borderInsideVertical
      ? cloneRecoveryFormatBorderState(area.borderInsideVertical)
      : undefined,
  };
}

export function cloneRecoveryFormatRangeState(state: RecoveryFormatRangeState): RecoveryFormatRangeState {
  return {
    selection: cloneRecoveryFormatSelection(state.selection),
    areas: state.areas.map((area) => cloneRecoveryFormatAreaState(area)),
    cellCount: state.cellCount,
  };
}

function hasSelectedFormatProperty(selection: RecoveryFormatSelection): boolean {
  return (
    selection.numberFormat === true ||
    selection.fillColor === true ||
    selection.fontColor === true ||
    selection.bold === true ||
    selection.italic === true ||
    selection.underlineStyle === true ||
    selection.fontName === true ||
    selection.fontSize === true ||
    selection.horizontalAlignment === true ||
    selection.verticalAlignment === true ||
    selection.wrapText === true ||
    selection.borderTop === true ||
    selection.borderBottom === true ||
    selection.borderLeft === true ||
    selection.borderRight === true ||
    selection.borderInsideHorizontal === true ||
    selection.borderInsideVertical === true
  );
}

function splitRangeList(range: string): string[] {
  return range
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

interface ResolvedFormatCaptureTarget {
  sheetName: string;
  areas: Excel.Range[];
}

async function resolveFormatCaptureTarget(
  context: Excel.RequestContext,
  ref: string,
): Promise<ResolvedFormatCaptureTarget> {
  const parts = splitRangeList(ref);

  if (parts.length <= 1) {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address,rowCount,columnCount");
    await context.sync();
    return {
      sheetName: sheet.name,
      areas: [range],
    };
  }

  let sheetNameFromRef: string | undefined;
  const areaAddresses: string[] = [];

  for (const part of parts) {
    const parsed = parseRangeRef(part);
    if (parsed.sheet) {
      if (sheetNameFromRef && parsed.sheet !== sheetNameFromRef) {
        throw new Error("Format checkpoint capture supports a single sheet per mutation.");
      }
      sheetNameFromRef = parsed.sheet;
    }

    areaAddresses.push(parsed.address);
  }

  const sheet = sheetNameFromRef
    ? context.workbook.worksheets.getItem(sheetNameFromRef)
    : context.workbook.worksheets.getActiveWorksheet();
  const areasTarget = sheet.getRanges(areaAddresses.join(","));

  sheet.load("name");
  areasTarget.areas.load("items/address,items/rowCount,items/columnCount");
  await context.sync();

  return {
    sheetName: sheet.name,
    areas: [...areasTarget.areas.items],
  };
}

function captureBorderState(border: Excel.RangeBorder): RecoveryFormatBorderState | null {
  const styleRaw = border.style;
  if (!isRecoveryRangeBorderStyle(styleRaw)) {
    return null;
  }

  const weightRaw = border.weight;
  const colorRaw = border.color;

  return {
    style: styleRaw,
    weight: isRecoveryRangeBorderWeight(weightRaw) ? weightRaw : undefined,
    color: normalizeOptionalString(colorRaw),
  };
}

function applyBorderState(border: Excel.RangeBorder, state: RecoveryFormatBorderState): void {
  if (!isRecoveryRangeBorderStyle(state.style)) {
    throw new Error("Format checkpoint is invalid: border style is unsupported.");
  }

  border.style = state.style;

  if (state.style !== "None" && state.weight !== undefined) {
    if (!isRecoveryRangeBorderWeight(state.weight)) {
      throw new Error("Format checkpoint is invalid: border weight is unsupported.");
    }
    border.weight = state.weight;
  }

  if (typeof state.color === "string") {
    border.color = state.color;
  }
}

function validateStringGrid(
  value: unknown,
  rowCount: number,
  columnCount: number,
): string[][] | null {
  if (!Array.isArray(value) || value.length !== rowCount) {
    return null;
  }

  const out: string[][] = [];

  for (const rowValue of value) {
    if (!Array.isArray(rowValue) || rowValue.length !== columnCount) {
      return null;
    }

    const outRow: string[] = [];
    for (const cellValue of rowValue) {
      if (typeof cellValue !== "string") {
        return null;
      }
      outRow.push(cellValue);
    }

    out.push(outRow);
  }

  return out;
}

interface PreparedFormatAreaCapture {
  range: Excel.Range;
  address: string;
  rowCount: number;
  columnCount: number;
  borders: Partial<Record<RecoveryBorderKey, Excel.RangeBorder>>;
}

async function captureFormatRangeStateWithSelection(
  context: Excel.RequestContext,
  target: ResolvedFormatCaptureTarget,
  selection: RecoveryFormatSelection,
): Promise<RecoveryFormatCaptureResult> {
  if (!hasSelectedFormatProperty(selection)) {
    return {
      supported: false,
      reason: "No restorable format properties were selected.",
    };
  }

  const preparedAreas: PreparedFormatAreaCapture[] = [];

  const needsFontLoad =
    selection.fontColor === true ||
    selection.bold === true ||
    selection.italic === true ||
    selection.underlineStyle === true ||
    selection.fontName === true ||
    selection.fontSize === true;

  const needsBorderLoad =
    selection.borderTop === true ||
    selection.borderBottom === true ||
    selection.borderLeft === true ||
    selection.borderRight === true ||
    selection.borderInsideHorizontal === true ||
    selection.borderInsideVertical === true;

  for (const area of target.areas) {
    const prepared: PreparedFormatAreaCapture = {
      range: area,
      address: qualifyAddressWithSheet(target.sheetName, area.address),
      rowCount: area.rowCount,
      columnCount: area.columnCount,
      borders: {},
    };

    if (selection.numberFormat === true) {
      area.load("numberFormat");
    }

    if (selection.fillColor === true) {
      area.format.fill.load("color");
    }

    if (needsFontLoad) {
      area.format.font.load("color,bold,italic,underline,name,size");
    }

    if (selection.horizontalAlignment === true || selection.verticalAlignment === true || selection.wrapText === true) {
      area.format.load("horizontalAlignment,verticalAlignment,wrapText");
    }

    if (needsBorderLoad) {
      for (const borderKey of RECOVERY_BORDER_KEYS) {
        if (selection[borderKey] !== true) continue;

        const border = area.format.borders.getItem(BORDER_KEY_TO_EDGE[borderKey]);
        border.load("style,weight,color");
        prepared.borders[borderKey] = border;
      }
    }

    preparedAreas.push(prepared);
  }

  await context.sync();

  const areaStates: RecoveryFormatAreaState[] = [];
  let cellCount = 0;

  for (const prepared of preparedAreas) {
    const areaState: RecoveryFormatAreaState = {
      address: prepared.address,
      rowCount: prepared.rowCount,
      columnCount: prepared.columnCount,
    };

    cellCount += prepared.rowCount * prepared.columnCount;

    if (selection.numberFormat === true) {
      const matrix = validateStringGrid(prepared.range.numberFormat, prepared.rowCount, prepared.columnCount);
      if (!matrix) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: number format matrix is invalid.",
        };
      }

      areaState.numberFormat = matrix;
    }

    if (selection.fillColor === true) {
      const fillColor = normalizeOptionalString(prepared.range.format.fill.color);
      if (fillColor === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: fill color is not restorable.",
        };
      }

      areaState.fillColor = fillColor;
    }

    if (selection.fontColor === true) {
      const fontColor = normalizeOptionalString(prepared.range.format.font.color);
      if (fontColor === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: font color is not restorable.",
        };
      }

      areaState.fontColor = fontColor;
    }

    if (selection.bold === true) {
      const bold = normalizeOptionalBoolean(prepared.range.format.font.bold);
      if (bold === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: bold state is mixed or unsupported.",
        };
      }

      areaState.bold = bold;
    }

    if (selection.italic === true) {
      const italic = normalizeOptionalBoolean(prepared.range.format.font.italic);
      if (italic === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: italic state is mixed or unsupported.",
        };
      }

      areaState.italic = italic;
    }

    if (selection.underlineStyle === true) {
      const underline = prepared.range.format.font.underline;
      if (!isRecoveryUnderlineStyle(underline)) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: underline style is unsupported.",
        };
      }

      areaState.underlineStyle = underline;
    }

    if (selection.fontName === true) {
      const fontName = normalizeOptionalString(prepared.range.format.font.name);
      if (fontName === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: font name is not restorable.",
        };
      }

      areaState.fontName = fontName;
    }

    if (selection.fontSize === true) {
      const fontSize = normalizeOptionalNumber(prepared.range.format.font.size);
      if (fontSize === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: font size is mixed or unsupported.",
        };
      }

      areaState.fontSize = fontSize;
    }

    if (selection.horizontalAlignment === true) {
      const horizontalAlignment = prepared.range.format.horizontalAlignment;
      if (!isRecoveryHorizontalAlignment(horizontalAlignment)) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: horizontal alignment is unsupported.",
        };
      }

      areaState.horizontalAlignment = horizontalAlignment;
    }

    if (selection.verticalAlignment === true) {
      const verticalAlignment = prepared.range.format.verticalAlignment;
      if (!isRecoveryVerticalAlignment(verticalAlignment)) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: vertical alignment is unsupported.",
        };
      }

      areaState.verticalAlignment = verticalAlignment;
    }

    if (selection.wrapText === true) {
      const wrapText = normalizeOptionalBoolean(prepared.range.format.wrapText);
      if (wrapText === undefined) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: wrap-text state is mixed or unsupported.",
        };
      }

      areaState.wrapText = wrapText;
    }

    for (const borderKey of RECOVERY_BORDER_KEYS) {
      if (selection[borderKey] !== true) continue;

      const border = prepared.borders[borderKey];
      if (!border) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: border state is unavailable.",
        };
      }

      const borderState = captureBorderState(border);
      if (!borderState) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: border state is unsupported.",
        };
      }

      areaState[borderKey] = borderState;
    }

    areaStates.push(areaState);
  }

  return {
    supported: true,
    state: {
      selection: cloneRecoveryFormatSelection(selection),
      areas: areaStates,
      cellCount,
    },
  };
}

function applyFormatRangeStateToArea(range: Excel.Range, state: RecoveryFormatAreaState): void {
  if (state.numberFormat) {
    range.numberFormat = cloneStringGrid(state.numberFormat);
  }

  if (typeof state.fillColor === "string") {
    range.format.fill.color = state.fillColor;
  }

  if (typeof state.fontColor === "string") {
    range.format.font.color = state.fontColor;
  }

  if (typeof state.bold === "boolean") {
    range.format.font.bold = state.bold;
  }

  if (typeof state.italic === "boolean") {
    range.format.font.italic = state.italic;
  }

  if (typeof state.underlineStyle === "string") {
    if (!isRecoveryUnderlineStyle(state.underlineStyle)) {
      throw new Error("Format checkpoint is invalid: underline style is unsupported.");
    }
    range.format.font.underline = state.underlineStyle;
  }

  if (typeof state.fontName === "string") {
    range.format.font.name = state.fontName;
  }

  if (typeof state.fontSize === "number") {
    range.format.font.size = state.fontSize;
  }

  if (typeof state.horizontalAlignment === "string") {
    if (!isRecoveryHorizontalAlignment(state.horizontalAlignment)) {
      throw new Error("Format checkpoint is invalid: horizontal alignment is unsupported.");
    }
    range.format.horizontalAlignment = state.horizontalAlignment;
  }

  if (typeof state.verticalAlignment === "string") {
    if (!isRecoveryVerticalAlignment(state.verticalAlignment)) {
      throw new Error("Format checkpoint is invalid: vertical alignment is unsupported.");
    }
    range.format.verticalAlignment = state.verticalAlignment;
  }

  if (typeof state.wrapText === "boolean") {
    range.format.wrapText = state.wrapText;
  }

  for (const borderKey of RECOVERY_BORDER_KEYS) {
    const borderState = state[borderKey];
    if (!borderState) continue;

    const border = range.format.borders.getItem(BORDER_KEY_TO_EDGE[borderKey]);
    applyBorderState(border, borderState);
  }
}

function captureFormatRangeStateUnsupported(reason: string): RecoveryFormatCaptureResult {
  return {
    supported: false,
    reason,
  };
}

export async function captureFormatCellsState(
  address: string,
  selection: RecoveryFormatSelection,
): Promise<RecoveryFormatCaptureResult> {
  if (!hasSelectedFormatProperty(selection)) {
    return captureFormatRangeStateUnsupported("No restorable format properties were selected.");
  }

  return excelRun<RecoveryFormatCaptureResult>(async (context) => {
    const target = await resolveFormatCaptureTarget(context, address);
    return captureFormatRangeStateWithSelection(context, target, selection);
  });
}

export async function applyFormatCellsState(
  address: string,
  targetState: RecoveryFormatRangeState,
): Promise<RecoveryFormatRangeState> {
  const previousStateResult = await captureFormatCellsState(address, targetState.selection);
  if (!previousStateResult.supported || !previousStateResult.state) {
    throw new Error(previousStateResult.reason ?? "Format checkpoint cannot be restored safely.");
  }
  const previousState = previousStateResult.state;

  return excelRun<RecoveryFormatRangeState>(async (context) => {
    const loadedAreas = targetState.areas.map((areaState) => {
      const { range } = getRange(context, areaState.address);
      range.load("rowCount,columnCount");
      return { areaState, range };
    });

    await context.sync();

    for (const loaded of loadedAreas) {
      const { areaState, range } = loaded;

      if (typeof areaState.numberFormat !== "undefined") {
        if (range.rowCount !== areaState.rowCount || range.columnCount !== areaState.columnCount) {
          throw new Error("Format checkpoint range shape changed and cannot be restored safely.");
        }
      }

      applyFormatRangeStateToArea(range, areaState);
    }

    await context.sync();
    return cloneRecoveryFormatRangeState(previousState);
  });
}

function captureRuleFormatting(format: Excel.ConditionalRangeFormat): {
  fillColor?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
} {
  return {
    fillColor: normalizeOptionalString(format.fill.color),
    fontColor: normalizeOptionalString(format.font.color),
    bold: normalizeOptionalBoolean(format.font.bold),
    italic: normalizeOptionalBoolean(format.font.italic),
    underline: normalizeUnderline(format.font.underline),
  };
}

function applyRuleFormatting(format: Excel.ConditionalRangeFormat, rule: RecoveryConditionalFormatRule): void {
  if (rule.fillColor !== undefined) {
    format.fill.color = rule.fillColor;
  }

  if (rule.fontColor !== undefined) {
    format.font.color = rule.fontColor;
  }

  if (rule.bold !== undefined) {
    format.font.bold = rule.bold;
  }

  if (rule.italic !== undefined) {
    format.font.italic = rule.italic;
  }

  if (rule.underline !== undefined) {
    format.font.underline = rule.underline ? "Single" : "None";
  }
}

interface LoadedConditionalFormatEntry {
  conditionalFormat: Excel.ConditionalFormat;
  appliesTo: Excel.RangeAreas;
}

function normalizeConditionalFormatAddress(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function captureConditionalFormatRulesInRange(
  context: Excel.RequestContext,
  range: Excel.Range,
): Promise<RecoveryConditionalFormatCaptureResult> {
  const collection = range.conditionalFormats;
  collection.load("items/type,items/stopIfTrue");
  await context.sync();

  const entries: LoadedConditionalFormatEntry[] = [];

  for (const conditionalFormat of collection.items) {
    const normalizedType = normalizeConditionalFormatType(conditionalFormat.type);
    if (!normalizedType) {
      return {
        supported: false,
        rules: [],
        reason: `Unsupported conditional format type: ${String(conditionalFormat.type)}`,
      };
    }

    const appliesTo = conditionalFormat.getRanges();
    appliesTo.load("address");
    entries.push({ conditionalFormat, appliesTo });

    if (normalizedType === "custom") {
      conditionalFormat.custom.load("rule");
      conditionalFormat.custom.format.fill.load("color");
      conditionalFormat.custom.format.font.load("bold,italic,underline,color");
      continue;
    }

    conditionalFormat.cellValue.load("rule");
    conditionalFormat.cellValue.format.fill.load("color");
    conditionalFormat.cellValue.format.font.load("bold,italic,underline,color");
  }

  await context.sync();

  const rules: RecoveryConditionalFormatRule[] = [];

  for (const entry of entries) {
    const conditionalFormat = entry.conditionalFormat;
    const normalizedType = normalizeConditionalFormatType(conditionalFormat.type);
    if (!normalizedType) {
      return {
        supported: false,
        rules: [],
        reason: `Unsupported conditional format type: ${String(conditionalFormat.type)}`,
      };
    }

    const appliesToAddress = normalizeConditionalFormatAddress(entry.appliesTo.address);

    if (normalizedType === "custom") {
      const custom = conditionalFormat.custom;
      rules.push({
        type: "custom",
        stopIfTrue: normalizeOptionalBoolean(conditionalFormat.stopIfTrue),
        formula: normalizeOptionalString(custom.rule.formula),
        appliesToAddress,
        ...captureRuleFormatting(custom.format),
      });
      continue;
    }

    const cellValue = conditionalFormat.cellValue;
    const ruleData = cellValue.rule;
    const operator = isRecord(ruleData) ? ruleData.operator : undefined;

    if (!isRecoveryConditionalCellValueOperator(operator)) {
      return {
        supported: false,
        rules: [],
        reason: "Unsupported conditional format rule operator.",
      };
    }

    const formula1 = isRecord(ruleData) ? ruleData.formula1 : undefined;
    const formula2 = isRecord(ruleData) ? ruleData.formula2 : undefined;

    if (typeof formula1 !== "string") {
      return {
        supported: false,
        rules: [],
        reason: "Conditional format rule is missing formula1.",
      };
    }

    rules.push({
      type: "cell_value",
      stopIfTrue: normalizeOptionalBoolean(conditionalFormat.stopIfTrue),
      operator,
      formula1,
      formula2: typeof formula2 === "string" ? formula2 : undefined,
      appliesToAddress,
      ...captureRuleFormatting(cellValue.format),
    });
  }

  return {
    supported: true,
    rules,
  };
}

function resolveConditionalFormatTargetAddress(
  fallbackAddress: string,
  rule: RecoveryConditionalFormatRule,
): string {
  return normalizeConditionalFormatAddress(rule.appliesToAddress) ?? fallbackAddress;
}

function applyConditionalFormatRule(
  range: Excel.Range,
  fallbackAddress: string,
  rule: RecoveryConditionalFormatRule,
): void {
  const targetAddress = resolveConditionalFormatTargetAddress(fallbackAddress, rule);

  if (rule.type === "custom") {
    if (typeof rule.formula !== "string") {
      throw new Error("Conditional format checkpoint is invalid: custom rule formula is missing.");
    }

    const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.custom);
    conditionalFormat.custom.rule.formula = rule.formula;
    applyRuleFormatting(conditionalFormat.custom.format, rule);

    if (rule.stopIfTrue !== undefined) {
      conditionalFormat.stopIfTrue = rule.stopIfTrue;
    }

    conditionalFormat.setRanges(targetAddress);
    return;
  }

  if (!rule.operator || typeof rule.formula1 !== "string") {
    throw new Error("Conditional format checkpoint is invalid: cell value rule is incomplete.");
  }

  const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
  const cellValueRule: Excel.ConditionalCellValueRule = {
    operator: rule.operator,
    formula1: rule.formula1,
  };

  if (typeof rule.formula2 === "string") {
    cellValueRule.formula2 = rule.formula2;
  }

  conditionalFormat.cellValue.rule = cellValueRule;
  applyRuleFormatting(conditionalFormat.cellValue.format, rule);

  if (rule.stopIfTrue !== undefined) {
    conditionalFormat.stopIfTrue = rule.stopIfTrue;
  }

  conditionalFormat.setRanges(targetAddress);
}

export async function captureConditionalFormatState(address: string): Promise<RecoveryConditionalFormatCaptureResult> {
  return excelRun<RecoveryConditionalFormatCaptureResult>(async (context) => {
    const { range } = getRange(context, address);
    return captureConditionalFormatRulesInRange(context, range);
  });
}

export async function applyConditionalFormatState(
  address: string,
  targetRules: readonly RecoveryConditionalFormatRule[],
): Promise<RecoveryConditionalFormatCaptureResult> {
  return excelRun<RecoveryConditionalFormatCaptureResult>(async (context) => {
    const { range } = getRange(context, address);
    const currentState = await captureConditionalFormatRulesInRange(context, range);

    if (!currentState.supported) {
      throw new Error(currentState.reason ?? "Conditional format checkpoint cannot be restored safely.");
    }

    range.conditionalFormats.clearAll();

    for (const rule of targetRules) {
      applyConditionalFormatRule(range, address, rule);
    }

    await context.sync();

    return {
      supported: true,
      rules: cloneRecoveryConditionalFormatRules(currentState.rules),
    };
  });
}

interface LoadedCommentThread {
  state: RecoveryCommentThreadState;
  comment: Excel.Comment | null;
}

async function loadCommentThreadInRange(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
  range: Excel.Range,
): Promise<LoadedCommentThread> {
  range.load("address");

  const commentCollection = sheet.comments;
  commentCollection.load("items");
  await context.sync();

  if (commentCollection.items.length === 0) {
    return {
      state: emptyCommentThreadState(),
      comment: null,
    };
  }

  const entries = commentCollection.items.map((comment) => {
    comment.load("content,resolved");
    comment.replies.load("items");
    const location = comment.getLocation();
    location.load("address");
    return { comment, location };
  });

  await context.sync();

  const targetCell = firstCellAddress(range.address).toUpperCase();
  let match: { comment: Excel.Comment } | null = null;

  for (const entry of entries) {
    if (firstCellAddress(entry.location.address).toUpperCase() === targetCell) {
      match = { comment: entry.comment };
      break;
    }
  }

  if (!match) {
    return {
      state: emptyCommentThreadState(),
      comment: null,
    };
  }

  for (const reply of match.comment.replies.items) {
    reply.load("content");
  }

  if (match.comment.replies.items.length > 0) {
    await context.sync();
  }

  return {
    state: {
      exists: true,
      content: match.comment.content,
      resolved: match.comment.resolved,
      replies: match.comment.replies.items.map((reply) => reply.content),
    },
    comment: match.comment,
  };
}

export async function captureCommentThreadState(address: string): Promise<RecoveryCommentThreadState> {
  return excelRun<RecoveryCommentThreadState>(async (context) => {
    const { sheet, range } = getRange(context, address);
    const loaded = await loadCommentThreadInRange(context, sheet, range);
    return cloneRecoveryCommentThreadState(loaded.state);
  });
}

export async function applyCommentThreadState(
  address: string,
  targetState: RecoveryCommentThreadState,
): Promise<RecoveryCommentThreadState> {
  return excelRun<RecoveryCommentThreadState>(async (context) => {
    const { sheet, range } = getRange(context, address);
    const loaded = await loadCommentThreadInRange(context, sheet, range);

    if (!targetState.exists) {
      if (loaded.comment) {
        loaded.comment.delete();
        await context.sync();
      }

      return cloneRecoveryCommentThreadState(loaded.state);
    }

    if (loaded.comment) {
      loaded.comment.delete();
      await context.sync();
    }

    const restoredComment = sheet.comments.add(range, targetState.content);

    for (const reply of targetState.replies) {
      restoredComment.replies.add(reply);
    }

    restoredComment.resolved = targetState.resolved;
    await context.sync();

    return cloneRecoveryCommentThreadState(loaded.state);
  });
}
