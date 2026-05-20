#!/usr/bin/env node
import { build } from 'esbuild';
import { chmodSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repoRoot = resolve(root, '..', '..');

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

await build({
  entryPoints: [resolve(repoRoot, 'packages/predicate-mcp/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve(root, 'server.bundle.mjs'),
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
  external: ['better-sqlite3', 'oxigraph'],
  plugins: [
    {
      name: 'strip-shebang',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          const fs = await import('node:fs/promises');
          let contents = await fs.readFile(args.path, 'utf8');
          if (contents.startsWith('#!')) {
            contents = contents.replace(/^#![^\n]*\n/, '');
          }
          return { contents, loader: 'ts' };
        });
      },
    },
  ],
});

chmodSync(resolve(root, 'server.bundle.mjs'), 0o755);
console.log('built server.bundle.mjs');

await build({
  entryPoints: [resolve(repoRoot, 'packages/predicate-cli/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve(root, 'cli.bundle.mjs'),
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
  external: ['better-sqlite3', 'oxigraph'],
  plugins: [
    {
      name: 'strip-shebang',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          const fs = await import('node:fs/promises');
          let contents = await fs.readFile(args.path, 'utf8');
          if (contents.startsWith('#!')) {
            contents = contents.replace(/^#![^\n]*\n/, '');
          }
          return { contents, loader: 'ts' };
        });
      },
    },
  ],
});

chmodSync(resolve(root, 'cli.bundle.mjs'), 0o755);
console.log('built cli.bundle.mjs');
