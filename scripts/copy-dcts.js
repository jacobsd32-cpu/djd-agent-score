#!/usr/bin/env node
/**
 * Copies each .d.ts file in dist/types/ to a .d.cts counterpart.
 * The .d.cts files are referenced in package.json exports for `require`.
 */
import { readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist", "types");

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".d.ts")) continue;
  const src = join(dir, file);
  const dest = join(dir, file.replace(/\.d\.ts$/, ".d.cts"));
  copyFileSync(src, dest);
}

console.log(".d.cts files created");
