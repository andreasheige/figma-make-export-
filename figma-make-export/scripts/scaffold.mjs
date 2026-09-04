#!/usr/bin/env node
// Add the host shell Figma Make keeps in its sandbox, so an extracted project
// runs locally. Figma builds Make projects as a library its own page mounts -
// index.html, the React entry and an app-mode vite config were never yours.
//
// Also writes 1x1 placeholders for image imports that a text-only extraction
// dropped, so the build resolves. Replace them with the real assets.
//
// usage: node scaffold.mjs <project-dir>
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
         statSync, copyFileSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node scaffold.mjs <project-dir>");
  process.exit(1);
}
const at = (...p) => join(root, ...p);
const done = [];
const skip = [];

const write = (rel, body) => {
  if (existsSync(at(rel))) return skip.push(`${rel} (exists)`);
  mkdirSync(dirname(at(rel)), { recursive: true });
  writeFileSync(at(rel), body);
  done.push(rel);
};

// --- locate the app root component and the CSS entry -----------------------
const APP = ["src/app/App.tsx", "src/App.tsx", "src/app/app.tsx"]
  .find((p) => existsSync(at(p)));
if (!APP) {
  console.error("no App component found (looked for src/app/App.tsx, src/App.tsx)");
  process.exit(1);
}
const CSS = ["src/styles/index.css", "src/index.css", "src/styles/globals.css"]
  .find((p) => existsSync(at(p)));

const appSpec = "./" + relative("src", APP).replace(/\.tsx?$/, "");
const cssSpec = CSS ? "./" + relative("src", CSS) : null;

// --- index.html + React entry ----------------------------------------------
const title = (() => {
  try { return JSON.parse(readFileSync(at("package.json"), "utf8")).name || "App"; }
  catch { return "App"; }
})();

write("index.html", `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

write("src/main.tsx", `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "${appSpec}";
${cssSpec ? `import "${cssSpec}";\n` : ""}
const root = document.getElementById("root");
if (!root) throw new Error("#root not found in index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`);

// --- vite config: library build -> app build --------------------------------
if (existsSync(at("vite.config.ts")) && !existsSync(at("vite.config.lib.ts"))) {
  copyFileSync(at("vite.config.ts"), at("vite.config.lib.ts"));
  writeFileSync(at("vite.config.ts"), `import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// App build. The original Figma library config is kept as vite.config.lib.ts.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
`);
  done.push("vite.config.ts (lib config saved as vite.config.lib.ts)");
} else {
  skip.push("vite.config.ts (already converted or absent)");
}

// --- package.json: real deps and scripts, drop library-only bits ------------
if (existsSync(at("package.json"))) {
  const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
  const react_ = pkg.peerDependencies?.react || "18.3.1";
  const dom = pkg.peerDependencies?.["react-dom"] || "18.3.1";
  pkg.scripts = { ...pkg.scripts, dev: "vite", build: "vite build", preview: "vite preview" };
  pkg.dependencies = { ...pkg.dependencies, react: react_, "react-dom": dom };
  pkg.devDependencies = { ...pkg.devDependencies };
  delete pkg.devDependencies["vite-plugin-dts"];
  delete pkg.peerDependencies;
  delete pkg.peerDependenciesMeta;
  delete pkg.pnpm; // pnpm>=10 ignores this key and warns
  writeFileSync(at("package.json"), JSON.stringify(pkg, null, 2) + "\n");
  done.push("package.json (react deps, dev/build/preview scripts)");
}

// --- pnpm-workspace.yaml: Figma pins linux/glibc, which breaks locally ------
if (existsSync(at("pnpm-workspace.yaml"))) {
  writeFileSync(at("pnpm-workspace.yaml"), `packages:
  - '.'
# Figma pins supportedArchitectures to linux/glibc for its sandbox; dropped.
# Native postinstalls must be allowed or 'pnpm build' refuses to run.
# pnpm >= 11 spelling:
allowBuilds:
  '@tailwindcss/oxide': true
  esbuild: true
# pnpm 10 spelling:
onlyBuiltDependencies:
  - '@tailwindcss/oxide'
  - esbuild
`);
  done.push("pnpm-workspace.yaml (linux-only pins dropped, native builds allowed)");
}

// --- placeholders for image imports the text extraction dropped -------------
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const walk = (d, acc = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p);
  }
  return acc;
};
const IMG = /\.(png|jpe?g|gif|webp)$/i;
const placeholders = [];
for (const file of walk(at("src"))) {
  const text = readFileSync(file, "utf8");
  for (const [, spec] of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    if (!IMG.test(spec)) continue;
    const target = spec.startsWith("@/")
      ? at("src", spec.slice(2))
      : normalize(join(dirname(file), spec));
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, PNG_1X1);
    placeholders.push(relative(root, target));
  }
}

console.log("added:");
for (const d of done) console.log(`  + ${d}`);
if (skip.length) {
  console.log("skipped:");
  for (const s of skip) console.log(`  - ${s}`);
}
if (placeholders.length) {
  console.log(`\n${placeholders.length} placeholder image(s) written - REPLACE THESE:`);
  for (const p of placeholders) console.log(`  ! ${p}`);
}
console.log(`\nnext: cd ${root} && pnpm install && pnpm dev`);
