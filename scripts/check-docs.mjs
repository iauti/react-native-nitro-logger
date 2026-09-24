import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const readme = read("README.md");
// npm does not ship the repository's docs; link back to the source repository.
const published = readme.replace(
  /\]\((?!https?:|#)([^)]+)\)/g,
  (_, path) =>
    `](https://github.com/iauti/react-native-nitro-logger/blob/main/${path})`,
);
const packageReadme = "packages/react-native-nitro-logger/README.md";
if (process.argv.includes("--sync"))
  writeFileSync(join(root, packageReadme), published);
assert.equal(
  read(packageReadme),
  published,
  "Package README is stale: run bun run docs:sync",
);
const documents = [
  "README.md",
  ...readdirSync(join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];
const scratch = mkdtempSync(join(tmpdir(), "logger-docs-"));
const snippets = [];
try {
  for (const document of documents) {
    const markdown = read(document);
    for (const [, target] of markdown.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(target)) continue;
      const path = target.split("#")[0];
      assert(
        existsSync(resolve(root, dirname(document), path)),
        `${document}: missing link ${target}`,
      );
    }
    let index = 0;
    for (const [, source] of markdown.matchAll(/```ts\n([\s\S]*?)```/g)) {
      const file = join(
        scratch,
        `${document.replaceAll("/", "-")}-${++index}.ts`,
      );
      writeFileSync(file, source);
      snippets.push(file);
    }
  }
  const program = ts.createProgram(snippets, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force,
    strict: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    types: [],
    paths: {
      "react-native-nitro-loggerkit": [
        join(root, "packages/react-native-nitro-logger/src/index.ts"),
      ],
      "react-native-nitro-loggerkit/*": [
        join(root, "packages/react-native-nitro-logger/src/*.ts"),
      ],
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
    process.exitCode = 1;
  } else
    console.log(
      `Docs verified: ${documents.length} Markdown files, ${snippets.length} TypeScript examples, local file links, package README.`,
    );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
