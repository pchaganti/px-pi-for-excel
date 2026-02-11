import type { AgentMessage } from "@mariozechner/pi-agent-core";

interface ToolResultShapingConfig {
  recentToolResultsToKeep: number;
  maxCharsBeforeCompaction: number;
  previewChars: number;
}

export const DEFAULT_TOOL_RESULT_SHAPING: Readonly<ToolResultShapingConfig> = {
  // Keep recent tool outputs fully intact so immediate follow-up reasoning stays high quality.
  recentToolResultsToKeep: 6,
  // Older tool results above this size are compacted for model-facing context.
  maxCharsBeforeCompaction: 1200,
  // Keep a short deterministic preview for grounding.
  previewChars: 500,
};

type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>;

type TextBlock = Extract<ToolResultMessage["content"][number], { type: "text" }>;
type ImageBlock = Extract<ToolResultMessage["content"][number], { type: "image" }>;

function isToolResultMessage(message: AgentMessage): message is ToolResultMessage {
  return message.role === "toolResult";
}

function isTextBlock(block: ToolResultMessage["content"][number]): block is TextBlock {
  return block.type === "text";
}

function isImageBlock(block: ToolResultMessage["content"][number]): block is ImageBlock {
  return block.type === "image";
}

function clampPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : fallback;
}

function normalizeConfig(config: Partial<ToolResultShapingConfig> | undefined): ToolResultShapingConfig {
  return {
    recentToolResultsToKeep: clampPositiveInteger(
      config?.recentToolResultsToKeep ?? DEFAULT_TOOL_RESULT_SHAPING.recentToolResultsToKeep,
      DEFAULT_TOOL_RESULT_SHAPING.recentToolResultsToKeep,
    ),
    maxCharsBeforeCompaction: clampPositiveInteger(
      config?.maxCharsBeforeCompaction ?? DEFAULT_TOOL_RESULT_SHAPING.maxCharsBeforeCompaction,
      DEFAULT_TOOL_RESULT_SHAPING.maxCharsBeforeCompaction,
    ),
    previewChars: clampPositiveInteger(
      config?.previewChars ?? DEFAULT_TOOL_RESULT_SHAPING.previewChars,
      DEFAULT_TOOL_RESULT_SHAPING.previewChars,
    ),
  };
}

function collectToolResultIndices(messages: readonly AgentMessage[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].role === "toolResult") {
      indices.push(i);
    }
  }
  return indices;
}

function buildRecentIndexSet(indices: readonly number[], keep: number): Set<number> {
  if (indices.length <= keep) return new Set<number>(indices);
  return new Set<number>(indices.slice(indices.length - keep));
}

function summarizeToolResult(
  message: ToolResultMessage,
  previewChars: number,
): TextBlock {
  let textPayload = "";
  let imageCount = 0;

  for (const block of message.content) {
    if (isTextBlock(block)) {
      if (textPayload.length > 0) textPayload += "\n";
      textPayload += block.text;
      continue;
    }

    if (isImageBlock(block)) {
      imageCount += 1;
    }
  }

  const originalChars = textPayload.length;
  const previewSource = textPayload.trim();
  const preview = previewSource.slice(0, previewChars);
  const previewWasTruncated = preview.length < previewSource.length;

  const lines: string[] = [];
  lines.push(`[Compacted tool result] ${message.toolName}${message.isError ? " (error)" : ""}`);

  const sourceParts: string[] = [];
  sourceParts.push(`${originalChars.toLocaleString()} text chars`);
  if (imageCount > 0) {
    sourceParts.push(`${imageCount} image block${imageCount === 1 ? "" : "s"}`);
  }
  lines.push(`Original payload: ${sourceParts.join(", ")}.`);

  if (preview.length > 0) {
    lines.push("Preview:");
    lines.push(preview + (previewWasTruncated ? "…" : ""));
  } else {
    lines.push("Preview: (no text payload)");
  }

  lines.push("Full output remains visible in chat history; this compact version is model-facing only.");

  return {
    type: "text",
    text: lines.join("\n\n"),
  };
}

function shouldCompactToolResult(
  message: ToolResultMessage,
  maxCharsBeforeCompaction: number,
): boolean {
  let textChars = 0;
  let hasImage = false;

  for (const block of message.content) {
    if (isTextBlock(block)) {
      textChars += block.text.length;
      if (textChars > maxCharsBeforeCompaction) return true;
      continue;
    }

    if (isImageBlock(block)) {
      hasImage = true;
    }
  }

  if (hasImage) return true;
  return false;
}

export function shapeToolResultsForLlm(
  messages: AgentMessage[],
  config?: Partial<ToolResultShapingConfig>,
): AgentMessage[] {
  const resolvedConfig = normalizeConfig(config);
  const toolResultIndices = collectToolResultIndices(messages);
  if (toolResultIndices.length === 0) return messages;

  const recentSet = buildRecentIndexSet(toolResultIndices, resolvedConfig.recentToolResultsToKeep);

  return messages.map((message, index) => {
    if (!isToolResultMessage(message)) return message;
    if (recentSet.has(index)) return message;

    if (!shouldCompactToolResult(message, resolvedConfig.maxCharsBeforeCompaction)) {
      return message;
    }

    return {
      ...message,
      content: [summarizeToolResult(message, resolvedConfig.previewChars)],
    };
  });
}
