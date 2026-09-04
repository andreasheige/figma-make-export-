---
name: figma-make-export
description: Export a Figma Make project's full source to disk without copy-pasting files. Use when someone wants to download, extract, export, clone, or "get the code out of" a figma.com/make/... prototype - especially when Figma's own "Download code" button is missing (seat restriction) or produces a blank ZIP.
---

# Export a Figma Make project to disk

Figma Make holds a real source tree, but the only supported way out is a
**Download code** button in the code editor's top-right, gated behind a Full
or Dev seat. On a Viewer seat it's absent, and it has a known blank-ZIP bug.

This skill recovers the tree from the page's own `code_snapshot` API response.

## Layout

```
SKILL.md                     this file
scripts/extract.js           browser console snippet
scripts/unpack.mjs           export JSON -> directory tree
scripts/check-imports.mjs    completeness check
```

Paths below assume the skill is installed at
`~/.claude/skills/figma-make-export`. If it was cloned elsewhere, resolve
`scripts/` relative to this file instead.

## What will not work

- **`curl` / the public REST API.** Figma's public API has no Make endpoint.
  The data only exists behind internal `/api/rev/.../code_snapshot/<hash>`
  calls needing session cookies. Don't burn time here.
- **Any client-side approach, if the user cannot see the code in the code
  view.** The seat gate is enforced server-side: file contents are never sent
  to a Viewer-seat browser, so there is nothing in the page to extract. Check
  this first - if they can't read a file's source in the code view, the only
  fix is a seat change in Figma org admin.

## Preflight

1. **Confirm the "Download code" button really is absent.** It's in the *code
   editor* panel, not the main preview toolbar. Most reports of a missing
   button are someone looking at the preview.
2. **Confirm the user can read file contents in the code view.** If not, stop -
   see above.
3. **The user must run the console snippet themselves.** Browser automation
   tooling typically attaches to a different Chrome profile than the one the
   user is logged into; cookies are per-profile, so an automated tab will hit
   the login wall. Verify with `document.cookie` before assuming otherwise.
   Don't try to log in on their behalf.

## Steps

**1. Extract.** Have the user open the Make file, switch to the code view,
reload, then paste `scripts/extract.js` into the DevTools console.

DevTools blocks pasting until they type `allow pasting` + Enter - both words.

Explain what the script does before they run it; Chrome's paste warning is
legitimate and applies to agent-supplied code too. It auto-discovers the
`code_snapshot` URL from `performance.getEntriesByType('resource')`, so
nothing is hardcoded per-file. It saves `<slug>-export.json` (a flat
`{path: contents}` map) to `~/Downloads`.

If it reports no `code_snapshot` request, the code view was never opened or
the buffer rolled over - reload and retry. If it reports "No files matched",
it prints the response's top-level keys; adjust `walk()` to the real shape.

**2. Unpack.**

```sh
node ~/.claude/skills/figma-make-export/scripts/unpack.mjs ~/Downloads/<slug>-export.json <target-dir>
```

Unpack **outside** any existing repo unless asked otherwise. Refuses paths
escaping the target - the paths come from a remote response.

**3. Verify completeness - do not skip.**

```sh
node ~/.claude/skills/figma-make-export/scripts/check-imports.mjs <target-dir>
```

Parses every import specifier and checks it resolves on disk. Exits non-zero
if anything is unresolved. Report unresolved specifiers honestly rather than
claiming a clean export.

## Known gaps, expected in every export

The extractor collects **text files only**, matched by extension. Expect:

- **Binary assets missing** (`.png`, `.jpg`, fonts). They surface as
  unresolved imports in step 3. Easiest fix: click the asset in Figma's file
  explorer, right-click the preview, Save image as. Automating one image is
  slower than saving it.
- **No entry point.** `index.html`, `src/main.tsx` and the `src/index.ts` that
  `vite.config.ts` names as its lib entry are supplied by Figma's sandbox and
  are not in the snapshot. **The project will not `pnpm dev` as extracted.**
  Say so plainly; offer to scaffold, don't assume.

## Alternative worth mentioning

Figma Make can push to GitHub: **Make settings** (upper-right) -> **GitHub**
-> **Create Repository**. Flag before using it: the connection is
**team/org-wide**, not per-user - everyone with Make access can then create
and push repos, and one Figma org binds to only one GitHub account.
