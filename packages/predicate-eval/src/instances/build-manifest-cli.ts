/**
 * Build the instance-level benchmark manifest for one or more fixture domains.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval exec tsx src/instances/build-manifest-cli.ts conflict-xr-small
 *
 * Writes fixtures/<domain>/instances.json (pretty-printed, deterministic
 * ordering — safe to commit as a DERIVED file next to the frozen fixture).
 * No storage backend is touched; this is a pure oracle.json transform.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInstanceManifest } from './manifest.js';

function main(domains: string[]): void {
  if (domains.length === 0) {
    console.error('usage: tsx src/instances/build-manifest-cli.ts <domain> [<domain>...]');
    process.exit(1);
  }
  for (const domain of domains) {
    const dir = join(import.meta.dirname, '..', '..', 'fixtures', domain);
    const instances = buildInstanceManifest(dir);
    const out = join(dir, 'instances.json');
    writeFileSync(out, JSON.stringify(instances, null, 2) + '\n');
    const byKind = new Map<string, number>();
    for (const i of instances) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
    const kinds = [...byKind.entries()].map(([k, n]) => `${k}=${n}`).join(' ');
    console.log(`${domain}: wrote ${instances.length} instances (${kinds}) to ${out}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
