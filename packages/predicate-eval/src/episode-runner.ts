import { readFileSync } from 'node:fs';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

export interface EpisodeTriple { s: string; p: string; o: string; }

export function readEpisode(path: string): EpisodeTriple[] {
  return readFileSync(path, 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l) as EpisodeTriple);
}

function toNTriples(triples: EpisodeTriple[]): string {
  return triples.map((t) => `<${t.s}> <${t.p}> <${t.o}> .`).join('\n');
}

export async function applyEpisodeTriples(
  client: StorageAdapter, triples: EpisodeTriple[],
): Promise<void> {
  if (triples.length === 0) return;
  await client.loadTurtle(toNTriples(triples), 'kg:abox');
}

/** Returns the materialize elapsed time in ms (0 for the control path). */
export async function rematerialize(client: StorageAdapter, inference: boolean): Promise<number> {
  if (!inference) {
    await client.update('DROP SILENT GRAPH <kg:inferred>');
    await client.update('CREATE SILENT GRAPH <kg:inferred>');
    return 0;
  }
  const res = await new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });
  return res.elapsedMs;
}
