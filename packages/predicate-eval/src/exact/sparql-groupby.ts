import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { readdirSync } from 'node:fs';
import { TripleIndex, readAllEpisodes } from './triple-index.js';
import {
  RDF_TYPE, RDF_FIRST, RDF_REST, OWL_HASKEY, J_SINGLE_VALUED, type Detection,
} from './contract.js';
import type { ExactRunResult } from './key-join.js';

/**
 * Baseline 2 — sparql-groupby: load the fixture into the store (kg:tbox +
 * kg:abox, same episode plumbing as src/flat.ts), then run ONE aggregation
 * query per single-valued property:
 *
 *   GROUP BY key HAVING COUNT(DISTINCT value) > 1        (keyed classes, v2)
 *   GROUP BY subject HAVING COUNT(DISTINCT value) > 1    (no owl:hasKey, v1)
 *
 * No reasoner, no materialization, no provenance gate — the query engine does
 * the join directly on asserted triples. The single-valued property list and
 * the key property are themselves read from kg:tbox via SPARQL, so the whole
 * baseline is schema-driven. Witness triples are reconstructed from the
 * fixture's asserted triples (the same triples the query matched).
 */

const SEP = '\\t'; // SPARQL-escaped tab: never occurs in fixture IRIs/emails

interface KeyedClass { cls: string; keyProp: string }

async function loadFixture(client: StorageAdapter, dir: string): Promise<void> {
  for (const g of ['kg:tbox', 'kg:abox']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(readFileSync(join(dir, 'world.ttl'), 'utf8'), 'kg:tbox');
  const files = readdirSync(join(dir, 'episodes')).filter((f) => f.endsWith('.jsonl')).sort();
  for (const f of files) {
    await applyEpisodeTriples(client, readEpisode(join(dir, 'episodes', f)));
  }
}

async function schemaFromStore(client: StorageAdapter): Promise<{ svProps: string[]; keyed: KeyedClass[] }> {
  const sv = await client.select(
    `SELECT ?p WHERE { GRAPH <kg:tbox> { ?p a <${J_SINGLE_VALUED}> } }`,
  );
  const svProps = sv.results.bindings.map((b) => b.p!.value).sort();
  const hk = await client.select(`
    SELECT ?cls ?key WHERE { GRAPH <kg:tbox> {
      ?cls <${OWL_HASKEY}> ?list .
      ?list <${RDF_REST}>*/<${RDF_FIRST}> ?key .
    } }
  `);
  const keyed = hk.results.bindings
    .map((b) => ({ cls: b.cls!.value, keyProp: b.key!.value }))
    .sort((a, b) => a.cls.localeCompare(b.cls) || a.keyProp.localeCompare(b.keyProp));
  return { svProps, keyed };
}

const split = (concat: string): string[] => concat.split('\t').sort();

export async function runSparqlGroupBy(client: StorageAdapter, dir: string): Promise<ExactRunResult> {
  const t0 = performance.now();
  await loadFixture(client, dir);
  const t1 = performance.now();

  const { svProps, keyed } = await schemaFromStore(client);
  const detections: Detection[] = [];
  for (const p of svProps) {
    if (keyed.length > 0) {
      for (const { cls, keyProp } of keyed) {
        // The one aggregation query of the paper: join records on the key
        // literal, count distinct values of the single-valued property.
        const r = await client.select(`
          SELECT ?key
            (GROUP_CONCAT(DISTINCT STR(?r); SEPARATOR="${SEP}") AS ?recs)
            (GROUP_CONCAT(DISTINCT STR(?v); SEPARATOR="${SEP}") AS ?vals)
          WHERE { GRAPH <kg:abox> {
            ?r <${RDF_TYPE}> <${cls}> .
            ?r <${keyProp}> ?key .
            ?r <${p}> ?v .
          } }
          GROUP BY ?key
          HAVING (COUNT(DISTINCT ?v) > 1)
        `);
        for (const b of r.results.bindings) {
          detections.push({
            subjects: split(b.recs!.value), key: b.key!.value, keyProp,
            predicate: p, values: split(b.vals!.value),
          });
        }
      }
    } else {
      const r = await client.select(`
        SELECT ?s (GROUP_CONCAT(DISTINCT STR(?v); SEPARATOR="${SEP}") AS ?vals)
        WHERE { GRAPH <kg:abox> { ?s <${p}> ?v } }
        GROUP BY ?s
        HAVING (COUNT(DISTINCT ?v) > 1)
      `);
      for (const b of r.results.bindings) {
        detections.push({
          subjects: [b.s!.value], key: null, keyProp: null,
          predicate: p, values: split(b.vals!.value),
        });
      }
    }
  }
  const t2 = performance.now();

  // Witness bookkeeping only (which asserted triples a detection cites).
  const index = new TripleIndex(readAllEpisodes(dir));
  return {
    detections, index,
    timings: { setupMs: t1 - t0, detectMs: t2 - t1, totalMs: t2 - t0 },
    stats: {
      triples: index.triples, subjects: index.subjects().length,
      classes: null, singleValuedProps: svProps.length,
    },
  };
}
