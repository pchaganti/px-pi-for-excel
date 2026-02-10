/**
 * Tool renderers for Pi-for-Excel.
 *
 * Renders Excel tool calls as compact, collapsed-by-default cards with
 * human-readable descriptions. Expand to see raw Input/Output.
 */

import type { ImageContent, TextContent, ToolResultMessage } from "@mariozechner/pi-ai";
import {
  registerToolRenderer,
  renderCollapsibleHeader,
  renderHeader,
  type ToolRenderer,
  type ToolRenderResult,
} from "@mariozechner/pi-web-ui";
import { html, type TemplateResult } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { Code } from "lucide";
import { humanizeToolInput } from "./humanize-params.js";
import { humanizeColorsInText } from "./color-names.js";

// Ensure <markdown-block> custom element is registered before we render it.
import "@mariozechner/mini-lit/dist/MarkdownBlock.js";

const EXCEL_TOOL_NAMES = [
  "get_workbook_overview",
  "read_range",
  "write_cells",
  "fill_formula",
  "search_workbook",
  "modify_structure",
  "format_cells",
  "conditional_format",
  "trace_dependencies",
  "view_settings",
] as const;

type ToolState = "inprogress" | "complete" | "error";

/* ── Helpers ────────────────────────────────────────────────── */

function formatParamsJson(params: unknown): string {
  if (params === undefined) return "";

  try {
    if (typeof params === "string") {
      try {
        return JSON.stringify(JSON.parse(params), null, 2);
      } catch {
        return params;
      }
    }
    return JSON.stringify(params, null, 2);
  } catch {
    return typeof params === "string" || typeof params === "number" || typeof params === "boolean" ? String(params) : JSON.stringify(params);
  }
}

function safeParseParams(params: unknown): Record<string, unknown> {
  if (!params) return {};
  if (typeof params === "object" && params !== null) return params as Record<string, unknown>;
  if (typeof params === "string") {
    try {
      const parsed: unknown = JSON.parse(params);
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
      return {};
    } catch { return {}; }
  }
  return {};
}

function splitToolResultContent(result: ToolResultMessage<unknown>): {
  text: string;
  images: ImageContent[];
} {
  const text = (result.content ?? [])
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const images = (result.content ?? []).filter((c): c is ImageContent => c.type === "image");

  return { text, images };
}

function tryFormatJsonOutput(text: string): { isJson: boolean; formatted: string } {
  const trimmed = text.trim();
  if (!trimmed) return { isJson: false, formatted: text };

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return { isJson: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, formatted: text };
  }
}

/**
 * Heuristic: does the text contain markdown syntax that benefits from
 * rendering via `<markdown-block>` rather than plain text?
 *
 * Checks for: tables, headers, lists, bold/italic, links, code fences,
 * blockquotes, horizontal rules, and emoji sentinels (✅ ⛔ etc.).
 */
function looksLikeMarkdown(text: string): boolean {
  // Table rows: "| ... | ... |"
  if (/^\s*\|.+\|/m.test(text)) return true;
  // ATX headers: "# ", "## ", etc.
  if (/^#{1,6}\s+\S/m.test(text)) return true;
  // Unordered list items: "- item" or "* item"
  if (/^[ \t]*[-*]\s+\S/m.test(text)) return true;
  // Ordered list items: "1. item"
  if (/^[ \t]*\d+\.\s+\S/m.test(text)) return true;
  // Bold / italic
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  if (/__[^_]+__/.test(text)) return true;
  // Links: [text](url)
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;
  // Fenced code blocks
  if (/^```/m.test(text)) return true;
  // Blockquotes: "> "
  if (/^>\s+\S/m.test(text)) return true;
  // Horizontal rules: "---" or "***" or "___" (alone on a line)
  if (/^[-*_]{3,}\s*$/m.test(text)) return true;
  // Common sentinels our tools emit (emoji prefixes)
  if (/^[✅⛔⚠️ℹ️📊📋🔍]/m.test(text)) return true;

  return false;
}

function stripMarkdownInline(line: string): string {
  return line
    .replace(/^#+\s+/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function extractSummaryLine(text: string): string | null {
  for (const rawLine of text.split("\n")) {
    const t = rawLine.trim();
    if (!t) continue;
    if (t.startsWith("|")) continue;

    const stripped = stripMarkdownInline(t);
    if (stripped) return stripped;
  }
  return null;
}

function detectStandaloneImagePath(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.includes("\n")) return null;

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(t);
  if (!isImage) return null;

  const isUnixAbs = t.startsWith("/");
  const isWinAbs = /^[A-Za-z]:\\/.test(t);
  const isFileUrl = t.startsWith("file://");

  return isUnixAbs || isWinAbs || isFileUrl ? t : null;
}

function pathBasename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toFileUrl(path: string): string {
  if (path.startsWith("file://")) return path;

  const win = /^([A-Za-z]):\\(.*)$/.exec(path);
  if (win) {
    const drive = win[1].toUpperCase();
    const rest = win[2]
      .split("\\")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `file:///${drive}:/${rest}`;
  }

  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `file://${encoded}`;
}

function renderImages(images: ImageContent[]): TemplateResult {
  if (!images.length) return html``;

  return html`
    <div class="mt-2 grid grid-cols-1 gap-2">
      ${images.map((img) => {
        const src = `data:${img.mimeType};base64,${img.data}`;
        return html`
          <div class="border border-border rounded-lg overflow-hidden bg-background">
            <img src=${src} class="block w-full h-auto" />
          </div>
        `;
      })}
    </div>
  `;
}

/* ── Human-readable descriptions ────────────────────────────── */

/** Strip "(N×M)" / "(NxM)" dimension notation — not intuitive for users. */
function stripDimensions(text: string): string {
  return text.replace(/\s*\(\d+[×x]\d+\)/gi, "").trim();
}

/**
 * Compact multi-range addresses by factoring out a shared sheet prefix.
 *   "Summary!A3,Summary!A13,Summary!A22" → "Summary!A3,A13,A22"
 *   "Costs!A18:C18, Costs!A19:C19"       → "Costs!A18:C18,A19:C19"
 */
function compactRange(range: string): string {
  const parts = range.split(/\s*,\s*/);
  if (parts.length <= 1) return range;

  const parsed = parts.map((p) => {
    const bang = p.indexOf("!");
    return bang >= 0
      ? { sheet: p.substring(0, bang), addr: p.substring(bang + 1) }
      : { sheet: "", addr: p };
  });

  const first = parsed[0].sheet;
  if (first && parsed.every((p) => p.sheet === first)) {
    return `${first}!${parsed.map((p) => p.addr).join(",")}`;
  }
  return range;
}

/**
 * Compact sheet-qualified ranges inside bold markdown markers.
 *   "Formatted **Sheet1!A1,Sheet1!B2**: ..." → "Formatted **Sheet1!A1, B2**: ..."
 */
function compactRangesInMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, (_match, inner: string) => {
    if (!inner.includes("!")) return `**${inner}**`;
    const compacted = compactRange(inner);
    // Add spaces after commas for readability
    const spaced = compacted.replace(/,(?!\s)/g, ", ");
    return `**${spaced}**`;
  });
}

/** Extract target address from write_cells / fill_formula result text. */
function extractWrittenAddress(text: string): string | null {
  // "Written to **Sheet1!A1:C10** (…)" or "Filled formula across **Sheet1!A1:B20** (…)"
  const m = /(?:Written to|Filled formula across)\s+\*\*([^*]+)\*\*/.exec(text);
  return m ? m[1] : null;
}

/** Count formula errors mentioned in tool result text. */
function countResultErrors(text: string): number {
  const m = /(\d+)\s+formula error/i.exec(text);
  return m ? parseInt(m[1], 10) : 0;
}

/** True when result text starts with the blocked sentinel. */
function isBlocked(text: string): boolean {
  return text.trimStart().startsWith("⛔");
}

/** Result-aware summary for result text that is already user-friendly. */
function resultSummary(text: string): string | null {
  const line = extractSummaryLine(text);
  return line ? stripDimensions(line) : null;
}

/** Append error / blocked badge to the detail string. */
function badge(resultText?: string): string {
  if (!resultText) return "";
  if (isBlocked(resultText)) return " — blocked";
  const n = countResultErrors(resultText);
  if (n > 0) return ` — ${n} error${n !== 1 ? "s" : ""}`;
  return "";
}

interface ToolDesc {
  /** Bold verb, e.g. "Read", "Wrote", "Format" */
  action: string;
  /** Normal-weight rest, e.g. "Costs!A1:C19" */
  detail: string;
}

/** Split a result-text summary line into action (first word) + rest. */
function splitFirstWord(text: string): ToolDesc {
  const i = text.indexOf(" ");
  return i > 0
    ? { action: text.substring(0, i), detail: text.substring(i + 1) }
    : { action: text, detail: "" };
}

/** Structured description: bold action + normal-weight detail. */
function describeToolCall(toolName: string, params: unknown, resultText?: string): ToolDesc {
  const p = safeParseParams(params);
  const range = p.range as string | undefined;
  const startCell = p.start_cell as string | undefined;

  switch (toolName) {
    // ── Read tools ──
    case "read_range": {
      const mode = p.mode as string | undefined;
      const label = mode === "csv" ? "Export" : "Read";
      return { action: label, detail: range ? compactRange(range) + (mode === "csv" ? " (CSV)" : "") : "range" };
    }
    case "get_workbook_overview": {
      const sheet = p.sheet as string | undefined;
      return { action: "Overview", detail: sheet ?? "" };
    }

    // ── Write tools ──
    case "write_cells": {
      const addr = resultText ? extractWrittenAddress(resultText) : null;
      return addr
        ? { action: "Edit", detail: addr + badge(resultText) }
        : { action: "Write", detail: (startCell ?? "cells") + badge(resultText) };
    }
    case "fill_formula": {
      const addr = resultText ? extractWrittenAddress(resultText) : null;
      return addr
        ? { action: "Filled", detail: addr + badge(resultText) }
        : { action: "Fill", detail: (range ? compactRange(range) : "formula") + badge(resultText) };
    }

    // ── Format tools ──
    case "format_cells":
      return { action: "Format", detail: range ? compactRange(range) : "cells" };
    case "conditional_format":
      return { action: "Cond. format", detail: range ? compactRange(range) : "cells" };

    // ── Result-text tools (split first word as action) ──
    case "modify_structure": {
      if (resultText) { const s = resultSummary(resultText); if (s) return splitFirstWord(s); }
      const act = p.action as string | undefined;
      const name = (p.name ?? p.new_name) as string | undefined;
      if (act === "add_sheet") return { action: "Add", detail: name ? `sheet "${name}"` : "sheet" };
      if (act === "rename_sheet") return { action: "Rename", detail: name ? `to "${name}"` : "sheet" };
      if (act === "delete_sheet") return { action: "Delete", detail: "sheet" };
      return { action: "Modify", detail: "structure" };
    }
    case "search_workbook": {
      if (resultText) { const s = resultSummary(resultText); if (s) return splitFirstWord(s); }
      const q = p.query as string | undefined;
      return { action: "Search", detail: q ? `"${q}"` : "workbook" };
    }

    // ── Other tools ──
    case "trace_dependencies": {
      const cell = (p.cell ?? p.range) as string | undefined;
      return { action: "Trace", detail: cell ?? "dependencies" };
    }
    case "get_recent_changes":
      return { action: "Recent", detail: "changes" };
    default: {
      if (resultText) { const s = resultSummary(resultText); if (s) return splitFirstWord(s); }
      return { action: toolName.replace(/_/g, " "), detail: "" };
    }
  }
}

/* ── Renderer ───────────────────────────────────────────────── */

function createExcelMarkdownRenderer(toolName: string): ToolRenderer<unknown, unknown> {
  return {
    render(
      params: unknown,
      result: ToolResultMessage<unknown> | undefined,
      isStreaming?: boolean,
    ): ToolRenderResult {
      const state: ToolState = result
        ? (result.isError ? "error" : "complete")
        : isStreaming
          ? "inprogress"
          : "complete";

      const paramsJson = formatParamsJson(params);
      const contentRef = createRef<HTMLDivElement>();
      const chevronRef = createRef<HTMLElement>();

      // Always start collapsed — the description tells the user what happened
      const defaultExpanded = false;

      const resultText = result ? splitToolResultContent(result).text : undefined;
      const desc = describeToolCall(toolName, params, resultText);
      const title = html`<span class="pi-tool-card__title"><strong>${desc.action}</strong>${desc.detail ? html` <span class="pi-tool-card__detail-text">${desc.detail}</span>` : ""}</span>`;

      // ── With result ─────────────────────────────────────
      if (result) {
        const { text, images } = splitToolResultContent(result);
        const standaloneImagePath = detectStandaloneImagePath(text);
        const json = tryFormatJsonOutput(text);
        const humanizedText = compactRangesInMarkdown(humanizeColorsInText(text));
        const useMarkdown = !json.isJson && looksLikeMarkdown(text);

        return {
          content: html`
            <div class="pi-tool-card" data-state=${state} data-tool-name=${toolName}>
              <div class="pi-tool-card__header">
                ${renderCollapsibleHeader(state, Code, title, contentRef, chevronRef, defaultExpanded)}
              </div>
              <div ${ref(contentRef)}
                class="pi-tool-card__body overflow-hidden transition-all duration-300 max-h-0"
              >
                <div class="pi-tool-card__inner">
                  <div class="pi-tool-card__detail">
                    <span class="pi-tool-card__tool-id">${toolName}</span>
                  </div>
                  ${paramsJson ? html`
                    <div class="pi-tool-card__section">
                      <div class="pi-tool-card__section-label">Input</div>
                      ${humanizeToolInput(toolName, params) ?? html`<code-block .code=${paramsJson} language="json"></code-block>`}
                    </div>
                  ` : ""}
                  <div class="pi-tool-card__section">
                    <div class="pi-tool-card__section-label">Result</div>
                    ${standaloneImagePath
                      ? html`
                        <div class="text-sm">
                          <div>Image:
                            <a href=${toFileUrl(standaloneImagePath)} target="_blank"
                              rel="noopener noreferrer" class="underline">
                              ${pathBasename(standaloneImagePath)}
                            </a>
                          </div>
                          <div class="mt-1 text-xs font-mono text-muted-foreground break-all">
                            ${standaloneImagePath}
                          </div>
                        </div>
                      `
                      : json.isJson
                        ? html`<code-block .code=${json.formatted} language="json"></code-block>`
                        : useMarkdown
                          ? html`<div class="pi-tool-card__markdown"><markdown-block .content=${humanizedText || "(no output)"}></markdown-block></div>`
                          : html`<div class="pi-tool-card__plain-text">${humanizedText || "(no output)"}</div>`}
                    ${renderImages(images)}
                  </div>
                </div>
              </div>
            </div>
          `,
          isCustom: true,
        };
      }

      // ── Streaming / pending with params ──────────────────
      if (paramsJson) {
        return {
          content: html`
            <div class="pi-tool-card" data-state=${state} data-tool-name=${toolName}>
              <div class="pi-tool-card__header">
                ${renderCollapsibleHeader(state, Code, title, contentRef, chevronRef, defaultExpanded)}
              </div>
              <div ${ref(contentRef)}
                class="pi-tool-card__body overflow-hidden transition-all duration-300 max-h-0"
              >
                <div class="pi-tool-card__inner">
                  <div class="pi-tool-card__detail">
                    <span class="pi-tool-card__tool-id">${toolName}</span>
                  </div>
                  <div class="pi-tool-card__section">
                    <div class="pi-tool-card__section-label">Input</div>
                    ${humanizeToolInput(toolName, params) ?? html`<code-block .code=${paramsJson} language="json"></code-block>`}
                  </div>
                </div>
              </div>
            </div>
          `,
          isCustom: true,
        };
      }

      // ── No params or result yet ──────────────────────────
      return {
        content: html`
          <div class="pi-tool-card" data-state=${state} data-tool-name=${toolName}>
            <div class="pi-tool-card__header">
              ${renderHeader(state, Code, title)}
            </div>
          </div>
        `,
        isCustom: true,
      };
    },
  };
}

for (const name of EXCEL_TOOL_NAMES) {
  registerToolRenderer(name, createExcelMarkdownRenderer(name));
}
