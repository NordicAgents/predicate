import type { EpisodeTriple } from '../episode-runner.js';

/**
 * The simplest possible retrieval: from `seeds`, walk up to `hops` edges whose
 * predicate is in `rels`, returning the triples traversed. No embeddings, no
 * index — just a BFS over the raw facts. This is the cheap baseline that a
 * reasoning graph must beat to justify itself: it pulls the relevant
 * neighbourhood and ignores accumulated noise, so its size tracks the answer,
 * not the total fact count.
 */
export function neighborhood(
  triples: EpisodeTriple[], seeds: string[], rels: string[], hops: number,
): EpisodeTriple[] {
  const relSet = new Set(rels);
  // index subject -> outgoing triples for the relevant relations
  const bySubject = new Map<string, EpisodeTriple[]>();
  for (const t of triples) {
    if (!relSet.has(t.p)) continue;
    (bySubject.get(t.s) ?? bySubject.set(t.s, []).get(t.s)!).push(t);
  }
  const collected: EpisodeTriple[] = [];
  const seen = new Set<string>();
  let frontier = [...seeds];
  for (let h = 0; h < hops && frontier.length; h++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const t of bySubject.get(node) ?? []) {
        const key = `${t.s}|${t.p}|${t.o}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(t);
        next.push(t.o);
      }
    }
    frontier = next;
  }
  return collected;
}
