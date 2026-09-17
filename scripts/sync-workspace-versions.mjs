import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Bun 1.3.14 preserves stale workspace versions on version-only manifest changes,
// even with --force. Update only those JSONC literals, preserving dependency pins.
const filename = "bun.lock";
const text = readFileSync(filename, "utf8");
const ast = ts.parseJsonText(filename, text);
if (ast.parseDiagnostics.length) throw new Error("Cannot parse bun.lock");
const root = ast.statements[0]?.expression;
const workspaces = root?.properties.find(
  (entry) => entry.name?.text === "workspaces",
)?.initializer;
if (!workspaces || !ts.isObjectLiteralExpression(workspaces))
  throw new Error("Missing lockfile workspaces");
const edits = [];
for (const workspace of workspaces.properties) {
  const directory = workspace.name.text;
  const version = workspace.initializer.properties.find(
    (entry) => entry.name?.text === "version",
  )?.initializer;
  if (!version) continue;
  const manifest = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  if (typeof manifest.version !== "string")
    throw new Error(`Missing version in ${directory}`);
  if (version.text !== manifest.version)
    edits.push({
      start: version.getStart(ast),
      end: version.end,
      value: JSON.stringify(manifest.version),
    });
}
let result = text;
for (const edit of edits.sort((a, b) => b.start - a.start))
  result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
if (result !== text) writeFileSync(filename, result);
