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

const EXCEL_TOOL_NAMES = [
  "get_workbook_overview",
  "read_range",
  "read_selection",
  "get_range_as_csv",
  "get_all_objects",
  "write_cells",
  "fill_formula",
  "search_workbook",
  "modify_structure",
  "format_cells",
  "conditional_format",
  "trace_dependencies",
  "get_recent_changes",
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
    return String(params);
  }
}

function safeParseParams(params: unknown): Record<string, unknown> {
  if (!params) return {};
  if (typeof params === "object" && params !== null) return params as Record<string, unknown>;
  if (typeof params === "string") {
    try { return JSON.parse(params); } catch { return {}; }
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
    const parsed = JSON.parse(trimmed);
    return { isJson: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, formatted: text };
  }
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

/** Append error / blocked badge when relevant. */
function withBadge(base: string, resultText?: string): string {
  if (!resultText) return base;
  if (isBlocked(resultText)) return `${base} — blocked`;
  const n = countResultErrors(resultText);
  if (n > 0) return `${base} — ${n} error${n !== 1 ? "s" : ""}`;
  return base;
}

/** One-liner describing what the tool call does/did. */
function describeToolCall(toolName: string, params: unknown, resultText?: string): string {
  const p = safeParseParams(params);
  const range = p.range as string | undefined;
  const startCell = p.start_cell as string | undefined;

  switch (toolName) {
    // ── Read tools: always param-based (result text has confusing NxM) ──
    case "read_range":
      return range ? `Read ${compactRange(range)}` : "Read range";
    case "read_selection":
      return "Read selection";
    case "get_workbook_overview":
      return "Workbook overview";
    case "get_range_as_csv":
      return range ? `Export ${compactRange(range)} as CSV` : "Export as CSV";
    case "get_all_objects":
      return "Get charts & objects";

    // ── Write tools: extract target from result, flag errors ──
    case "write_cells": {
      const addr = resultText ? extractWrittenAddress(resultText) : null;
      const base = addr
        ? `Wrote ${addr}`
        : startCell ? `Write ${startCell}` : "Write cells";
      return withBadge(base, resultText);
    }
    case "fill_formula": {
      const addr = resultText ? extractWrittenAddress(resultText) : null;
      const base = addr
        ? `Filled ${addr}`
        : range ? `Fill ${compactRange(range)}` : "Fill formula";
      return withBadge(base, resultText);
    }

    // ── Format tools: just the compacted range (details are in the card body) ──
    case "format_cells":
      return range ? `Format ${compactRange(range)}` : "Format cells";
    case "conditional_format":
      return range ? `Cond. format ${compactRange(range)}` : "Conditional format";
    case "modify_structure": {
      if (resultText) { const s = resultSummary(resultText); if (s) return s; }
      const action = p.action as string | undefined;
      const name = (p.name ?? p.new_name) as string | undefined;
      if (action === "add_sheet") return name ? `Add sheet "${name}"` : "Add sheet";
      if (action === "rename_sheet") return name ? `Rename to "${name}"` : "Rename sheet";
      if (action === "delete_sheet") return "Delete sheet";
      return "Modify structure";
    }
    case "search_workbook": {
      if (resultText) { const s = resultSummary(resultText); if (s) return s; }
      const q = p.query as string | undefined;
      return q ? `Search "${q}"` : "Search workbook";
    }

    // ── Other tools: param-based descriptions ──
    case "trace_dependencies": {
      const cell = (p.cell ?? p.range) as string | undefined;
      return cell ? `Trace ${cell}` : "Trace dependencies";
    }
    case "get_recent_changes":
      return "Recent changes";
    default: {
      if (resultText) { const s = resultSummary(resultText); if (s) return s; }
      return toolName.replace(/_/g, " ");
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
      const description = describeToolCall(toolName, params, resultText);
      const title = html`<span class="pi-tool-card__title">${description}</span>`;

      // ── With result ─────────────────────────────────────
      if (result) {
        const { text, images } = splitToolResultContent(result);
        const standaloneImagePath = detectStandaloneImagePath(text);
        const json = tryFormatJsonOutput(text);

        return {
          content: html`
            <div class="pi-tool-card" data-state=${state}>
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
                      <code-block .code=${paramsJson} language="json"></code-block>
                    </div>
                  ` : ""}
                  <div class="pi-tool-card__section">
                    <div class="pi-tool-card__section-label">Output</div>
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
                        : html`<markdown-block .content=${text || "(no output)"}></markdown-block>`}
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
            <div class="pi-tool-card" data-state=${state}>
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
                    <code-block .code=${paramsJson} language="json"></code-block>
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
          <div class="pi-tool-card" data-state=${state}>
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
