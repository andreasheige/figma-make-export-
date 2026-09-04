#!/usr/bin/env node
// Explode a Figma Make export JSON ({ "path": "contents" }) into a directory tree.
// usage: node unpack.mjs <export.json> <target-dir>
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const [src, target] = process.argv.slice(2);
if (!src || !target) {
  console.error("usage: node unpack.mjs <export.json> <target-dir>");
  process.exit(1);
}

const files = JSON.parse(readFileSync(src, "utf8"));
const root = resolve(target);
let written = 0;
let skipped = 0;

for (const [rawPath, contents] of Object.entries(files)) {
  const dest = resolve(root, rawPath.replace(/^\/+/, ""));
  // paths come from a remote response - refuse anything escaping the target
  if (dest !== root && !dest.startsWith(root + sep)) {
    console.error(`skipped (escapes target): ${rawPath}`);
    skipped++;
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents, "utf8");
  written++;
}

console.log(`wrote ${written} files to ${root}${skipped ? ` (${skipped} skipped)` : ""}`);
