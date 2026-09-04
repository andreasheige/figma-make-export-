// Figma Make -> JSON export.
// Paste into the DevTools console on an open figma.com/make/<key>/... file.
// Prereqs: be logged in, and open the CODE VIEW at least once so the
// code_snapshot request lands in the performance buffer. Reload if unsure.
//
// Read-only against Figma: one same-origin GET to a URL the page already
// fetched, then a local Blob download. No writes, no third-party hosts.
(async () => {
  const snap = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .reverse() // newest revision wins
    .find((u) => /\/api\/rev\/[^/]+\/code_snapshot\//.test(u));

  if (!snap) {
    return 'No code_snapshot request found. Open the code view, reload the page, then re-run.';
  }

  const res = await fetch(snap, { credentials: 'include' });
  const raw = await res.text();
  if (!res.ok) return `HTTP ${res.status}: ${raw.slice(0, 300)}`;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return `Not JSON (${raw.length} bytes). Head: ${raw.slice(0, 300)}`;
  }

  const FILE_RE = /\.(tsx?|jsx?|mjs|cjs|css|scss|html?|json|md|svg|txt|ya?ml|lock)$/i;
  const isPath = (s) => typeof s === 'string' && s.length < 300 && FILE_RE.test(s);
  const files = {};

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);

    // shape A: { path: "src/App.tsx", content: "..." }
    const pk = ['path', 'name', 'filename', 'fileName', 'filePath', 'file'].find((k) =>
      isPath(node[k]),
    );
    const bk = ['content', 'contents', 'code', 'source', 'text', 'body'].find(
      (k) => typeof node[k] === 'string',
    );
    if (pk && bk) files[node[pk]] = node[bk];

    // shape B: { "src/App.tsx": "..." }
    for (const [k, v] of Object.entries(node)) {
      if (isPath(k) && typeof v === 'string') files[k] = v;
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(data);

  const paths = Object.keys(files).sort();
  if (!paths.length) {
    console.log('Top-level keys:', Object.keys(data));
    console.log('Head:', raw.slice(0, 1500));
    return 'No files matched. Report the two lines above so the walk can be adjusted.';
  }
  console.log(`${paths.length} files:\n${paths.join('\n')}`);

  const slug =
    (location.pathname.match(/\/make\/[^/]+\/([^/?#]+)/)?.[1] || 'figma-make')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-export.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  return `Saved ${a.download} - ${paths.length} files, ${(blob.size / 1024).toFixed(0)} KB`;
})();
