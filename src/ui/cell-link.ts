/**
 * Clickable cell references — navigate to a cell/range in Excel
 * and flash a brief glow to draw the user's eye.
 */

import { html, type TemplateResult } from "lit";
import { excelRun, parseRangeRef } from "../excel/helpers.js";

/* ── Design tokens (match theme.css --pi-green) ─────────────── */

/** Glow color — light teal matching the app accent. */
const GLOW_COLOR = "#C8F0DF";
/** Duration of the glow flash in ms. */
const GLOW_MS = 1200;

/* ── Excel navigation ───────────────────────────────────────── */

/**
 * Navigate Excel to the given address, select it, and flash a
 * brief teal glow so the user can spot it.
 *
 * Safe to call on any well-formed reference — sheet-qualified or
 * relative to the active sheet.
 *
 * Glow restore uses a second `Excel.run` to avoid holding the
 * context open during the timeout.
 */
async function navigateToRange(address: string): Promise<void> {
  // Phase 1 — navigate + apply glow
  const restoreInfo = await excelRun(async (ctx) => {
    const parsed = parseRangeRef(address);
    const ws = parsed.sheet
      ? ctx.workbook.worksheets.getItem(parsed.sheet)
      : ctx.workbook.worksheets.getActiveWorksheet();
    const range = ws.getRange(parsed.address);

    // Activate sheet (scrolls & tabs)
    ws.activate();
    range.select();

    // Read the current fill to restore later
    range.format.fill.load("color");
    await ctx.sync();

    const origColor = range.format.fill.color;

    // Apply glow
    range.format.fill.color = GLOW_COLOR;
    await ctx.sync();

    return { address: parsed.address, sheet: parsed.sheet, origColor };
  });

  // Phase 2 — restore after delay
  setTimeout(() => {
    void excelRun(async (ctx) => {
      const ws = restoreInfo.sheet
        ? ctx.workbook.worksheets.getItem(restoreInfo.sheet)
        : ctx.workbook.worksheets.getActiveWorksheet();
      const range = ws.getRange(restoreInfo.address);

      // Restore — empty/white means "no fill"
      if (!restoreInfo.origColor || restoreInfo.origColor === "#FFFFFF") {
        range.format.fill.clear();
      } else {
        range.format.fill.color = restoreInfo.origColor;
      }
      await ctx.sync();
    });
  }, GLOW_MS);
}

/* ── Lit template helper ────────────────────────────────────── */

/**
 * Render a cell/range address as a clickable link that navigates
 * Excel to that location.
 *
 * Usage in Lit templates:
 *   html`Range: ${cellRef("Sheet1!A1:B10")}`
 */
export function cellRef(address: string): TemplateResult {
  return html`<a
    class="pi-cell-ref"
    href="#"
    @click=${(e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      void navigateToRange(address);
    }}
  >${address}</a>`;
}

/**
 * Render a range display value (possibly a TemplateResult with
 * "+N more" suffix) as a clickable cell ref. Falls back to plain
 * text for non-string values (e.g. already-rendered templates).
 */
export function cellRefDisplay(
  display: TemplateResult | string,
  fullAddress: string,
): TemplateResult {
  return html`<a
    class="pi-cell-ref"
    href="#"
    @click=${(e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      void navigateToRange(fullAddress);
    }}
  >${display}</a>`;
}
