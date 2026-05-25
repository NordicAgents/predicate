#!/usr/bin/env node
import { build } from 'esbuild';
import { chmodSync, cpSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repoRoot = resolve(root, '..', '..');
const require = createRequire(import.meta.url);

// The version users actually installed = predicate-skill's package.json.
// Injected into the CLI bundle so `predicate --version` reports it.
const pkgVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const versionDefine = { __PREDICATE_VERSION__: JSON.stringify(pkgVersion) };

// Copy the ontology catalog + meta into predicate-skill so that
// `predicate init --mode community` works when the package is installed
// globally (the npm install dir has no access to the monorepo's
// predicate-ontology package).
for (const sub of ['catalog', 'meta']) {
  const src = resolve(repoRoot, 'packages/predicate-ontology', sub);
  const dst = resolve(root, sub);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  console.log(`staged ${sub}/ from predicate-ontology`);
}

// Vendor the Oxigraph WASM package into the plugin. The Claude Code
// marketplace install copies the plugin dir verbatim and never runs
// `npm install`, so an externalized bare `import "oxigraph"` would fail
// with ERR_MODULE_NOT_FOUND. We ship oxigraph's Node build inside the
// package and rewrite the import to a relative path (see the esbuild
// plugin below). Only node.js + node_bg.wasm are needed at runtime; the
// vendored package.json (no "type" field) keeps node.js as CommonJS even
// though predicate-skill is "type":"module". The browser build
// (web_bg.wasm, ~4 MB) is intentionally skipped.
const oxiDir = dirname(
  require.resolve('oxigraph/package.json', {
    paths: [resolve(repoRoot, 'packages/predicate-mcp')],
  }),
);
const vendorDir = resolve(root, 'vendor/oxigraph');
rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
for (const f of ['node.js', 'node.d.ts', 'node_bg.wasm', 'package.json']) {
  cpSync(resolve(oxiDir, f), resolve(vendorDir, f));
}
console.log('vendored oxigraph (node build) into vendor/oxigraph/');

// Rewrite `import ... from "oxigraph"` to the vendored relative path and
// keep it external so node.js loads node_bg.wasm by __dirname at runtime.
const vendorOxigraph = {
  name: 'vendor-oxigraph',
  setup(b) {
    b.onResolve({ filter: /^oxigraph$/ }, () => ({
      path: './vendor/oxigraph/node.js',
      external: true,
    }));
  },
};

const stripShebang = {
  name: 'strip-shebang',
  setup(b) {
    b.onLoad({ filter: /\.ts$/ }, async (args) => {
      const fs = await import('node:fs/promises');
      let contents = await fs.readFile(args.path, 'utf8');
      if (contents.startsWith('#!')) contents = contents.replace(/^#![^\n]*\n/, '');
      return { contents, loader: 'ts' };
    });
  },
};

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire } from "node:module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n') + '\n',
  },
  minify: false,
  sourcemap: false,
  define: versionDefine,
  external: ['better-sqlite3'],
  plugins: [vendorOxigraph, stripShebang],
};

// Regenerate per-platform adapters from canonical sources and fail if the
// committed copies are stale (prevents the adapters from silently rotting).
// The drift check needs git + a working tree; when neither is available
// (e.g. a tarball-extracted publish container) we regenerate but skip the
// staleness check rather than crash the build.
execFileSync('node', [resolve(here, 'gen-adapters.mjs')], { stdio: 'inherit' });
let dirty = null;
try {
  dirty = execFileSync('git', ['status', '--porcelain', '--',
    'AGENTS.md', '.codex-plugin', '.mcp.json'],
    { cwd: root, encoding: 'utf8' });
} catch {
  console.warn('git unavailable — skipping adapter drift check');
}
if (dirty !== null && dirty.trim()) {
  console.error('Generated adapters are stale. Run gen-adapters.mjs and commit:\n' + dirty);
  process.exit(1);
}
if (dirty !== null) console.log('adapters regenerated + verified in sync');

await build({
  ...common,
  entryPoints: [resolve(repoRoot, 'packages/predicate-mcp/src/index.ts')],
  outfile: resolve(root, 'server.bundle.mjs'),
});
chmodSync(resolve(root, 'server.bundle.mjs'), 0o755);
console.log('built server.bundle.mjs');

await build({
  ...common,
  entryPoints: [resolve(repoRoot, 'packages/predicate-cli/src/index.ts')],
  outfile: resolve(root, 'cli.bundle.mjs'),
});
chmodSync(resolve(root, 'cli.bundle.mjs'), 0o755);
console.log('built cli.bundle.mjs');
