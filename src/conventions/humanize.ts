/**
 * humanize — translate raw Excel format strings into human-readable labels.
 *
 * Builds a lookup table of all known preset+dp+symbol combinations.
 * Falls back to returning the raw string for unknowns.
 */

import type { NumberPreset } from "./types.js";
import { buildFormatString } from "./format-builder.js";
import { DEFAULT_CURRENCY_SYMBOL } from "./defaults.js";

// ── Build the lookup table ───────────────────────────────────────────

/** Map from Excel format string → human label. Built once at module load. */
const FORMAT_TO_LABEL = new Map<string, string>();

/** Common currency symbols to pre-generate labels for. */
const COMMON_CURRENCIES = ["$", "£", "€", "¥", "CHF", "kr", "R", "A$", "C$"];

/** dp values to pre-generate (covers realistic range). */
const DP_RANGE = [0, 1, 2, 3, 4];

function register(format: string, label: string): void {
  FORMAT_TO_LABEL.set(format, label);
}

// Register simple presets
function init(): void {
  // number, percent, ratio — generate all dp variants
  const simplePresets: Array<{ preset: NumberPreset; label: string }> = [
    { preset: "number", label: "number" },
    { preset: "percent", label: "percent" },
    { preset: "ratio", label: "ratio" },
  ];

  for (const { preset, label } of simplePresets) {
    for (const dp of DP_RANGE) {
      const { format } = buildFormatString(preset, dp);
      register(format, `${label} (${dp}dp)`);
    }
  }

  // Integer = number with 0dp. Register AFTER number so it overrides the "number (0dp)" entry.
  // (integer and number at 0dp produce the same format string — "integer" is the better label.)
  const { format: intFmt } = buildFormatString("integer", 0);
  register(intFmt, "integer");

  // Currency: each symbol × each dp
  for (const sym of COMMON_CURRENCIES) {
    for (const dp of DP_RANGE) {
      const { format } = buildFormatString("currency", dp, sym);
      const symLabel = sym === DEFAULT_CURRENCY_SYMBOL ? "" : ` ${sym},`;
      const dpLabel = `${dp}dp`;
      register(format, `currency (${symLabel}${dpLabel})`.replace("( ", "("));
    }
  }

  // Text
  register("@", "text");
}

init();

// ── Public API ───────────────────────────────────────────────────────

/**
 * Translate an Excel format string to a human-readable label.
 * Returns the raw string if no match is found.
 */
export function humanizeFormat(excelFormat: string): string {
  // Skip trivial/default formats
  if (!excelFormat || excelFormat === "General") return excelFormat;

  return FORMAT_TO_LABEL.get(excelFormat) ?? excelFormat;
}
