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

export type RecoveryModifyStructureState = RecoverySheetNameState | RecoverySheetVisibilityState;

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

export function isRecoveryConditionalFormatRule(value: unknown): value is RecoveryConditionalFormatRule {
  if (!isRecord(value)) return false;

  if (value.stopIfTrue !== undefined && typeof value.stopIfTrue !== "boolean") return false;
  if (value.formula !== undefined && typeof value.formula !== "string") return false;
  if (value.formula1 !== undefined && typeof value.formula1 !== "string") return false;
  if (value.formula2 !== undefined && typeof value.formula2 !== "string") return false;
  if (value.text !== undefined && typeof value.text !== "string") return false;
  if (value.rank !== undefined && (typeof value.rank !== "number" || !Number.isFinite(value.rank))) return false;
  if (value.fillColor !== undefined && typeof value.fillColor !== "string") return false;
  if (value.fontColor !== undefined && typeof value.fontColor !== "string") return false;
  if (value.bold !== undefined && typeof value.bold !== "boolean") return false;
  if (value.italic !== undefined && typeof value.italic !== "boolean") return false;
  if (value.underline !== undefined && typeof value.underline !== "boolean") return false;
  if (value.appliesToAddress !== undefined && typeof value.appliesToAddress !== "string") return false;

  const type = value.type;
  if (type === "custom") {
    return typeof value.formula === "string";
  }

  if (type === "cell_value") {
    return isRecoveryConditionalCellValueOperator(value.operator) && typeof value.formula1 === "string";
  }

  if (type === "text_comparison") {
    return isRecoveryConditionalTextOperator(value.textOperator) && typeof value.text === "string";
  }

  if (type === "top_bottom") {
    return isRecoveryConditionalTopBottomCriterionType(value.topBottomType) && typeof value.rank === "number";
  }

  if (type === "preset_criteria") {
    return isRecoveryConditionalPresetCriterion(value.presetCriterion);
  }

  if (type === "data_bar") {
    return isRecoveryConditionalDataBarState(value.dataBar);
  }

  if (type === "color_scale") {
    return isRecoveryConditionalColorScaleState(value.colorScale);
  }

  if (type === "icon_set") {
    return isRecoveryConditionalIconSetState(value.iconSet);
  }

  return false;
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

function cloneRecoveryConditionalDataBarRule(rule: RecoveryConditionalDataBarRule): RecoveryConditionalDataBarRule {
  return {
    type: rule.type,
    formula: rule.formula,
  };
}

function cloneRecoveryConditionalDataBarState(state: RecoveryConditionalDataBarState): RecoveryConditionalDataBarState {
  return {
    axisColor: state.axisColor,
    axisFormat: state.axisFormat,
    barDirection: state.barDirection,
    showDataBarOnly: state.showDataBarOnly,
    lowerBoundRule: cloneRecoveryConditionalDataBarRule(state.lowerBoundRule),
    upperBoundRule: cloneRecoveryConditionalDataBarRule(state.upperBoundRule),
    positiveFillColor: state.positiveFillColor,
    positiveBorderColor: state.positiveBorderColor,
    positiveGradientFill: state.positiveGradientFill,
    negativeFillColor: state.negativeFillColor,
    negativeBorderColor: state.negativeBorderColor,
    negativeMatchPositiveFillColor: state.negativeMatchPositiveFillColor,
    negativeMatchPositiveBorderColor: state.negativeMatchPositiveBorderColor,
  };
}

function cloneRecoveryConditionalColorScaleCriterion(
  criterion: RecoveryConditionalColorScaleCriterion,
): RecoveryConditionalColorScaleCriterion {
  return {
    type: criterion.type,
    formula: criterion.formula,
    color: criterion.color,
  };
}

function cloneRecoveryConditionalColorScaleState(
  state: RecoveryConditionalColorScaleState,
): RecoveryConditionalColorScaleState {
  return {
    minimum: cloneRecoveryConditionalColorScaleCriterion(state.minimum),
    midpoint: state.midpoint ? cloneRecoveryConditionalColorScaleCriterion(state.midpoint) : undefined,
    maximum: cloneRecoveryConditionalColorScaleCriterion(state.maximum),
  };
}

function cloneRecoveryConditionalIcon(icon: RecoveryConditionalIcon): RecoveryConditionalIcon {
  return {
    set: icon.set,
    index: icon.index,
  };
}

function cloneRecoveryConditionalIconCriterion(
  criterion: RecoveryConditionalIconCriterion,
): RecoveryConditionalIconCriterion {
  return {
    type: criterion.type,
    operator: criterion.operator,
    formula: criterion.formula,
    customIcon: criterion.customIcon ? cloneRecoveryConditionalIcon(criterion.customIcon) : undefined,
  };
}

function cloneRecoveryConditionalIconSetState(state: RecoveryConditionalIconSetState): RecoveryConditionalIconSetState {
  return {
    style: state.style,
    reverseIconOrder: state.reverseIconOrder,
    showIconOnly: state.showIconOnly,
    criteria: state.criteria.map((criterion) => cloneRecoveryConditionalIconCriterion(criterion)),
  };
}

function cloneRecoveryConditionalFormatRule(rule: RecoveryConditionalFormatRule): RecoveryConditionalFormatRule {
  return {
    type: rule.type,
    stopIfTrue: rule.stopIfTrue,
    formula: rule.formula,
    operator: rule.operator,
    formula1: rule.formula1,
    formula2: rule.formula2,
    textOperator: rule.textOperator,
    text: rule.text,
    topBottomType: rule.topBottomType,
    rank: rule.rank,
    presetCriterion: rule.presetCriterion,
    dataBar: rule.dataBar ? cloneRecoveryConditionalDataBarState(rule.dataBar) : undefined,
    colorScale: rule.colorScale ? cloneRecoveryConditionalColorScaleState(rule.colorScale) : undefined,
    iconSet: rule.iconSet ? cloneRecoveryConditionalIconSetState(rule.iconSet) : undefined,
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

export function cloneRecoveryModifyStructureState(state: RecoveryModifyStructureState): RecoveryModifyStructureState {
  if (state.kind === "sheet_name") {
    return {
      kind: "sheet_name",
      sheetId: state.sheetId,
      name: state.name,
    };
  }

  return {
    kind: "sheet_visibility",
    sheetId: state.sheetId,
    visibility: state.visibility,
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
    columnWidth: selection.columnWidth,
    rowHeight: selection.rowHeight,
    mergedAreas: selection.mergedAreas,
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
    columnWidths: area.columnWidths ? [...area.columnWidths] : undefined,
    rowHeights: area.rowHeights ? [...area.rowHeights] : undefined,
    mergedAreas: area.mergedAreas ? [...area.mergedAreas] : undefined,
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
    selection.columnWidth === true ||
    selection.rowHeight === true ||
    selection.mergedAreas === true ||
    selection.borderTop === true ||
    selection.borderBottom === true ||
    selection.borderLeft === true ||
    selection.borderRight === true ||
    selection.borderInsideHorizontal === true ||
    selection.borderInsideVertical === true
  );
}

function hasAreaScalarSelection(selection: RecoveryFormatSelection): boolean {
  return (
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

export interface RecoveryFormatAreaShape {
  rowCount: number;
  columnCount: number;
}

function estimateMergedAreasUnitCount(area: RecoveryFormatAreaShape): number {
  const cellCount = area.rowCount * area.columnCount;

  if (cellCount <= 1) {
    return cellCount;
  }

  // A merged block must contain at least two cells, so this bounds merge-dense sheets
  // without pretending merged-area payloads are constant-size.
  return Math.floor(cellCount / 2);
}

export function estimateFormatCaptureCellCount(
  areas: readonly RecoveryFormatAreaShape[],
  selection: RecoveryFormatSelection,
): number {
  const includeAreaScalarUnits = hasAreaScalarSelection(selection);

  return areas.reduce((count, area) => {
    let areaCount = count;

    if (selection.numberFormat === true) {
      areaCount += area.rowCount * area.columnCount;
    }

    if (selection.columnWidth === true) {
      areaCount += area.columnCount;
    }

    if (selection.rowHeight === true) {
      areaCount += area.rowCount;
    }

    if (selection.mergedAreas === true) {
      areaCount += estimateMergedAreasUnitCount(area);
    }

    if (includeAreaScalarUnits) {
      areaCount += 1;
    }

    return areaCount;
  }, 0);
}

function normalizeRecoveryAddress(address: string): string {
  return address.trim();
}

function dedupeRecoveryAddresses(addresses: readonly string[]): string[] {
  const unique = new Set<string>();
  const ordered: string[] = [];

  for (const rawAddress of addresses) {
    const address = normalizeRecoveryAddress(rawAddress);
    if (address.length === 0 || unique.has(address)) {
      continue;
    }

    unique.add(address);
    ordered.push(address);
  }

  return ordered;
}

function collectMergedAreaAddresses(state: RecoveryFormatRangeState): string[] {
  const addresses: string[] = [];

  for (const area of state.areas) {
    if (!Array.isArray(area.mergedAreas)) {
      continue;
    }

    for (const address of area.mergedAreas) {
      addresses.push(address);
    }
  }

  return dedupeRecoveryAddresses(addresses);
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
  columnFormats: Excel.RangeFormat[];
  rowFormats: Excel.RangeFormat[];
  mergedAreas?: Excel.RangeAreas;
  mergedAreaAddresses: string[];
  borders: Partial<Record<RecoveryBorderKey, Excel.RangeBorder>>;
}

async function captureFormatRangeStateWithSelection(
  context: Excel.RequestContext,
  target: ResolvedFormatCaptureTarget,
  selection: RecoveryFormatSelection,
  maxCellCount?: number,
): Promise<RecoveryFormatCaptureResult> {
  if (!hasSelectedFormatProperty(selection)) {
    return {
      supported: false,
      reason: "No restorable format properties were selected.",
    };
  }

  const captureCellCount = estimateFormatCaptureCellCount(target.areas, selection);

  if (typeof maxCellCount === "number" && Number.isFinite(maxCellCount) && captureCellCount > maxCellCount) {
    return {
      supported: false,
      reason: `Format checkpoint capture skipped: snapshot size exceeds ${maxCellCount.toLocaleString()} units.`,
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
      columnFormats: [],
      rowFormats: [],
      mergedAreaAddresses: [],
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

    if (selection.columnWidth === true) {
      for (let columnIndex = 0; columnIndex < area.columnCount; columnIndex += 1) {
        const columnFormat = area.getColumn(columnIndex).format;
        columnFormat.load("columnWidth");
        prepared.columnFormats.push(columnFormat);
      }
    }

    if (selection.rowHeight === true) {
      for (let rowIndex = 0; rowIndex < area.rowCount; rowIndex += 1) {
        const rowFormat = area.getRow(rowIndex).format;
        rowFormat.load("rowHeight");
        prepared.rowFormats.push(rowFormat);
      }
    }

    if (selection.mergedAreas === true) {
      const mergedAreas = area.getMergedAreasOrNullObject();
      mergedAreas.load("isNullObject");
      prepared.mergedAreas = mergedAreas;
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

  if (selection.mergedAreas === true) {
    for (const prepared of preparedAreas) {
      const mergedAreas = prepared.mergedAreas;
      if (!mergedAreas || mergedAreas.isNullObject) {
        prepared.mergedAreaAddresses = [];
        continue;
      }

      mergedAreas.areas.load("items/address");
    }

    await context.sync();

    for (const prepared of preparedAreas) {
      const mergedAreas = prepared.mergedAreas;
      if (!mergedAreas || mergedAreas.isNullObject) {
        prepared.mergedAreaAddresses = [];
        continue;
      }

      prepared.mergedAreaAddresses = dedupeRecoveryAddresses(
        mergedAreas.areas.items.map((areaRange) =>
          qualifyAddressWithSheet(target.sheetName, areaRange.address),
        ),
      );
    }
  }

  const areaStates: RecoveryFormatAreaState[] = [];

  for (const prepared of preparedAreas) {
    const areaState: RecoveryFormatAreaState = {
      address: prepared.address,
      rowCount: prepared.rowCount,
      columnCount: prepared.columnCount,
    };

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

    if (selection.columnWidth === true) {
      const columnWidths: number[] = [];
      for (const columnFormat of prepared.columnFormats) {
        const width = normalizeOptionalNumber(columnFormat.columnWidth);
        if (width === undefined) {
          return {
            supported: false,
            reason: "Format checkpoint capture failed: column width is mixed or unsupported.",
          };
        }

        columnWidths.push(width);
      }

      if (columnWidths.length !== prepared.columnCount) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: column-width count mismatch.",
        };
      }

      areaState.columnWidths = columnWidths;
    }

    if (selection.rowHeight === true) {
      const rowHeights: number[] = [];
      for (const rowFormat of prepared.rowFormats) {
        const height = normalizeOptionalNumber(rowFormat.rowHeight);
        if (height === undefined) {
          return {
            supported: false,
            reason: "Format checkpoint capture failed: row height is mixed or unsupported.",
          };
        }

        rowHeights.push(height);
      }

      if (rowHeights.length !== prepared.rowCount) {
        return {
          supported: false,
          reason: "Format checkpoint capture failed: row-height count mismatch.",
        };
      }

      areaState.rowHeights = rowHeights;
    }

    if (selection.mergedAreas === true) {
      areaState.mergedAreas = [...prepared.mergedAreaAddresses];
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
      cellCount: captureCellCount,
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

  if (Array.isArray(state.columnWidths)) {
    for (let columnIndex = 0; columnIndex < state.columnWidths.length; columnIndex += 1) {
      const width = state.columnWidths[columnIndex];
      range.getColumn(columnIndex).format.columnWidth = width;
    }
  }

  if (Array.isArray(state.rowHeights)) {
    for (let rowIndex = 0; rowIndex < state.rowHeights.length; rowIndex += 1) {
      const height = state.rowHeights[rowIndex];
      range.getRow(rowIndex).format.rowHeight = height;
    }
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

export interface CaptureFormatCellsStateOptions {
  maxCellCount?: number;
}

export async function captureFormatCellsState(
  address: string,
  selection: RecoveryFormatSelection,
  options: CaptureFormatCellsStateOptions = {},
): Promise<RecoveryFormatCaptureResult> {
  if (!hasSelectedFormatProperty(selection)) {
    return captureFormatRangeStateUnsupported("No restorable format properties were selected.");
  }

  return excelRun<RecoveryFormatCaptureResult>(async (context) => {
    const target = await resolveFormatCaptureTarget(context, address);
    return captureFormatRangeStateWithSelection(context, target, selection, options.maxCellCount);
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

    const restoreMergedAreas = targetState.selection.mergedAreas === true;
    const currentMergedAddresses = restoreMergedAreas
      ? collectMergedAreaAddresses(previousState)
      : [];
    const targetMergedAddresses = restoreMergedAreas
      ? collectMergedAreaAddresses(targetState)
      : [];

    for (const loaded of loadedAreas) {
      const { areaState, range } = loaded;

      const requiresExactShape =
        typeof areaState.numberFormat !== "undefined" ||
        typeof areaState.columnWidths !== "undefined" ||
        typeof areaState.rowHeights !== "undefined";

      if (requiresExactShape) {
        if (range.rowCount !== areaState.rowCount || range.columnCount !== areaState.columnCount) {
          throw new Error("Format checkpoint range shape changed and cannot be restored safely.");
        }
      }

      if (Array.isArray(areaState.columnWidths) && areaState.columnWidths.length !== areaState.columnCount) {
        throw new Error("Format checkpoint is invalid: column-width data does not match range shape.");
      }

      if (Array.isArray(areaState.rowHeights) && areaState.rowHeights.length !== areaState.rowCount) {
        throw new Error("Format checkpoint is invalid: row-height data does not match range shape.");
      }

      applyFormatRangeStateToArea(range, areaState);
    }

    if (restoreMergedAreas) {
      for (const mergedAddress of currentMergedAddresses) {
        const { range } = getRange(context, mergedAddress);
        range.unmerge();
      }

      for (const mergedAddress of targetMergedAddresses) {
        const { range } = getRange(context, mergedAddress);
        range.merge();
      }
    }

    await context.sync();
    return cloneRecoveryFormatRangeState(previousState);
  });
}

interface CaptureModifyStructureStateArgs {
  kind: RecoveryModifyStructureState["kind"];
  sheetRef: string;
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

    const visibility = sheet.visibility;
    if (!isRecoverySheetVisibility(visibility)) {
      return null;
    }

    return {
      kind: "sheet_visibility",
      sheetId: sheet.id,
      visibility,
    };
  });
}

export async function applyModifyStructureState(
  targetState: RecoveryModifyStructureState,
): Promise<RecoveryModifyStructureState> {
  return excelRun<RecoveryModifyStructureState>(async (context) => {
    const sheet = context.workbook.worksheets.getItemOrNullObject(targetState.sheetId);
    sheet.load("isNullObject,id,name,visibility");
    await context.sync();

    if (sheet.isNullObject) {
      throw new Error("Sheet referenced by structure checkpoint no longer exists.");
    }

    if (targetState.kind === "sheet_name") {
      const currentState: RecoveryModifyStructureState = {
        kind: "sheet_name",
        sheetId: sheet.id,
        name: sheet.name,
      };

      sheet.name = targetState.name;
      await context.sync();
      return currentState;
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
