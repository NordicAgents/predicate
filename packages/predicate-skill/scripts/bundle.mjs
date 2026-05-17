#!/usr/bin/env node
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repoRoot = resolve(root, '..', '..');

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
  external: ['better-sqlite3'],
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
  external: ['better-sqlite3'],
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

console.log('built cli.bundle.mjs');
