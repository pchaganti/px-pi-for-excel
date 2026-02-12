import { CORE_TOOL_NAMES, type CoreToolName } from "./names.js";

export type ToolCapabilityTier =
  | "core"
  | "on_demand_tier_1"
  | "on_demand_tier_2"
  | "on_demand_tier_3"
  | "experimental";

export type CoreToolCapabilityCategory =
  | "read"
  | "write"
  | "navigate"
  | "structure"
  | "format"
  | "inspect"
  | "view"
  | "collaboration"
  | "instructions"
  | "recovery"
  | "skills";

interface CoreToolCapabilityMetadata {
  tier: "core";
  category: CoreToolCapabilityCategory;
  promptDescription: string;
}

export interface CoreToolCapability extends CoreToolCapabilityMetadata {
  name: CoreToolName;
}

const CORE_TOOL_CAPABILITY_METADATA = {
  get_workbook_overview: {
    tier: "core",
    category: "read",
    promptDescription: "structural blueprint (sheets, headers, named ranges, tables); optional sheet-level detail for charts, pivots, shapes",
  },
  read_range: {
    tier: "core",
    category: "read",
    promptDescription: "read cell values/formulas in three formats: compact (markdown), csv (values-only), or detailed (with formatting + comments)",
  },
  write_cells: {
    tier: "core",
    category: "write",
    promptDescription: "write values/formulas with overwrite protection and auto-verification",
  },
  fill_formula: {
    tier: "core",
    category: "write",
    promptDescription: "fill a single formula across a range (AutoFill with relative refs)",
  },
  search_workbook: {
    tier: "core",
    category: "navigate",
    promptDescription: "find text, values, or formula references across all sheets; context_rows for surrounding data",
  },
  modify_structure: {
    tier: "core",
    category: "structure",
    promptDescription: "insert/delete rows/columns, add/rename/delete sheets",
  },
  format_cells: {
    tier: "core",
    category: "format",
    promptDescription: "apply formatting (bold, colors, number format, borders, etc.)",
  },
  conditional_format: {
    tier: "core",
    category: "format",
    promptDescription: "add or clear conditional formatting rules (formula or cell-value)",
  },
  trace_dependencies: {
    tier: "core",
    category: "inspect",
    promptDescription: "trace formula lineage for a cell (mode: `precedents` upstream or `dependents` downstream)",
  },
  explain_formula: {
    tier: "core",
    category: "inspect",
    promptDescription: "explain a single formula cell in plain language with cited direct references",
  },
  view_settings: {
    tier: "core",
    category: "view",
    promptDescription: "control gridlines, headings, freeze panes, tab color, sheet visibility, sheet activation, and standard width",
  },
  comments: {
    tier: "core",
    category: "collaboration",
    promptDescription: "read, add, update, reply, delete, resolve/reopen cell comments",
  },
  instructions: {
    tier: "core",
    category: "instructions",
    promptDescription: "update persistent rules for all files or this file (append or replace)",
  },
  conventions: {
    tier: "core",
    category: "instructions",
    promptDescription: "read/update formatting defaults (currency, negatives, zeros, decimal places)",
  },
  workbook_history: {
    tier: "core",
    category: "recovery",
    promptDescription: "list/restore/delete automatic backups created before Pi edits for supported workbook mutations (`write_cells`, `fill_formula`, `python_transform_range`, `format_cells`, `conditional_format`, `comments`, and supported `modify_structure` actions)",
  },
  skills: {
    tier: "core",
    category: "skills",
    promptDescription: "list/read bundled Agent Skills (SKILL.md) for task-specific workflows",
  },
} satisfies Record<CoreToolName, CoreToolCapabilityMetadata>;

export const CORE_TOOL_CAPABILITIES: readonly CoreToolCapability[] = CORE_TOOL_NAMES.map((name) => ({
  name,
  ...CORE_TOOL_CAPABILITY_METADATA[name],
}));

export function buildCoreToolPromptLines(): string {
  return CORE_TOOL_CAPABILITIES
    .map((capability) => `- **${capability.name}** — ${capability.promptDescription}`)
    .join("\n");
}

export const AUXILIARY_UI_TOOL_NAMES = [
  "web_search",
  "mcp",
  "files",
  "python_transform_range",
  "execute_office_js",
] as const;

export type AuxiliaryUiToolName = (typeof AUXILIARY_UI_TOOL_NAMES)[number];

export type UiToolName = CoreToolName | AuxiliaryUiToolName;

export const UI_TOOL_NAMES: readonly UiToolName[] = [
  ...CORE_TOOL_NAMES,
  ...AUXILIARY_UI_TOOL_NAMES,
];
