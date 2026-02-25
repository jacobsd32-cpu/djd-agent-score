#!/usr/bin/env node
/**
 * Renames all .js files in dist/cjs/ to .cjs and rewrites internal
 * import paths so they reference .cjs instead of .js.
 */
import { readdirSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist", "cjs");

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".js")) continue;

  const oldPath = join(dir, file);
  const newPath = join(dir, file.replace(/\.js$/, ".cjs"));

  // Rewrite internal requires: ./foo.js → ./foo.cjs
  let content = readFileSync(oldPath, "utf8");
  content = content.replace(
    /require\("(\.\/[^"]+)\.js"\)/g,
    'require("$1.cjs")',
  );
  writeFileSync(oldPath, content, "utf8");

  renameSync(oldPath, newPath);
}

console.log("CJS files renamed to .cjs");
