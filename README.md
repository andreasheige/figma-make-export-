# figma-make-export

Get a [Figma Make](https://figma.com/make) project's source onto disk without
copy-pasting files, when Figma's own **Download code** button is unavailable
(Viewer seat) or broken (known blank-ZIP bug).

Works by reading the `code_snapshot` API response the Make editor already
fetched into your own browser session. Nothing leaves your machine.

## Usage

1. Open the Make file, switch to the **code view**, reload the page.
2. Open DevTools console, type `allow pasting` + Enter, paste
   [`extract.js`](extract.js). Saves `<slug>-export.json` to `~/Downloads`.
3. Unpack and verify:

```sh
node unpack.mjs ~/Downloads/<slug>-export.json ../my-project
node check-imports.mjs ../my-project
```

## Files

| File | Purpose |
|---|---|
| `extract.js` | Console snippet. Auto-discovers the snapshot URL, downloads a `{path: contents}` JSON. |
| `unpack.mjs` | Explodes that JSON into a directory tree. Rejects paths escaping the target. |
| `check-imports.mjs` | Verifies every local import resolves. Non-zero exit if not. |
| `SKILL.md` | Claude Code skill wrapping the above, incl. the failure modes. |

## Limits

- **Text files only.** Binary assets (images, fonts) are not extracted; they
  show up as unresolved imports from `check-imports.mjs`. Save those by hand
  from Figma's file explorer.
- **No entry point.** `index.html` / `src/main.tsx` / `src/index.ts` come from
  Figma's sandbox, not the snapshot, so the output won't run without
  scaffolding.
- **Seat gate is server-side.** If you can't read file contents in the code
  view, the data never reaches your browser and no script can recover it.
- `curl` and the public REST API are dead ends - there is no public Make
  endpoint.
