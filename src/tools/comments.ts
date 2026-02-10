/**
 * comments — CRUD for cell comments (add, read, update, reply, delete, resolve, reopen).
 *
 * Supports single cells for all actions, and ranges for read.
 * Handles threaded replies via the Excel CommentReply API.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { excelRun, getRange, qualifiedAddress, parseCell } from "../excel/helpers.js";
import { getErrorMessage } from "../utils/errors.js";

// ── Helpers ──────────────────────────────────────────────────────────

function StringEnum<T extends string[]>(values: [...T], opts?: { description?: string }) {
  return Type.Union(
    values.map((v) => Type.Literal(v)),
    opts,
  );
}

/** Check if a cell (already stripped of sheet prefix) falls within a range address. */
function isCellInRange(cellAddr: string, rangeAddr: string): boolean {
  const clean = rangeAddr.includes("!") ? rangeAddr.split("!")[1] : rangeAddr;
  const parts = clean.includes(":") ? clean.split(":") : [clean, clean];
  const start = parseCell(parts[0]);
  const end = parseCell(parts[1]);
  const cell = parseCell(cellAddr);
  return (
    cell.col >= start.col &&
    cell.col <= end.col &&
    cell.row >= start.row &&
    cell.row <= end.row
  );
}

/** Strip sheet prefix from an address (e.g. "Sheet1!A1" → "A1"). */
function stripSheet(address: string): string {
  return address.includes("!") ? address.split("!")[1] : address;
}

function requireContent(content: string | undefined, action: string): string {
  if (content === undefined || content === "") {
    throw new Error(`content is required for ${action}`);
  }
  return content;
}

// ── Schema ───────────────────────────────────────────────────────────

const schema = Type.Object({
  action: StringEnum(
    ["read", "add", "update", "reply", "delete", "resolve", "reopen"],
    {
      description:
        "Comment operation: read (list comments in range), add (new comment on cell), " +
        "update (edit existing comment text), reply (add threaded reply), " +
        "delete (remove comment + replies), resolve/reopen (toggle thread status).",
    },
  ),
  range: Type.String({
    description:
      'Target cell or range in A1 notation, e.g. "A1", "B2:D10", "Sheet2!A1". ' +
      "Range supported for read; other actions require a single cell.",
  }),
  content: Type.Optional(
    Type.String({
      description: "Comment text. Required for add, update, and reply actions.",
    }),
  ),
});

type Params = Static<typeof schema>;

// ── Interfaces for extracted comment data ────────────────────────────

interface ReplyData {
  author: string;
  content: string;
}

interface CommentData {
  cell: string;
  content: string;
  author: string;
  resolved: boolean;
  replies: ReplyData[];
}

// ── Tool ─────────────────────────────────────────────────────────────

export function createCommentsTool(): AgentTool<typeof schema> {
  return {
    name: "comments",
    label: "Comments",
    description:
      "Manage cell comments: read comments in a range, add/update/delete comments on a cell, " +
      "reply to comment threads, and resolve/reopen threads. " +
      "Use read_range in detailed mode to see comments alongside cell data.",
    parameters: schema,
    execute: async (
      _toolCallId: string,
      params: Params,
    ): Promise<AgentToolResult<undefined>> => {
      try {
        const text = await dispatch(params);
        return { content: [{ type: "text", text }], details: undefined };
      } catch (e: unknown) {
        return {
          content: [{ type: "text", text: `Error (${params.action} on "${params.range}"): ${getErrorMessage(e)}` }],
          details: undefined,
        };
      }
    },
  };
}

async function dispatch(params: Params): Promise<string> {
  switch (params.action) {
    case "read":
      return executeRead(params.range);
    case "add":
      return executeAdd(params.range, requireContent(params.content, "add"));
    case "update":
      return executeUpdate(params.range, requireContent(params.content, "update"));
    case "reply":
      return executeReply(params.range, requireContent(params.content, "reply"));
    case "delete":
      return executeDelete(params.range);
    case "resolve":
      return executeSetResolved(params.range, true);
    case "reopen":
      return executeSetResolved(params.range, false);
  }
}

// ── Action implementations ───────────────────────────────────────────

async function executeRead(ref: string): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    range.load("address");
    sheet.load("name");

    const commentsCol = sheet.comments;
    commentsCol.load("items");
    await context.sync();

    if (commentsCol.items.length === 0) {
      return {
        sheetName: sheet.name,
        address: range.address,
        comments: [] as CommentData[],
      };
    }

    // Phase 2: load each comment's properties, location, and replies
    const entries = commentsCol.items.map((comment) => {
      comment.load("content,authorName,resolved");
      comment.replies.load("items");
      const location = comment.getLocation();
      location.load("address");
      return { comment, location };
    });
    await context.sync();

    // Phase 3: load reply details (only if replies exist)
    let needsSync = false;
    for (const { comment } of entries) {
      for (const reply of comment.replies.items) {
        reply.load("content,authorName");
        needsSync = true;
      }
    }
    if (needsSync) {
      await context.sync();
    }

    // Filter comments to those within the requested range
    const rangeAddr = range.address;
    const comments: CommentData[] = [];
    for (const { comment, location } of entries) {
      const locCell = stripSheet(location.address);
      if (isCellInRange(locCell, rangeAddr)) {
        const replies: ReplyData[] = comment.replies.items.map((reply) => ({
          author: reply.authorName,
          content: reply.content,
        }));
        comments.push({
          cell: locCell,
          content: comment.content,
          author: comment.authorName,
          resolved: comment.resolved,
          replies,
        });
      }
    }

    return { sheetName: sheet.name, address: range.address, comments };
  });

  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  if (result.comments.length === 0) {
    return `No comments in **${fullAddr}**.`;
  }

  const lines: string[] = [
    `**${fullAddr}** — ${result.comments.length} comment${result.comments.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const c of result.comments) {
    const resolved = c.resolved ? " ✓" : "";
    lines.push(`- **${c.cell}**: "${c.content}" — *${c.author}*${resolved}`);
    for (const r of c.replies) {
      lines.push(`  ↳ *${r.author}*: "${r.content}"`);
    }
  }

  return lines.join("\n");
}

async function executeAdd(ref: string, content: string): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address");
    sheet.comments.add(range, content);
    await context.sync();
    return { sheetName: sheet.name, address: range.address };
  });
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  return `Added comment to **${fullAddr}**: "${content}"`;
}

async function executeUpdate(ref: string, content: string): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address");
    const comment = sheet.comments.getItemByCell(range);
    comment.content = content;
    await context.sync();
    return { sheetName: sheet.name, address: range.address };
  });
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  return `Updated comment on **${fullAddr}**: "${content}"`;
}

async function executeReply(ref: string, content: string): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address");
    const comment = sheet.comments.getItemByCell(range);
    comment.replies.add(content);
    await context.sync();
    return { sheetName: sheet.name, address: range.address };
  });
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  return `Added reply to comment on **${fullAddr}**: "${content}"`;
}

async function executeDelete(ref: string): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address");
    const comment = sheet.comments.getItemByCell(range);
    const replyCount = comment.replies.getCount();
    await context.sync();
    const replies = replyCount.value;
    comment.delete();
    await context.sync();
    return { sheetName: sheet.name, address: range.address, replies };
  });
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  const replySuffix = result.replies > 0 ? ` (and ${result.replies} ${result.replies === 1 ? "reply" : "replies"})` : "";
  return `Deleted comment from **${fullAddr}**${replySuffix}.`;
}

async function executeSetResolved(ref: string, resolved: boolean): Promise<string> {
  const result = await excelRun(async (context) => {
    const { sheet, range } = getRange(context, ref);
    sheet.load("name");
    range.load("address");
    const comment = sheet.comments.getItemByCell(range);
    comment.resolved = resolved;
    await context.sync();
    return { sheetName: sheet.name, address: range.address };
  });
  const fullAddr = qualifiedAddress(result.sheetName, result.address);
  const verb = resolved ? "Resolved" : "Reopened";
  return `${verb} comment thread on **${fullAddr}**.`;
}
