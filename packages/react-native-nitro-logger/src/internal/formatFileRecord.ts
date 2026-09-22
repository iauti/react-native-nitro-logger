import type { LogRecord } from "../LogRecord.ts";

/** Escape controls and non-ASCII text, keeping one physical line and exact byte accounting. */
function escapeText(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

export function formatFileRecord(record: LogRecord): string {
  const category = record.attributes.category;
  const label =
    typeof category === "string" ? ` [${escapeText(category)}]` : "";
  const details = JSON.stringify({
    sequence: record.sequence,
    attributes: record.attributes,
  });
  const line = `${new Date(record.timestampMs).toISOString()} ${record.level.toUpperCase()}${label} ${escapeText(record.message)} ${details}`;
  return line;
}
