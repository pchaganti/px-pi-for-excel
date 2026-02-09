/**
 * conventions — public API for the composable cell styles system.
 */

// Types
export type {
  BorderWeight,
  NumberPreset,
  NumberFormatConventions,
  CellStyle,
  NamedStyle,
  ResolvedCellStyle,
} from "./types.js";

// Defaults
export {
  DEFAULT_CONVENTIONS,
  DEFAULT_CURRENCY_SYMBOL,
  PRESET_DEFAULT_DP,
  BUILTIN_STYLES,
  BUILTIN_STYLE_NAMES,
  FORMAT_PRESET_NAMES,
} from "./defaults.js";

// Format builder
export { buildFormatString, isPresetName } from "./format-builder.js";
export type { FormatBuildResult } from "./format-builder.js";

// Style resolver
export { resolveStyles } from "./style-resolver.js";

// Humanize
export { humanizeFormat } from "./humanize.js";
