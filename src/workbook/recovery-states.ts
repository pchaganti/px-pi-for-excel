import { firstCellAddress } from "./recovery/address.js";
import {
  cloneRecoveryCommentThreadState,
  cloneRecoveryConditionalFormatRules,
  cloneRecoveryFormatRangeState,
  cloneRecoveryModifyStructureState,
} from "./recovery/clone.js";
import { isRecoveryConditionalFormatRule } from "./recovery/guards.js";
import { excelRun, getRange } from "../excel/helpers.js";
import { isRecord } from "../utils/type-guards.js";

export {
  firstCellAddress,
  cloneRecoveryCommentThreadState,
  cloneRecoveryConditionalFormatRules,
  cloneRecoveryFormatRangeState,
  cloneRecoveryModifyStructureState,
  isRecoveryConditionalFormatRule,
};

export { estimateFormatCaptureCellCount } from "./recovery/format-selection.js";
export { applyFormatCellsState, captureFormatCellsState } from "./recovery/format-state.js";
export type { CaptureFormatCellsStateOptions } from "./recovery/format-state.js";

export type RecoveryConditionalCellValueOperator =
  | "Between"
  | "NotBetween"
  | "EqualTo"
  | "NotEqualTo"
  | "GreaterThan"
  | "LessThan"
  | "GreaterThanOrEqual"
  | "LessThanOrEqual";

export type RecoveryConditionalTextOperator =
  | "Contains"
  | "NotContains"
  | "BeginsWith"
  | "EndsWith";

export type RecoveryConditionalTopBottomCriterionType =
  | "TopItems"
  | "TopPercent"
  | "BottomItems"
  | "BottomPercent";

export type RecoveryConditionalPresetCriterion =
  | "Blanks"
  | "NonBlanks"
  | "Errors"
  | "NonErrors"
  | "Yesterday"
  | "Today"
  | "Tomorrow"
  | "LastSevenDays"
  | "LastWeek"
  | "ThisWeek"
  | "NextWeek"
  | "LastMonth"
  | "ThisMonth"
  | "NextMonth"
  | "AboveAverage"
  | "BelowAverage"
  | "EqualOrAboveAverage"
  | "EqualOrBelowAverage"
  | "OneStdDevAboveAverage"
  | "OneStdDevBelowAverage"
  | "TwoStdDevAboveAverage"
  | "TwoStdDevBelowAverage"
  | "ThreeStdDevAboveAverage"
  | "ThreeStdDevBelowAverage"
  | "UniqueValues"
  | "DuplicateValues";

export type RecoveryConditionalDataBarAxisFormat = "Automatic" | "None" | "CellMidPoint";

export type RecoveryConditionalDataBarDirection = "Context" | "LeftToRight" | "RightToLeft";

export type RecoveryConditionalDataBarRuleType =
  | "Automatic"
  | "LowestValue"
  | "HighestValue"
  | "Number"
  | "Percent"
  | "Formula"
  | "Percentile";

export interface RecoveryConditionalDataBarRule {
  type: RecoveryConditionalDataBarRuleType;
  formula?: string;
}

export interface RecoveryConditionalDataBarState {
  axisColor?: string;
  axisFormat: RecoveryConditionalDataBarAxisFormat;
  barDirection: RecoveryConditionalDataBarDirection;
  showDataBarOnly: boolean;
  lowerBoundRule: RecoveryConditionalDataBarRule;
  upperBoundRule: RecoveryConditionalDataBarRule;
  positiveFillColor: string;
  positiveBorderColor?: string;
  positiveGradientFill: boolean;
  negativeFillColor: string;
  negativeBorderColor?: string;
  negativeMatchPositiveFillColor: boolean;
  negativeMatchPositiveBorderColor: boolean;
}

export type RecoveryConditionalColorCriterionType =
  | "LowestValue"
  | "HighestValue"
  | "Number"
  | "Percent"
  | "Formula"
  | "Percentile";

export interface RecoveryConditionalColorScaleCriterion {
  type: RecoveryConditionalColorCriterionType;
  formula?: string;
  color?: string;
}

export interface RecoveryConditionalColorScaleState {
  minimum: RecoveryConditionalColorScaleCriterion;
  midpoint?: RecoveryConditionalColorScaleCriterion;
  maximum: RecoveryConditionalColorScaleCriterion;
}

export type RecoveryConditionalIconCriterionType = "Number" | "Percent" | "Formula" | "Percentile";

export type RecoveryConditionalIconCriterionOperator = "GreaterThan" | "GreaterThanOrEqual";

export type RecoveryConditionalIconSet =
  | "ThreeArrows"
  | "ThreeArrowsGray"
  | "ThreeFlags"
  | "ThreeTrafficLights1"
  | "ThreeTrafficLights2"
  | "ThreeSigns"
  | "ThreeSymbols"
  | "ThreeSymbols2"
  | "FourArrows"
  | "FourArrowsGray"
  | "FourRedToBlack"
  | "FourRating"
  | "FourTrafficLights"
  | "FiveArrows"
  | "FiveArrowsGray"
  | "FiveRating"
  | "FiveQuarters"
  | "ThreeStars"
  | "ThreeTriangles"
  | "FiveBoxes";

export interface RecoveryConditionalIcon {
  set: RecoveryConditionalIconSet;
  index: number;
}

export interface RecoveryConditionalIconCriterion {
  type: RecoveryConditionalIconCriterionType;
  operator: RecoveryConditionalIconCriterionOperator;
  formula: string;
  customIcon?: RecoveryConditionalIcon;
}

export interface RecoveryConditionalIconSetState {
  style: RecoveryConditionalIconSet;
  reverseIconOrder: boolean;
  showIconOnly: boolean;
  criteria: RecoveryConditionalIconCriterion[];
}

export type RecoveryConditionalFormatRuleType =
  | "custom"
  | "cell_value"
  | "text_comparison"
  | "top_bottom"
  | "preset_criteria"
  | "data_bar"
  | "color_scale"
  | "icon_set";

export interface RecoveryConditionalFormatRule {
  type: RecoveryConditionalFormatRuleType;
  stopIfTrue?: boolean;
  formula?: string;
  operator?: RecoveryConditionalCellValueOperator;
  formula1?: string;
  formula2?: string;
  textOperator?: RecoveryConditionalTextOperator;
  text?: string;
  topBottomType?: RecoveryConditionalTopBottomCriterionType;
  rank?: number;
  presetCriterion?: RecoveryConditionalPresetCriterion;
  dataBar?: RecoveryConditionalDataBarState;
  colorScale?: RecoveryConditionalColorScaleState;
  iconSet?: RecoveryConditionalIconSetState;
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

export type RecoverySheetVisibility = "Visible" | "Hidden" | "VeryHidden";

export interface RecoverySheetNameState {
  kind: "sheet_name";
  sheetId: string;
  name: string;
}

export interface RecoverySheetVisibilityState {
  kind: "sheet_visibility";
  sheetId: string;
  visibility: RecoverySheetVisibility;
}

export interface RecoverySheetAbsentState {
  kind: "sheet_absent";
  sheetId: string;
  sheetName: string;
}

export interface RecoverySheetPresentState {
  kind: "sheet_present";
  sheetId: string;
  sheetName: string;
  position: number;
  visibility: RecoverySheetVisibility;
}

export interface RecoveryRowsAbsentState {
  kind: "rows_absent";
  sheetId: string;
  sheetName: string;
  position: number;
  count: number;
}

export interface RecoveryRowsPresentState {
  kind: "rows_present";
  sheetId: string;
  sheetName: string;
  position: number;
  count: number;
}

export interface RecoveryColumnsAbsentState {
  kind: "columns_absent";
  sheetId: string;
  sheetName: string;
  position: number;
  count: number;
}

export interface RecoveryColumnsPresentState {
  kind: "columns_present";
  sheetId: string;
  sheetName: string;
  position: number;
  count: number;
}

export type RecoveryModifyStructureState =
  | RecoverySheetNameState
  | RecoverySheetVisibilityState
  | RecoverySheetAbsentState
  | RecoverySheetPresentState
  | RecoveryRowsAbsentState
  | RecoveryRowsPresentState
  | RecoveryColumnsAbsentState
  | RecoveryColumnsPresentState;

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
  columnWidth?: boolean;
  rowHeight?: boolean;
  mergedAreas?: boolean;
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
  columnWidths?: number[];
  rowHeights?: number[];
  mergedAreas?: string[];
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

const SUPPORTED_TEXT_OPERATORS: readonly RecoveryConditionalTextOperator[] = [
  "Contains",
  "NotContains",
  "BeginsWith",
  "EndsWith",
];

const SUPPORTED_TOP_BOTTOM_TYPES: readonly RecoveryConditionalTopBottomCriterionType[] = [
  "TopItems",
  "TopPercent",
  "BottomItems",
  "BottomPercent",
];

const SUPPORTED_PRESET_CRITERIA: readonly RecoveryConditionalPresetCriterion[] = [
  "Blanks",
  "NonBlanks",
  "Errors",
  "NonErrors",
  "Yesterday",
  "Today",
  "Tomorrow",
  "LastSevenDays",
  "LastWeek",
  "ThisWeek",
  "NextWeek",
  "LastMonth",
  "ThisMonth",
  "NextMonth",
  "AboveAverage",
  "BelowAverage",
  "EqualOrAboveAverage",
  "EqualOrBelowAverage",
  "OneStdDevAboveAverage",
  "OneStdDevBelowAverage",
  "TwoStdDevAboveAverage",
  "TwoStdDevBelowAverage",
  "ThreeStdDevAboveAverage",
  "ThreeStdDevBelowAverage",
  "UniqueValues",
  "DuplicateValues",
];

const SUPPORTED_DATA_BAR_AXIS_FORMATS: readonly RecoveryConditionalDataBarAxisFormat[] = [
  "Automatic",
  "None",
  "CellMidPoint",
];

const SUPPORTED_DATA_BAR_DIRECTIONS: readonly RecoveryConditionalDataBarDirection[] = [
  "Context",
  "LeftToRight",
  "RightToLeft",
];

const SUPPORTED_DATA_BAR_RULE_TYPES: readonly RecoveryConditionalDataBarRuleType[] = [
  "Automatic",
  "LowestValue",
  "HighestValue",
  "Number",
  "Percent",
  "Formula",
  "Percentile",
];

const SUPPORTED_COLOR_CRITERION_TYPES: readonly RecoveryConditionalColorCriterionType[] = [
  "LowestValue",
  "HighestValue",
  "Number",
  "Percent",
  "Formula",
  "Percentile",
];

const SUPPORTED_ICON_CRITERION_TYPES: readonly RecoveryConditionalIconCriterionType[] = [
  "Number",
  "Percent",
  "Formula",
  "Percentile",
];

const SUPPORTED_ICON_CRITERION_OPERATORS: readonly RecoveryConditionalIconCriterionOperator[] = [
  "GreaterThan",
  "GreaterThanOrEqual",
];

const SUPPORTED_ICON_SETS: readonly RecoveryConditionalIconSet[] = [
  "ThreeArrows",
  "ThreeArrowsGray",
  "ThreeFlags",
  "ThreeTrafficLights1",
  "ThreeTrafficLights2",
  "ThreeSigns",
  "ThreeSymbols",
  "ThreeSymbols2",
  "FourArrows",
  "FourArrowsGray",
  "FourRedToBlack",
  "FourRating",
  "FourTrafficLights",
  "FiveArrows",
  "FiveArrowsGray",
  "FiveRating",
  "FiveQuarters",
  "ThreeStars",
  "ThreeTriangles",
  "FiveBoxes",
];

function isRecoveryConditionalCellValueOperator(value: unknown): value is RecoveryConditionalCellValueOperator {
  if (typeof value !== "string") return false;

  for (const operator of SUPPORTED_CELL_VALUE_OPERATORS) {
    if (operator === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalTextOperator(value: unknown): value is RecoveryConditionalTextOperator {
  if (typeof value !== "string") return false;

  for (const operator of SUPPORTED_TEXT_OPERATORS) {
    if (operator === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalTopBottomCriterionType(value: unknown): value is RecoveryConditionalTopBottomCriterionType {
  if (typeof value !== "string") return false;

  for (const type of SUPPORTED_TOP_BOTTOM_TYPES) {
    if (type === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalPresetCriterion(value: unknown): value is RecoveryConditionalPresetCriterion {
  if (typeof value !== "string") return false;

  for (const criterion of SUPPORTED_PRESET_CRITERIA) {
    if (criterion === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalDataBarAxisFormat(value: unknown): value is RecoveryConditionalDataBarAxisFormat {
  if (typeof value !== "string") return false;

  for (const axisFormat of SUPPORTED_DATA_BAR_AXIS_FORMATS) {
    if (axisFormat === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalDataBarDirection(value: unknown): value is RecoveryConditionalDataBarDirection {
  if (typeof value !== "string") return false;

  for (const direction of SUPPORTED_DATA_BAR_DIRECTIONS) {
    if (direction === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalDataBarRuleType(value: unknown): value is RecoveryConditionalDataBarRuleType {
  if (typeof value !== "string") return false;

  for (const type of SUPPORTED_DATA_BAR_RULE_TYPES) {
    if (type === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalColorCriterionType(value: unknown): value is RecoveryConditionalColorCriterionType {
  if (typeof value !== "string") return false;

  for (const type of SUPPORTED_COLOR_CRITERION_TYPES) {
    if (type === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalIconCriterionType(value: unknown): value is RecoveryConditionalIconCriterionType {
  if (typeof value !== "string") return false;

  for (const type of SUPPORTED_ICON_CRITERION_TYPES) {
    if (type === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalIconCriterionOperator(value: unknown): value is RecoveryConditionalIconCriterionOperator {
  if (typeof value !== "string") return false;

  for (const operator of SUPPORTED_ICON_CRITERION_OPERATORS) {
    if (operator === value) {
      return true;
    }
  }

  return false;
}

function isRecoveryConditionalIconSet(value: unknown): value is RecoveryConditionalIconSet {
  if (typeof value !== "string") return false;

  for (const style of SUPPORTED_ICON_SETS) {
    if (style === value) {
      return true;
    }
  }

  return false;
}

function isRecoverySheetVisibility(value: unknown): value is RecoverySheetVisibility {
  return value === "Visible" || value === "Hidden" || value === "VeryHidden";
}

function normalizeConditionalFormatType(type: unknown): RecoveryConditionalFormatRuleType | null {
  if (type === "Custom" || type === "custom") {
    return "custom";
  }

  if (type === "CellValue" || type === "cellValue") {
    return "cell_value";
  }

  if (type === "ContainsText" || type === "containsText") {
    return "text_comparison";
  }

  if (type === "TopBottom" || type === "topBottom") {
    return "top_bottom";
  }

  if (type === "PresetCriteria" || type === "presetCriteria") {
    return "preset_criteria";
  }

  if (type === "DataBar" || type === "dataBar") {
    return "data_bar";
  }

  if (type === "ColorScale" || type === "colorScale") {
    return "color_scale";
  }

  if (type === "IconSet" || type === "iconSet") {
    return "icon_set";
  }

  return null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeUnderline(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return value !== "None";
  }

  return undefined;
}

function isRecoveryConditionalDataBarRule(value: unknown): value is RecoveryConditionalDataBarRule {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalDataBarRuleType(value.type)) return false;
  if (value.formula !== undefined && typeof value.formula !== "string") return false;
  return true;
}

function isRecoveryConditionalDataBarState(value: unknown): value is RecoveryConditionalDataBarState {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalDataBarAxisFormat(value.axisFormat)) return false;
  if (!isRecoveryConditionalDataBarDirection(value.barDirection)) return false;
  if (typeof value.showDataBarOnly !== "boolean") return false;
  if (!isRecoveryConditionalDataBarRule(value.lowerBoundRule)) return false;
  if (!isRecoveryConditionalDataBarRule(value.upperBoundRule)) return false;
  if (typeof value.positiveFillColor !== "string") return false;
  if (value.positiveBorderColor !== undefined && typeof value.positiveBorderColor !== "string") return false;
  if (typeof value.positiveGradientFill !== "boolean") return false;
  if (typeof value.negativeFillColor !== "string") return false;
  if (value.negativeBorderColor !== undefined && typeof value.negativeBorderColor !== "string") return false;
  if (typeof value.negativeMatchPositiveFillColor !== "boolean") return false;
  if (typeof value.negativeMatchPositiveBorderColor !== "boolean") return false;
  if (value.axisColor !== undefined && typeof value.axisColor !== "string") return false;
  return true;
}

function isRecoveryConditionalColorScaleCriterion(value: unknown): value is RecoveryConditionalColorScaleCriterion {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalColorCriterionType(value.type)) return false;
  if (value.formula !== undefined && typeof value.formula !== "string") return false;
  if (value.color !== undefined && typeof value.color !== "string") return false;
  return true;
}

function isRecoveryConditionalColorScaleState(value: unknown): value is RecoveryConditionalColorScaleState {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalColorScaleCriterion(value.minimum)) return false;
  if (!isRecoveryConditionalColorScaleCriterion(value.maximum)) return false;
  if (value.midpoint !== undefined && !isRecoveryConditionalColorScaleCriterion(value.midpoint)) return false;
  return true;
}

function isRecoveryConditionalIcon(value: unknown): value is RecoveryConditionalIcon {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalIconSet(value.set)) return false;
  return typeof value.index === "number" && Number.isFinite(value.index);
}

function isRecoveryConditionalIconCriterion(value: unknown): value is RecoveryConditionalIconCriterion {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalIconCriterionType(value.type)) return false;
  if (!isRecoveryConditionalIconCriterionOperator(value.operator)) return false;
  if (typeof value.formula !== "string") return false;
  if (value.customIcon !== undefined && !isRecoveryConditionalIcon(value.customIcon)) return false;
  return true;
}

function isRecoveryConditionalIconSetState(value: unknown): value is RecoveryConditionalIconSetState {
  if (!isRecord(value)) return false;
  if (!isRecoveryConditionalIconSet(value.style)) return false;
  if (typeof value.reverseIconOrder !== "boolean") return false;
  if (typeof value.showIconOnly !== "boolean") return false;
  if (!Array.isArray(value.criteria) || value.criteria.length === 0) return false;
  if (!value.criteria.every((criterion) => isRecoveryConditionalIconCriterion(criterion))) return false;
  return true;
}

function emptyCommentThreadState(): RecoveryCommentThreadState {
  return {
    exists: false,
    content: "",
    resolved: false,
    replies: [],
  };
}

export interface RecoveryFormatAreaShape {
  rowCount: number;
  columnCount: number;
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
  normalizedType: RecoveryConditionalFormatRuleType;
}

interface ConditionalFormatRuleCaptureContext {
  stopIfTrue?: boolean;
  appliesToAddress?: string;
}

interface ConditionalFormatRuleCaptureSuccess {
  supported: true;
  rule: RecoveryConditionalFormatRule;
}

interface ConditionalFormatRuleCaptureFailure {
  supported: false;
  reason: string;
}

type ConditionalFormatRuleCaptureResult = ConditionalFormatRuleCaptureSuccess | ConditionalFormatRuleCaptureFailure;

interface ConditionalFormatRuleHandler {
  loadForCapture: (conditionalFormat: Excel.ConditionalFormat) => void;
  capture: (
    conditionalFormat: Excel.ConditionalFormat,
    captureContext: ConditionalFormatRuleCaptureContext,
  ) => ConditionalFormatRuleCaptureResult;
  apply: (range: Excel.Range, targetAddress: string, rule: RecoveryConditionalFormatRule) => void;
}

function normalizeConditionalFormatAddress(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function captureDataBarRule(value: unknown): RecoveryConditionalDataBarRule | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  if (!isRecoveryConditionalDataBarRuleType(type)) {
    return null;
  }

  const formula = value.formula;
  if (formula !== undefined && typeof formula !== "string") {
    return null;
  }

  return {
    type,
    formula: typeof formula === "string" ? formula : undefined,
  };
}

function captureColorScaleCriterion(value: unknown): RecoveryConditionalColorScaleCriterion | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  if (!isRecoveryConditionalColorCriterionType(type)) {
    return null;
  }

  const formula = value.formula;
  const color = value.color;

  if (formula !== undefined && typeof formula !== "string") {
    return null;
  }

  if (color !== undefined && typeof color !== "string") {
    return null;
  }

  return {
    type,
    formula: typeof formula === "string" ? formula : undefined,
    color: typeof color === "string" ? color : undefined,
  };
}

function captureConditionalIcon(value: unknown): RecoveryConditionalIcon | null {
  if (!isRecord(value)) return null;

  if (!isRecoveryConditionalIconSet(value.set)) {
    return null;
  }

  if (typeof value.index !== "number" || !Number.isFinite(value.index)) {
    return null;
  }

  return {
    set: value.set,
    index: value.index,
  };
}

function captureIconCriterion(value: unknown): RecoveryConditionalIconCriterion | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  const operator = value.operator;
  const formula = value.formula;

  if (!isRecoveryConditionalIconCriterionType(type)) {
    return null;
  }

  if (!isRecoveryConditionalIconCriterionOperator(operator)) {
    return null;
  }

  if (typeof formula !== "string") {
    return null;
  }

  let customIcon: RecoveryConditionalIcon | undefined;
  if (value.customIcon !== undefined) {
    const capturedCustomIcon = captureConditionalIcon(value.customIcon);
    if (!capturedCustomIcon) {
      return null;
    }
    customIcon = capturedCustomIcon;
  }

  return {
    type,
    operator,
    formula,
    customIcon,
  };
}

function toDataBarRule(rule: RecoveryConditionalDataBarRule): Excel.ConditionalDataBarRule {
  if (typeof rule.formula === "string") {
    return {
      type: rule.type,
      formula: rule.formula,
    };
  }

  return {
    type: rule.type,
  };
}

function toColorScaleCriterion(
  criterion: RecoveryConditionalColorScaleCriterion,
): Excel.ConditionalColorScaleCriterion {
  if (typeof criterion.formula === "string" && typeof criterion.color === "string") {
    return {
      type: criterion.type,
      formula: criterion.formula,
      color: criterion.color,
    };
  }

  if (typeof criterion.formula === "string") {
    return {
      type: criterion.type,
      formula: criterion.formula,
    };
  }

  if (typeof criterion.color === "string") {
    return {
      type: criterion.type,
      color: criterion.color,
    };
  }

  return {
    type: criterion.type,
  };
}

function toIconCriterion(criterion: RecoveryConditionalIconCriterion): Excel.ConditionalIconCriterion {
  if (criterion.customIcon) {
    return {
      type: criterion.type,
      operator: criterion.operator,
      formula: criterion.formula,
      customIcon: {
        set: criterion.customIcon.set,
        index: criterion.customIcon.index,
      },
    };
  }

  return {
    type: criterion.type,
    operator: criterion.operator,
    formula: criterion.formula,
  };
}

const CONDITIONAL_FORMAT_RULE_HANDLERS = {
  custom: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.custom.load("rule");
      conditionalFormat.custom.format.fill.load("color");
      conditionalFormat.custom.format.font.load("bold,italic,underline,color");
    },
    capture(conditionalFormat, captureContext) {
      const formula = normalizeOptionalString(conditionalFormat.custom.rule.formula);
      if (formula === undefined) {
        return {
          supported: false,
          reason: "Conditional format checkpoint is invalid: custom rule formula is missing.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "custom",
          stopIfTrue: captureContext.stopIfTrue,
          formula,
          appliesToAddress: captureContext.appliesToAddress,
          ...captureRuleFormatting(conditionalFormat.custom.format),
        },
      };
    },
    apply(range, targetAddress, rule) {
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
    },
  },
  cell_value: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.cellValue.load("rule");
      conditionalFormat.cellValue.format.fill.load("color");
      conditionalFormat.cellValue.format.font.load("bold,italic,underline,color");
    },
    capture(conditionalFormat, captureContext) {
      const ruleData = conditionalFormat.cellValue.rule;
      const operator = isRecord(ruleData) ? ruleData.operator : undefined;

      if (!isRecoveryConditionalCellValueOperator(operator)) {
        return {
          supported: false,
          reason: "Unsupported conditional format rule operator.",
        };
      }

      const formula1 = isRecord(ruleData) ? ruleData.formula1 : undefined;
      const formula2 = isRecord(ruleData) ? ruleData.formula2 : undefined;

      if (typeof formula1 !== "string") {
        return {
          supported: false,
          reason: "Conditional format rule is missing formula1.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "cell_value",
          stopIfTrue: captureContext.stopIfTrue,
          operator,
          formula1,
          formula2: typeof formula2 === "string" ? formula2 : undefined,
          appliesToAddress: captureContext.appliesToAddress,
          ...captureRuleFormatting(conditionalFormat.cellValue.format),
        },
      };
    },
    apply(range, targetAddress, rule) {
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
    },
  },
  text_comparison: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.textComparison.load("rule");
      conditionalFormat.textComparison.format.fill.load("color");
      conditionalFormat.textComparison.format.font.load("bold,italic,underline,color");
    },
    capture(conditionalFormat, captureContext) {
      const ruleData = conditionalFormat.textComparison.rule;
      const operator = isRecord(ruleData) ? ruleData.operator : undefined;

      if (!isRecoveryConditionalTextOperator(operator)) {
        return {
          supported: false,
          reason: "Unsupported conditional format text operator.",
        };
      }

      const text = isRecord(ruleData) ? ruleData.text : undefined;
      if (typeof text !== "string") {
        return {
          supported: false,
          reason: "Conditional format text-comparison rule is missing text.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "text_comparison",
          stopIfTrue: captureContext.stopIfTrue,
          textOperator: operator,
          text,
          appliesToAddress: captureContext.appliesToAddress,
          ...captureRuleFormatting(conditionalFormat.textComparison.format),
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!rule.textOperator || typeof rule.text !== "string") {
        throw new Error("Conditional format checkpoint is invalid: text-comparison rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.containsText);
      const textRule: Excel.ConditionalTextComparisonRule = {
        operator: rule.textOperator,
        text: rule.text,
      };

      conditionalFormat.textComparison.rule = textRule;
      applyRuleFormatting(conditionalFormat.textComparison.format, rule);

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
  top_bottom: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.topBottom.load("rule");
      conditionalFormat.topBottom.format.fill.load("color");
      conditionalFormat.topBottom.format.font.load("bold,italic,underline,color");
    },
    capture(conditionalFormat, captureContext) {
      const ruleData = conditionalFormat.topBottom.rule;
      const topBottomType = isRecord(ruleData) ? ruleData.type : undefined;
      const rank = isRecord(ruleData) ? ruleData.rank : undefined;

      if (!isRecoveryConditionalTopBottomCriterionType(topBottomType)) {
        return {
          supported: false,
          reason: "Unsupported conditional format top/bottom criterion type.",
        };
      }

      if (typeof rank !== "number" || !Number.isFinite(rank)) {
        return {
          supported: false,
          reason: "Conditional format top/bottom rule is missing rank.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "top_bottom",
          stopIfTrue: captureContext.stopIfTrue,
          topBottomType,
          rank,
          appliesToAddress: captureContext.appliesToAddress,
          ...captureRuleFormatting(conditionalFormat.topBottom.format),
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!rule.topBottomType || typeof rule.rank !== "number" || !Number.isFinite(rule.rank)) {
        throw new Error("Conditional format checkpoint is invalid: top/bottom rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.topBottom);
      const topBottomRule: Excel.ConditionalTopBottomRule = {
        type: rule.topBottomType,
        rank: rule.rank,
      };

      conditionalFormat.topBottom.rule = topBottomRule;
      applyRuleFormatting(conditionalFormat.topBottom.format, rule);

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
  preset_criteria: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.preset.load("rule");
      conditionalFormat.preset.format.fill.load("color");
      conditionalFormat.preset.format.font.load("bold,italic,underline,color");
    },
    capture(conditionalFormat, captureContext) {
      const ruleData = conditionalFormat.preset.rule;
      const criterion = isRecord(ruleData) ? ruleData.criterion : undefined;

      if (!isRecoveryConditionalPresetCriterion(criterion)) {
        return {
          supported: false,
          reason: "Unsupported conditional format preset criterion.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "preset_criteria",
          stopIfTrue: captureContext.stopIfTrue,
          presetCriterion: criterion,
          appliesToAddress: captureContext.appliesToAddress,
          ...captureRuleFormatting(conditionalFormat.preset.format),
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!rule.presetCriterion) {
        throw new Error("Conditional format checkpoint is invalid: preset-criteria rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.presetCriteria);
      const presetRule: Excel.ConditionalPresetCriteriaRule = {
        criterion: rule.presetCriterion,
      };

      conditionalFormat.preset.rule = presetRule;
      applyRuleFormatting(conditionalFormat.preset.format, rule);

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
  data_bar: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.dataBar.load("axisColor,axisFormat,barDirection,lowerBoundRule,showDataBarOnly,upperBoundRule");
      conditionalFormat.dataBar.positiveFormat.load("fillColor,borderColor,gradientFill");
      conditionalFormat.dataBar.negativeFormat.load("fillColor,borderColor,matchPositiveFillColor,matchPositiveBorderColor");
    },
    capture(conditionalFormat, captureContext) {
      const dataBar = conditionalFormat.dataBar;
      const axisFormat = dataBar.axisFormat;
      const barDirection = dataBar.barDirection;

      if (!isRecoveryConditionalDataBarAxisFormat(axisFormat)) {
        return {
          supported: false,
          reason: "Unsupported conditional format data-bar axis format.",
        };
      }

      if (!isRecoveryConditionalDataBarDirection(barDirection)) {
        return {
          supported: false,
          reason: "Unsupported conditional format data-bar direction.",
        };
      }

      const showDataBarOnly = normalizeOptionalBoolean(dataBar.showDataBarOnly);
      if (showDataBarOnly === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar showDataBarOnly is unsupported.",
        };
      }

      const lowerBoundRule = captureDataBarRule(dataBar.lowerBoundRule);
      if (!lowerBoundRule) {
        return {
          supported: false,
          reason: "Unsupported conditional format data-bar lower bound rule.",
        };
      }

      const upperBoundRule = captureDataBarRule(dataBar.upperBoundRule);
      if (!upperBoundRule) {
        return {
          supported: false,
          reason: "Unsupported conditional format data-bar upper bound rule.",
        };
      }

      const positiveFillColor = normalizeOptionalString(dataBar.positiveFormat.fillColor);
      if (positiveFillColor === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar positive fill color is unavailable.",
        };
      }

      const positiveGradientFill = normalizeOptionalBoolean(dataBar.positiveFormat.gradientFill);
      if (positiveGradientFill === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar positive gradient setting is unavailable.",
        };
      }

      const negativeFillColor = normalizeOptionalString(dataBar.negativeFormat.fillColor);
      if (negativeFillColor === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar negative fill color is unavailable.",
        };
      }

      const negativeMatchPositiveFillColor = normalizeOptionalBoolean(dataBar.negativeFormat.matchPositiveFillColor);
      if (negativeMatchPositiveFillColor === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar negative fill matching setting is unavailable.",
        };
      }

      const negativeMatchPositiveBorderColor = normalizeOptionalBoolean(dataBar.negativeFormat.matchPositiveBorderColor);
      if (negativeMatchPositiveBorderColor === undefined) {
        return {
          supported: false,
          reason: "Conditional format data-bar negative border matching setting is unavailable.",
        };
      }

      return {
        supported: true,
        rule: {
          type: "data_bar",
          stopIfTrue: captureContext.stopIfTrue,
          appliesToAddress: captureContext.appliesToAddress,
          dataBar: {
            axisColor: normalizeOptionalString(dataBar.axisColor),
            axisFormat,
            barDirection,
            showDataBarOnly,
            lowerBoundRule,
            upperBoundRule,
            positiveFillColor,
            positiveBorderColor: normalizeOptionalString(dataBar.positiveFormat.borderColor),
            positiveGradientFill,
            negativeFillColor,
            negativeBorderColor: normalizeOptionalString(dataBar.negativeFormat.borderColor),
            negativeMatchPositiveFillColor,
            negativeMatchPositiveBorderColor,
          },
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!isRecoveryConditionalDataBarState(rule.dataBar)) {
        throw new Error("Conditional format checkpoint is invalid: data-bar rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
      const state = rule.dataBar;
      const dataBar = conditionalFormat.dataBar;

      if (typeof state.axisColor === "string") {
        dataBar.axisColor = state.axisColor;
      }

      dataBar.axisFormat = state.axisFormat;
      dataBar.barDirection = state.barDirection;
      dataBar.showDataBarOnly = state.showDataBarOnly;
      dataBar.lowerBoundRule = toDataBarRule(state.lowerBoundRule);
      dataBar.upperBoundRule = toDataBarRule(state.upperBoundRule);

      dataBar.positiveFormat.fillColor = state.positiveFillColor;
      if (typeof state.positiveBorderColor === "string") {
        dataBar.positiveFormat.borderColor = state.positiveBorderColor;
      }
      dataBar.positiveFormat.gradientFill = state.positiveGradientFill;

      dataBar.negativeFormat.fillColor = state.negativeFillColor;
      if (typeof state.negativeBorderColor === "string") {
        dataBar.negativeFormat.borderColor = state.negativeBorderColor;
      }
      dataBar.negativeFormat.matchPositiveFillColor = state.negativeMatchPositiveFillColor;
      dataBar.negativeFormat.matchPositiveBorderColor = state.negativeMatchPositiveBorderColor;

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
  color_scale: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.colorScale.load("criteria");
    },
    capture(conditionalFormat, captureContext) {
      const criteria = conditionalFormat.colorScale.criteria;

      const minimum = captureColorScaleCriterion(criteria.minimum);
      if (!minimum) {
        return {
          supported: false,
          reason: "Unsupported conditional format color-scale minimum criterion.",
        };
      }

      const maximum = captureColorScaleCriterion(criteria.maximum);
      if (!maximum) {
        return {
          supported: false,
          reason: "Unsupported conditional format color-scale maximum criterion.",
        };
      }

      const midpointRaw = criteria.midpoint;
      let midpoint: RecoveryConditionalColorScaleCriterion | undefined;
      if (midpointRaw !== undefined) {
        const capturedMidpoint = captureColorScaleCriterion(midpointRaw);
        if (!capturedMidpoint) {
          return {
            supported: false,
            reason: "Unsupported conditional format color-scale midpoint criterion.",
          };
        }

        midpoint = capturedMidpoint;
      }

      return {
        supported: true,
        rule: {
          type: "color_scale",
          stopIfTrue: captureContext.stopIfTrue,
          appliesToAddress: captureContext.appliesToAddress,
          colorScale: {
            minimum,
            midpoint,
            maximum,
          },
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!isRecoveryConditionalColorScaleState(rule.colorScale)) {
        throw new Error("Conditional format checkpoint is invalid: color-scale rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);
      const state = rule.colorScale;
      const criteria: Excel.ConditionalColorScaleCriteria = {
        minimum: toColorScaleCriterion(state.minimum),
        maximum: toColorScaleCriterion(state.maximum),
      };

      if (state.midpoint) {
        criteria.midpoint = toColorScaleCriterion(state.midpoint);
      }

      conditionalFormat.colorScale.criteria = criteria;

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
  icon_set: {
    loadForCapture(conditionalFormat) {
      conditionalFormat.iconSet.load("style,reverseIconOrder,showIconOnly,criteria");
    },
    capture(conditionalFormat, captureContext) {
      const iconSet = conditionalFormat.iconSet;
      const style = iconSet.style;
      if (!isRecoveryConditionalIconSet(style)) {
        return {
          supported: false,
          reason: "Unsupported conditional format icon-set style.",
        };
      }

      const reverseIconOrder = normalizeOptionalBoolean(iconSet.reverseIconOrder);
      if (reverseIconOrder === undefined) {
        return {
          supported: false,
          reason: "Conditional format icon-set reverseIconOrder is unavailable.",
        };
      }

      const showIconOnly = normalizeOptionalBoolean(iconSet.showIconOnly);
      if (showIconOnly === undefined) {
        return {
          supported: false,
          reason: "Conditional format icon-set showIconOnly is unavailable.",
        };
      }

      const criteriaRaw = iconSet.criteria;
      if (!Array.isArray(criteriaRaw) || criteriaRaw.length === 0) {
        return {
          supported: false,
          reason: "Conditional format icon-set criteria are unavailable.",
        };
      }

      const criteria: RecoveryConditionalIconCriterion[] = [];
      for (const criterion of criteriaRaw) {
        const captured = captureIconCriterion(criterion);
        if (!captured) {
          return {
            supported: false,
            reason: "Unsupported conditional format icon-set criterion.",
          };
        }

        criteria.push(captured);
      }

      return {
        supported: true,
        rule: {
          type: "icon_set",
          stopIfTrue: captureContext.stopIfTrue,
          appliesToAddress: captureContext.appliesToAddress,
          iconSet: {
            style,
            reverseIconOrder,
            showIconOnly,
            criteria,
          },
        },
      };
    },
    apply(range, targetAddress, rule) {
      if (!isRecoveryConditionalIconSetState(rule.iconSet)) {
        throw new Error("Conditional format checkpoint is invalid: icon-set rule is incomplete.");
      }

      const conditionalFormat = range.conditionalFormats.add(Excel.ConditionalFormatType.iconSet);
      const state = rule.iconSet;
      conditionalFormat.iconSet.style = state.style;
      conditionalFormat.iconSet.reverseIconOrder = state.reverseIconOrder;
      conditionalFormat.iconSet.showIconOnly = state.showIconOnly;
      conditionalFormat.iconSet.criteria = state.criteria.map((criterion) => toIconCriterion(criterion));

      if (rule.stopIfTrue !== undefined) {
        conditionalFormat.stopIfTrue = rule.stopIfTrue;
      }

      conditionalFormat.setRanges(targetAddress);
    },
  },
} satisfies Record<RecoveryConditionalFormatRuleType, ConditionalFormatRuleHandler>;

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

    const handler = CONDITIONAL_FORMAT_RULE_HANDLERS[normalizedType];
    handler.loadForCapture(conditionalFormat);

    entries.push({ conditionalFormat, appliesTo, normalizedType });
  }

  await context.sync();

  const rules: RecoveryConditionalFormatRule[] = [];

  for (const entry of entries) {
    const handler = CONDITIONAL_FORMAT_RULE_HANDLERS[entry.normalizedType];
    const captureResult = handler.capture(entry.conditionalFormat, {
      stopIfTrue: normalizeOptionalBoolean(entry.conditionalFormat.stopIfTrue),
      appliesToAddress: normalizeConditionalFormatAddress(entry.appliesTo.address),
    });

    if (!captureResult.supported) {
      return {
        supported: false,
        rules: [],
        reason: captureResult.reason,
      };
    }

    rules.push(captureResult.rule);
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
  const handler = CONDITIONAL_FORMAT_RULE_HANDLERS[rule.type];
  handler.apply(range, targetAddress, rule);
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
