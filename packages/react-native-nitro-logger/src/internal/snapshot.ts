import type { Attributes, JsonValue, LogAttributes } from "../Attributes.ts";

const defaultKeys = [
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "clientsecret",
  "client_secret",
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
];

export function sensitiveKeys(extra: readonly string[]): ReadonlySet<string> {
  return new Set([...defaultKeys, ...extra].map((key) => key.toLowerCase()));
}

/** Bound retained text and nodes across the whole attribute tree. Never invoke toJSON/getters. */
export function snapshot(
  input: Attributes,
  redact: ReadonlySet<string>,
): LogAttributes {
  let remainingNodes = 256;
  let remainingChars = 16384;
  const seen = new WeakSet<object>();
  function text(value: string): string {
    const result = value.slice(0, Math.min(remainingChars, 4096));
    remainingChars -= result.length;
    return result.length === value.length ? result : result + "[truncated]";
  }
  function visit(value: unknown, depth: number): JsonValue {
    if (--remainingNodes < 0 || remainingChars <= 0) return "[truncated]";
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") return text(value);
    if (typeof value === "number")
      return Number.isFinite(value) ? value : String(value);
    if (typeof value !== "object")
      return typeof value === "bigint"
        ? text(String(value))
        : `[${typeof value}]`;
    if (seen.has(value)) return "[circular]";
    if (depth >= 6) return "[max-depth]";
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const result: JsonValue[] = [];
        for (let index = 0; index < Math.min(value.length, 64); index++) {
          if (remainingNodes <= 0 || remainingChars <= 0) {
            result.push("[truncated]");
            break;
          }
          const descriptor = Object.getOwnPropertyDescriptor(
            value,
            String(index),
          );
          result.push(
            descriptor && "value" in descriptor
              ? visit(descriptor.value, depth + 1)
              : "[accessor]",
          );
        }
        if (value.length > 64) result.push("[truncated]");
        return Object.freeze(result);
      }
      const result: Record<string, JsonValue> = Object.create(null);
      // for-in avoids allocating an unbounded keys/descriptor array for ordinary objects.
      let count = 0;
      const add = (key: string) => {
        if (key.length > 256) return;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) return;
        remainingChars -= key.length;
        result[key] = redact.has(key.toLowerCase())
          ? "[REDACTED]"
          : "value" in descriptor
            ? visit(descriptor.value, depth + 1)
            : "[accessor]";
      };
      if (value instanceof Error) {
        for (const key of ["name", "message", "stack", "cause"]) add(key);
      }
      for (const key in value) {
        if (++count > 64 || remainingNodes <= 0 || remainingChars <= 0) {
          result["[truncated]"] = true;
          break;
        }
        if (Object.prototype.hasOwnProperty.call(value, key)) add(key);
      }
      return Object.freeze(result);
    } finally {
      seen.delete(value);
    }
  }
  return visit(input, 0) as LogAttributes;
}
