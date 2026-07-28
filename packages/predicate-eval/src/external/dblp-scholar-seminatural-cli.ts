/**
 * Semi-natural conflict-retrieval evaluation on DBLP--Google Scholar.
 *
 * Natural parts: independently supplied gold match edges, their transitive
 * component topology, and the real record attributes retained as distractors.
 * Controlled part: one synthetic single-valued probe predicate is injected at
 * a selected record pair, with unequal values for positives and equal values
 * for paired negatives. This yields unambiguous labels without treating a
 * lexical metadata disagreement as a semantic contradiction.
 *
 * Usage:
 *   pnpm --filter predicate-eval external-seminatural RAW_DIR
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeTriple } from '../episode-runner.js';
import { ConflictWitnessIndex } from '../cwi/index.js';
import { RDF_TYPE, tripleId } from '../exact/contract.js';
import type { TBoxSchema } from '../exact/tbox.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const EX = 'https://example.org/dblp-scholar-seminatural/';
const RECORD = `${EX}PublicationRecord`;
const GOLD_EDGE = `${EX}goldMatchEdge`;
const PROBE = `${EX}controlledState`;
const ATTRIBUTES = ['title', 'authors', 'venue', 'year'] as const;
const TARGET_PER_DEPTH = 20;

interface CsvRow {
  [key: string]: string;
}

interface Input {
  buffer: Buffer;
  sha256: string;
  rows: CsvRow[];
}

interface PairCandidate {
  component: string[];
  left: string;
  right: string;
  depth: number;
}

interface InstanceResult {
  id: string;
  label: 'conflict' | 'benign-agreement';
  depth: number;
  componentSize: number;
  sourceTriples: number;
  naturalDistractorTriples: number;
  expectedWitnessTriples: number;
  returnedWitnessTriples: number;
  correct: boolean;
}

function parseCsv(buffer: Buffer): CsvRow[] {
  const text = buffer.toString('latin1').replace(/^\u00ef\u00bb\u00bf/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...values] = rows;
  if (!header) return [];
  return values.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])));
}

const sha256 = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

function loadInput(rawDir: string, name: string): Input {
  const buffer = readFileSync(join(rawDir, name));
  return { buffer, sha256: sha256(buffer), rows: parseCsv(buffer) };
}

function shortestDistance(
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string,
): number | null {
  const queue: Array<[string, number]> = [[source, 0]];
  const seen = new Set([source]);
  for (let head = 0; head < queue.length; head++) {
    const [node, distance] = queue[head]!;
    if (node === target) return distance;
    for (const neighbor of adjacency.get(node) ?? []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push([neighbor, distance + 1]);
    }
  }
  return null;
}

function componentsOf(adjacency: Map<string, Set<string>>): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const start of [...adjacency.keys()].sort()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const members: string[] = [];
    seen.add(start);
    while (stack.length > 0) {
      const node = stack.pop()!;
      members.push(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(members.sort());
  }
  return components;
}

function selectPairs(
  components: string[][],
  adjacency: Map<string, Set<string>>,
): PairCandidate[] {
  const candidates = new Map<number, PairCandidate[]>(
    [1, 2, 3, 4].map((depth) => [depth, []]),
  );
  for (const component of components) {
    for (let i = 0; i < component.length; i++) {
      for (let j = i + 1; j < component.length; j++) {
        const depth = shortestDistance(adjacency, component[i]!, component[j]!);
        if (depth !== null && candidates.has(depth)) {
          candidates.get(depth)!.push({
            component,
            left: component[i]!,
            right: component[j]!,
            depth,
          });
        }
      }
    }
  }
  for (const values of candidates.values()) {
    values.sort((a, b) =>
      a.component[0]!.localeCompare(b.component[0]!)
      || a.left.localeCompare(b.left)
      || a.right.localeCompare(b.right));
  }

  // Reserve rare deep components first and use at most one pair per component.
  const used = new Set<string>();
  const selected: PairCandidate[] = [];
  for (const depth of [4, 3, 2, 1]) {
    let count = 0;
    for (const candidate of candidates.get(depth)!) {
      const componentId = candidate.component.join('\u0000');
      if (used.has(componentId)) continue;
      used.add(componentId);
      selected.push(candidate);
      count++;
      if (count === TARGET_PER_DEPTH) break;
    }
  }
  return selected.sort((a, b) =>
    a.depth - b.depth
    || a.component[0]!.localeCompare(b.component[0]!)
    || a.left.localeCompare(b.left)
    || a.right.localeCompare(b.right));
}

function buildTriples(
  candidate: PairCandidate,
  records: Map<string, CsvRow>,
  adjacency: Map<string, Set<string>>,
  conflict: boolean,
): { triples: EpisodeTriple[]; distractors: number } {
  const triples: EpisodeTriple[] = [];
  let distractors = 0;
  for (const record of candidate.component) {
    triples.push({ s: `${EX}record/${record}`, p: RDF_TYPE, o: RECORD });
    const row = records.get(record);
    for (const attribute of ATTRIBUTES) {
      const value = (row?.[attribute] ?? '').trim();
      if (!value) continue;
      triples.push({
        s: `${EX}record/${record}`,
        p: `${EX}${attribute}`,
        o: value,
        lit: true,
      });
      distractors++;
    }
  }
  const emittedEdges = new Set<string>();
  for (const left of candidate.component) {
    for (const right of adjacency.get(left) ?? []) {
      if (!candidate.component.includes(right)) continue;
      const [a, b] = [left, right].sort();
      const edgeId = `${a}\u0000${b}`;
      if (emittedEdges.has(edgeId)) continue;
      emittedEdges.add(edgeId);
      const keyValue = `gold:${createHash('sha256').update(edgeId).digest('hex').slice(0, 16)}`;
      triples.push(
        { s: `${EX}record/${a}`, p: GOLD_EDGE, o: keyValue, lit: true },
        { s: `${EX}record/${b}`, p: GOLD_EDGE, o: keyValue, lit: true },
      );
    }
  }
  triples.push(
    { s: `${EX}record/${candidate.left}`, p: PROBE, o: 'state-a', lit: true },
    {
      s: `${EX}record/${candidate.right}`,
      p: PROBE,
      o: conflict ? 'state-b' : 'state-a',
      lit: true,
    },
  );
  return { triples, distractors };
}

const schema: TBoxSchema = {
  prefixes: {},
  keyedClasses: new Map([[RECORD, [GOLD_EDGE]]]),
  singleValued: new Set([PROBE]),
  validFromProp: null,
  validToProp: null,
  scopeProp: null,
};

function runInstance(
  candidate: PairCandidate,
  records: Map<string, CsvRow>,
  adjacency: Map<string, Set<string>>,
  conflict: boolean,
  ordinal: number,
): InstanceResult {
  const built = buildTriples(candidate, records, adjacency, conflict);
  const index = new ConflictWitnessIndex(schema);
  for (const triple of built.triples) index.insert(triple);
  const result = index.query(`${EX}record/${candidate.left}`);
  const matching = result.conflicts.filter((item) => item.predicate === PROBE);
  const expectedWitnessTriples = 3 * candidate.depth + 3;
  const returnedWitnessTriples = matching[0]?.witness.length ?? 0;
  const sourceIds = new Set(
    built.triples.map((triple) => tripleId(triple.s, triple.p, triple.o)),
  );
  const sourceGrounded = matching.every((item) =>
    item.witnessIds.every((id) => sourceIds.has(id)));
  const correct = conflict
    ? matching.length === 1
      && returnedWitnessTriples === expectedWitnessTriples
      && sourceGrounded
    : matching.length === 0;
  return {
    id: `depth-${candidate.depth}-${String(ordinal).padStart(2, '0')}-${conflict ? 'pos' : 'neg'}`,
    label: conflict ? 'conflict' : 'benign-agreement',
    depth: candidate.depth,
    componentSize: candidate.component.length,
    sourceTriples: built.triples.length,
    naturalDistractorTriples: built.distractors,
    expectedWitnessTriples,
    returnedWitnessTriples,
    correct,
  };
}

function counts(values: InstanceResult[], key: (value: InstanceResult) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[key(value)] = (out[key(value)] ?? 0) + 1;
  return out;
}

function fiveNumber(values: number[]): {
  min: number;
  median: number;
  max: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  const lo = Math.floor(middle);
  const hi = Math.ceil(middle);
  return {
    min: sorted[0] ?? 0,
    median: ((sorted[lo] ?? 0) + (sorted[hi] ?? 0)) / 2,
    max: sorted.at(-1) ?? 0,
  };
}

function main(rawDir: string | undefined): void {
  if (!rawDir) {
    throw new Error('usage: tsx src/external/dblp-scholar-seminatural-cli.ts RAW_DIR');
  }
  const tableA = loadInput(rawDir, 'tableA.csv');
  const tableB = loadInput(rawDir, 'tableB.csv');
  const matches = loadInput(rawDir, 'matches.csv');
  const records = new Map<string, CsvRow>([
    ...tableA.rows.map((row): [string, CsvRow] => [`A:${row.id}`, row]),
    ...tableB.rows.map((row): [string, CsvRow] => [`B:${row.id}`, row]),
  ]);
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (left: string, right: string): void => {
    const ls = adjacency.get(left) ?? new Set<string>();
    const rs = adjacency.get(right) ?? new Set<string>();
    ls.add(right);
    rs.add(left);
    adjacency.set(left, ls);
    adjacency.set(right, rs);
  };
  for (const match of matches.rows) addEdge(`A:${match.idDBLP}`, `B:${match.idScholar}`);
  const components = componentsOf(adjacency);
  const selected = selectPairs(components, adjacency);
  const instances: InstanceResult[] = [];
  selected.forEach((candidate, i) => {
    instances.push(
      runInstance(candidate, records, adjacency, true, i + 1),
      runInstance(candidate, records, adjacency, false, i + 1),
    );
  });

  const output = {
    kind: 'semi-natural-controlled-conflicts',
    source: {
      dataset: 'DBLP--Google Scholar raw entity-resolution benchmark',
      ccByRelease: 'https://doi.org/10.5281/zenodo.8164151',
      license: 'CC-BY-4.0',
      inputSha256: {
        'tableA.csv': tableA.sha256,
        'tableB.csv': tableB.sha256,
        'matches.csv': matches.sha256,
      },
    },
    design: {
      natural: 'gold match topology and title/author/venue/year distractor attributes',
      controlled: 'one injected single-valued predicate; unequal values for positives and equal values for paired negatives',
      selection: `up to ${TARGET_PER_DEPTH} lexicographic component-disjoint pairs per gold-path depth, reserving depths 4 to 1`,
      nonClaim: 'does not estimate naturally occurring semantic-conflict prevalence',
    },
    counts: {
      selectedPairs: selected.length,
      instances: instances.length,
      labels: counts(instances, (item) => item.label),
      positiveDepths: counts(
        instances.filter((item) => item.label === 'conflict'),
        (item) => String(item.depth),
      ),
      correct: instances.filter((item) => item.correct).length,
      incorrect: instances.filter((item) => !item.correct).length,
    },
    contextSummary: {
      componentSize: fiveNumber(
        instances.filter((item) => item.label === 'conflict').map((item) => item.componentSize),
      ),
      sourceTriples: fiveNumber(
        instances.filter((item) => item.label === 'conflict').map((item) => item.sourceTriples),
      ),
      naturalDistractorTriples: fiveNumber(
        instances
          .filter((item) => item.label === 'conflict')
          .map((item) => item.naturalDistractorTriples),
      ),
      witnessTriples: fiveNumber(
        instances
          .filter((item) => item.label === 'conflict')
          .map((item) => item.returnedWitnessTriples),
      ),
    },
    instances,
  };
  if (output.counts.incorrect > 0) {
    throw new Error(`${output.counts.incorrect} semi-natural instances failed`);
  }
  const outDir = join(PKG_ROOT, 'results', 'external');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'dblp-scholar-seminatural.json');
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
  console.error(JSON.stringify(output.counts));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
