import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readEpisode, type EpisodeTriple } from '../episode-runner.js';

/** All episode triples of a fixture, in episode-file order (e01, e02, ...). */
export function readAllEpisodes(dir: string): EpisodeTriple[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .flatMap((f) => readEpisode(join(dir, 'episodes', f)));
}

/** First-seen-order, deduplicated (s, p) -> objects index over asserted triples. */
export class TripleIndex {
  private byKey = new Map<string, string[]>();
  private subjectList: string[] = [];
  readonly triples: number;

  constructor(triples: EpisodeTriple[]) {
    this.triples = triples.length;
    const seenSubjects = new Set<string>();
    for (const t of triples) {
      if (!seenSubjects.has(t.s)) { seenSubjects.add(t.s); this.subjectList.push(t.s); }
      const k = `${t.s} ${t.p}`;
      const vs = this.byKey.get(k);
      if (vs) { if (!vs.includes(t.o)) vs.push(t.o); }
      else this.byKey.set(k, [t.o]);
    }
  }

  /** Distinct objects of (s, p) in assertion order. */
  values(s: string, p: string): string[] { return this.byKey.get(`${s} ${p}`) ?? []; }

  /** Distinct subjects in first-assertion order. */
  subjects(): string[] { return this.subjectList; }
}
