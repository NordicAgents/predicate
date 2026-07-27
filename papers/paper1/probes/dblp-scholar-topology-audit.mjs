#!/usr/bin/env node
/**
 * Exploratory external-topology audit over the established DBLP--Scholar
 * entity-resolution benchmark. This does NOT turn a lexical mismatch into a
 * semantic conflict label. It asks only:
 *   1. how deep are paths in the benchmark's gold co-reference graph; and
 *   2. how often do records in one gold component carry unequal, nonempty
 *      publication-year strings?
 *
 * Usage:
 *   node dblp-scholar-topology-audit.mjs RAW_DIR OUTPUT_JSON
 *
 * RAW_DIR contains tableA.csv, tableB.csv, and matches.csv from:
 * https://pages.cs.wisc.edu/~anhai/data1/deepmatcher_data/Structured/
 * DBLP-GoogleScholar/dblp_scholar_raw_data.zip
 *
 * A CC-BY-4.0 release of the established entity-matching collections is
 * archived at https://doi.org/10.5281/zenodo.8164151.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [rawDir, outputPath] = process.argv.slice(2);
if (!rawDir || !outputPath) {
  throw new Error('usage: node dblp-scholar-topology-audit.mjs RAW_DIR OUTPUT_JSON');
}

function parseCsv(buffer) {
  // IDs and years are ASCII. latin1 is lossless for byte-level parsing of the
  // legacy mixed-encoding text fields in this 2010 benchmark.
  const text = buffer.toString('latin1').replace(/^\u00ef\u00bb\u00bf/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...values] = rows;
  if (!header) return [];
  return values.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const inputNames = ['tableA.csv', 'tableB.csv', 'matches.csv'];
const inputs = Object.fromEntries(inputNames.map((name) => {
  const buffer = readFileSync(join(rawDir, name));
  return [name, { buffer, sha256: sha256(buffer), rows: parseCsv(buffer) }];
}));

const tableA = new Map(inputs['tableA.csv'].rows.map((row) => [`A:${row.id}`, row]));
const tableB = new Map(inputs['tableB.csv'].rows.map((row) => [`B:${row.id}`, row]));
const records = new Map([...tableA, ...tableB]);
const adjacency = new Map();

function addEdge(left, right) {
  const ls = adjacency.get(left) ?? new Set();
  const rs = adjacency.get(right) ?? new Set();
  ls.add(right);
  rs.add(left);
  adjacency.set(left, ls);
  adjacency.set(right, rs);
}

for (const match of inputs['matches.csv'].rows) {
  addEdge(`A:${match.idDBLP}`, `B:${match.idScholar}`);
}

const seen = new Set();
const components = [];
for (const start of adjacency.keys()) {
  if (seen.has(start)) continue;
  const stack = [start];
  const members = [];
  seen.add(start);
  while (stack.length > 0) {
    const node = stack.pop();
    members.push(node);
    for (const neighbor of adjacency.get(node) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
  components.push(members.sort());
}

function shortestDistance(source, target) {
  const queue = [[source, 0]];
  const visited = new Set([source]);
  for (let head = 0; head < queue.length; head++) {
    const [node, distance] = queue[head];
    if (node === target) return distance;
    for (const neighbor of adjacency.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, distance + 1]);
      }
    }
  }
  return null;
}

const componentSizeCounts = new Map();
const disagreementDepthCounts = new Map();
let disagreementComponents = 0;
let disagreementPairs = 0;

for (const members of components) {
  componentSizeCounts.set(members.length, (componentSizeCounts.get(members.length) ?? 0) + 1);
  let componentHasDisagreement = false;
  for (let i = 0; i < members.length; i++) {
    const leftYear = (records.get(members[i])?.year ?? '').trim();
    if (!leftYear) continue;
    for (let j = i + 1; j < members.length; j++) {
      const rightYear = (records.get(members[j])?.year ?? '').trim();
      if (!rightYear || leftYear === rightYear) continue;
      const distance = shortestDistance(members[i], members[j]);
      if (distance === null) throw new Error('component pair unexpectedly disconnected');
      disagreementDepthCounts.set(distance, (disagreementDepthCounts.get(distance) ?? 0) + 1);
      disagreementPairs++;
      componentHasDisagreement = true;
    }
  }
  if (componentHasDisagreement) disagreementComponents++;
}

const sortedObject = (map) => Object.fromEntries([...map].sort((a, b) => a[0] - b[0]));
const depthCounts = sortedObject(disagreementDepthCounts);

const output = {
  status: 'exploratory-topology-only',
  source: {
    dataset: 'DBLP--Google Scholar raw entity-resolution benchmark',
    deepMatcherDocumentation: 'https://github.com/anhaidgroup/deepmatcher/blob/master/Datasets.md',
    rawDistribution: 'https://pages.cs.wisc.edu/~anhai/data1/deepmatcher_data/Structured/DBLP-GoogleScholar/dblp_scholar_raw_data.zip',
    ccByRelease: 'https://doi.org/10.5281/zenodo.8164151',
    licenseOfCcByRelease: 'CC-BY-4.0',
    inputSha256: Object.fromEntries(inputNames.map((name) => [name, inputs[name].sha256])),
  },
  counts: {
    tableARecords: inputs['tableA.csv'].rows.length,
    tableBRecords: inputs['tableB.csv'].rows.length,
    goldEdges: inputs['matches.csv'].rows.length,
    matchedNodes: adjacency.size,
    goldComponents: components.length,
    maximumComponentSize: Math.max(...components.map((members) => members.length)),
    componentSizeCounts: sortedObject(componentSizeCounts),
    componentsWithNonemptyUnequalYears: disagreementComponents,
    nonemptyUnequalYearPairs: disagreementPairs,
    pairShortestPathDepthCounts: depthCounts,
    directPairs: depthCounts['1'] ?? 0,
    chainOnlyPairs: disagreementPairs - (depthCounts['1'] ?? 0),
  },
  witnessLogicalTriplesByPathDepth: Object.fromEntries(
    Object.keys(depthCounts).map((depth) => [depth, 3 * Number(depth) + 3]),
  ),
  interpretation: [
    'Gold match edges are treated as symmetric co-reference edges and closed transitively for this topology audit.',
    'An unequal nonempty year is a cross-source record disagreement, not an independently adjudicated semantic contradiction.',
    'Version relations, benchmark linkage errors, or metadata errors can explain individual disagreements.',
    'No prevalence claim about conflicts in deployed agent memory follows from this audit.',
  ],
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
