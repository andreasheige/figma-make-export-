# figma-make-export

Get a [Figma Make](https://figma.com/make) project's source onto disk without
copy-pasting files, for when Figma's own **Download code** button is
unavailable (Viewer seat) or broken (known blank-ZIP bug).

Works by reading the `code_snapshot` response the Make editor already fetched
into your own browser session. Nothing leaves your machine, and no
credentials are involved beyond the session you're already logged into.

Ships as a [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills),
but the scripts work standalone.

## Install as a skill

```sh
git clone git@github.com:andreasheige/figma-make-export-.git
ln -s "$PWD/figma-make-export-/figma-make-export" ~/.claude/skills/figma-make-export
```

Then ask Claude Code to export a Figma Make file and the skill loads itself.

## Use standalone

1. Open the Make file, switch to the **code view**, reload the page.
2. Open DevTools console, type `allow pasting` + Enter, then paste
   [`figma-make-export/scripts/extract.js`](figma-make-export/scripts/extract.js).
   It saves `<slug>-export.json` to `~/Downloads`.
3. Unpack and verify:

```sh
S=figma-make-export/scripts
node $S/unpack.mjs ~/Downloads/<slug>-export.json ../my-project
node $S/check-imports.mjs ../my-project   # every import resolve?
node $S/scaffold.mjs ../my-project        # add the host shell Figma keeps
cd ../my-project && pnpm install && pnpm dev
```

## Layout

```
README.md                              this file
figma-make-export/                     the skill - symlink this into ~/.claude/skills/
├── SKILL.md
└── scripts/
    ├── extract.js                     browser console snippet
    ├── unpack.mjs                     export JSON -> directory tree
    ├── check-imports.mjs              completeness check
    └── scaffold.mjs                   add the host shell so it runs locally
```

## Limits

- **Text files only.** Binary assets (images, fonts) are not extracted; they
  show up as unresolved imports from `check-imports.mjs`. `scaffold.mjs` writes
  1x1 placeholders so the build resolves and lists each one - replace them by
  saving the real asset from Figma's file explorer.
- **No entry point** in the snapshot. Figma builds Make projects as a library
  its sandbox page mounts, so `index.html` and the React entry were never part
  of your project. `scaffold.mjs` writes them, converts the library build to an
  app build, and clears two traps that otherwise break a local run: Figma pins
  `supportedArchitectures` to linux/glibc, and native postinstalls must be
  allowed or `pnpm build` refuses to start.
- **The seat gate is server-side.** If you can't read file contents in the
  code view, they never reach your browser and no script can recover them.
  That needs a seat change in Figma org admin.
- **`curl` and the public REST API are dead ends** - there is no public Make
  endpoint.

## License

MIT - see [LICENSE](LICENSE).
