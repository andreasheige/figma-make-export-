#!/usr/bin/env node
// Completeness check: does every local/aliased import in the extracted tree
// resolve to a file on disk? Anything unresolved was dropped by the extractor
// (binary assets) or was never in the snapshot (Figma-generated entry points).
// usage: node check-imports.mjs <project-dir>
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node check-imports.mjs <project-dir>");
  process.exit(1);
}

const walkDir = (d, acc = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walkDir(p, acc);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e)) acc.push(p);
  }
  return acc;
};

const srcDir = join(root, "src");
const sources = walkDir(existsSync(srcDir) ? srcDir : root);
const SPEC = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".css", ".svg", ".md",
              "/index.ts", "/index.tsx"];

const resolves = (file, spec) => {
  let cand;
  if (spec.startsWith("@/")) cand = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) cand = normalize(join(dirname(file), spec));
  else return true; // bare package specifier - npm's problem, not ours
  return EXTS.some((e) => existsSync(cand + e));
};

const missing = new Map();
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  for (const [, spec] of text.matchAll(SPEC)) {
    if (!resolves(file, spec)) {
      if (!missing.has(spec)) missing.set(spec, []);
      missing.get(spec).push(file);
    }
  }
}

console.log(`scanned ${sources.length} source files`);
if (!missing.size) {
  console.log("all local imports resolve");
  process.exit(0);
}
console.log(`\n${missing.size} unresolved:`);
for (const [spec, files] of [...missing].sort()) {
  console.log(`  ${spec}`);
  for (const f of [...new Set(files)].slice(0, 3)) console.log(`      <- ${f}`);
}
process.exit(1);
