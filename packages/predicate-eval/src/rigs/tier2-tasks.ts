import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import type { Tier2Task } from '../tier2-types.js';

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

/** Replay all episodes, materialize, and emit one drafting task per question. */
export async function buildTier2Tasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
): Promise<Tier2Task[]> {
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(schema, 'kg:tbox');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  await seedProvenance(client);
  await rematerialize(client, true);

  // Sample real subject IRIs so the prompt can teach the model the name→IRI mapping
  // (the IRI scheme, not the answers — subjects are individuals, not the queried results).
  const sample = await client.select(
    'SELECT DISTINCT ?s WHERE { GRAPH <kg:abox> { ?s ?p ?o } FILTER(isIRI(?s)) } LIMIT 10',
  );
  const exampleIndividuals = sample.results.bindings.map((b) => `<${b.s!.value}>`);

  return questions.map((q) => ({
    id: q.id,
    domain,
    questionText: q.text,
    type: q.type,
    schema,
    graphsHint: 'kg:abox, kg:inferred',
    exampleIndividuals,
  }));
}
