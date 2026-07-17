// c1-osv-chain-depth-probe.mjs — Gate C follow-up probe on domain C1.
// EXPLORATORY, continuing Amendment A2.7's registration (no confirmatory
// number, no benchmark instance, aggregates only). No new amendment: this
// measures a NEW quantity on the SAME domain under A2.7's exploratory terms.
//
// WHY THIS EXISTS
// ---------------
// The A2.7 probe grouped OSV records by a SINGLE shared CVE alias and found
// 80.7% of CVE-keyed groups hold >= 2 independently authored records. That
// establishes cross-record co-reference at m = 1 (two records sharing one key
// directly) — and m = 1 is exactly the regime where the method under test wins
// nothing: on the benchmark's m=1 families, key-aware@1 retrieval is already
// witness-complete at 8 context triples against CWI's 6 (1.3x), and CWI pays
// ~1.9x write amplification for the privilege.
//
// The measured CWI advantage lives entirely at CHAIN DEPTH m >= 2, where a
// neighbourhood policy must either miss (k < m -> 0 recall) or buy the whole
// radius-m ball (key-aware@3 pays 15,245 context triples across the benchmark
// vs CWI's 514). So the live question for external validity is not "do records
// co-refer?" (answered: yes) but:
//
//   *** Do co-referent records in the wild require a CHAIN of >= 2 key hops? ***
//
// A2.7 could not see this: grouping by one alias type makes every pair m = 1 by
// construction. But OSV records carry MULTIPLE aliases (CVE-, GHSA-, PYSEC-,
// GO-, ...). Record A may share a CVE with B, B share a GHSA with C, and A and
// C share no identifier at all. That is an m = 2 chain, and only a union-find
// over ALL aliases can see it.
//
// WHAT IS MEASURED (aggregates only)
//   a. connected components of the record<->key bipartite graph over ALL
//      identifiers (union-find), i.e. the real ~K equivalence classes;
//   b. the CHAIN-DEPTH distribution over co-referent record PAIRS:
//      m = bipartite_distance(x, y) / 2. m = 1 means x and y share a key
//      directly; m >= 2 means they are co-referent only transitively;
//   c. the same distribution restricted to pairs that DISAGREE on severity or
//      affected ranges -- the conflict-carrying pairs. This is the number that
//      decides whether the m >= 2 regime carries real conflicts or is an
//      empty structural curiosity.
//
// HOW TO READ THE RESULT (committed to before running)
//   - If disagreeing pairs are overwhelmingly m = 1, then in this domain
//     key-aware@1 retrieval is witness-complete at ~8 triples and the witness
//     index earns nothing. That is falsification-clause-2 shaped and should be
//     reported as such, not explained away.
//   - If a material share of disagreeing pairs sit at m >= 2, the fixed-k
//     dilemma is real in the wild: one k cannot be chosen without knowing m,
//     k < m misses silently, and k >= m buys the ball.
//
// Node builtins only. Raw OSV data is NOT committed (per-source licenses,
// domain-selection.md §5); only aggregates and the snapshot id may be.
//
//   curl -sSL -D headers.txt -o osv-pypi-all.zip \
//     "https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip"
//   unzip -q osv-pypi-all.zip -d osv-pypi
//   node c1-osv-chain-depth-probe.mjs osv-pypi [report.json]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node c1-osv-chain-depth-probe.mjs <extracted-osv-dir> [report.json]');
  process.exit(1);
}

/** Components larger than this are counted but not pairwise-enumerated (cost guard). */
const MAX_COMPONENT_FOR_PAIRS = 60;

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const records = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

/** EVERY identifier a record carries — its own id and all aliases. The A2.7
 *  probe used CVE ids only, which forces m = 1 by construction. */
const keysOf = (r) => {
  const ks = new Set();
  for (const x of [r.id, ...(r.aliases ?? []), ...(r.related ?? [])]) {
    if (typeof x === 'string' && x.length > 0) ks.add(x);
  }
  return [...ks];
};

const prefixOf = (k) => (k.split('-')[0] ?? 'OTHER').toUpperCase();

// --- severity / range signatures (same semantics as the A2.7 probe) --------
const severitySigs = (r) => {
  const sigs = new Set();
  for (const s of r.severity ?? []) if (s?.type && s?.score) sigs.add(`${s.type}:${s.score}`);
  const label = r.database_specific?.severity;
  if (typeof label === 'string') sigs.add(`LABEL:${label.toUpperCase()}`);
  return sigs;
};
const rangeSigs = (r) => {
  const byPkg = new Map();
  for (const a of r.affected ?? []) {
    const name = a?.package?.name;
    if (!name) continue;
    const events = (a.ranges ?? []).flatMap((rg) => rg.events ?? []).map((e) => JSON.stringify(e));
    const versions = (a.versions ?? []).slice().sort();
    const sig = JSON.stringify({ events: events.sort(), versions });
    byPkg.set(name, byPkg.has(name) ? `${byPkg.get(name)}|${sig}` : sig);
  }
  return byPkg;
};

/** Do two records DISAGREE on a comparable field? (pairwise form of A2.7's group test) */
function pairDisagrees(a, b) {
  // severity: comparable when both carry a common type; disagree when values differ.
  const typed = (r) => {
    const m = new Map();
    for (const sig of severitySigs(r)) {
      const [t, ...rest] = sig.split(':');
      const s = m.get(t) ?? new Set();
      s.add(rest.join(':'));
      m.set(t, s);
    }
    return m;
  };
  const ta = typed(a); const tb = typed(b);
  let sevComparable = false; let sevDisagree = false;
  for (const [t, va] of ta) {
    const vb = tb.get(t);
    if (!vb) continue;
    sevComparable = true;
    if ([...va].some((x) => !vb.has(x)) || [...vb].some((x) => !va.has(x))) sevDisagree = true;
  }
  // ranges: comparable when both describe a common package; disagree when sigs differ.
  const ra = rangeSigs(a); const rb = rangeSigs(b);
  let rangeComparable = false; let rangeDisagree = false;
  for (const [pkg, sa] of ra) {
    const sb = rb.get(pkg);
    if (sb === undefined) continue;
    rangeComparable = true;
    if (sa !== sb) rangeDisagree = true;
  }
  return {
    comparable: sevComparable || rangeComparable,
    disagree: sevDisagree || rangeDisagree,
    sevComparable, sevDisagree, rangeComparable, rangeDisagree,
  };
}

// --- bipartite record <-> key graph ---------------------------------------
const keyToRecs = new Map();
const recKeys = records.map((r, i) => {
  const ks = keysOf(r);
  for (const k of ks) {
    const g = keyToRecs.get(k) ?? [];
    g.push(i);
    keyToRecs.set(k, g);
  }
  return ks;
});

// --- union-find over records via shared keys ------------------------------
const parent = records.map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; };
for (const recs of keyToRecs.values()) for (let i = 1; i < recs.length; i++) union(recs[0], recs[i]);

const comps = new Map();
records.forEach((_, i) => {
  const r = find(i);
  const g = comps.get(r) ?? [];
  g.push(i);
  comps.set(r, g);
});
const multi = [...comps.values()].filter((c) => c.length >= 2);

/** BFS over the bipartite graph from a record; returns record -> chain depth m. */
function chainDepths(src, memberSet) {
  const dist = new Map([[`r${src}`, 0]]);
  const q = [`r${src}`];
  const outM = new Map();
  while (q.length) {
    const cur = q.shift();
    const d = dist.get(cur);
    if (cur[0] === 'r') {
      const ri = Number(cur.slice(1));
      if (ri !== src && d % 2 === 0) outM.set(ri, d / 2);
      for (const k of recKeys[ri]) {
        const nk = `k${k}`;
        if (!dist.has(nk)) { dist.set(nk, d + 1); q.push(nk); }
      }
    } else {
      const k = cur.slice(1);
      for (const ri of keyToRecs.get(k) ?? []) {
        if (!memberSet.has(ri)) continue;
        const nr = `r${ri}`;
        if (!dist.has(nr)) { dist.set(nr, d + 1); q.push(nr); }
      }
    }
  }
  return outM;
}

// --- the measurement ------------------------------------------------------
const pairsByM = new Map();          // m -> total co-referent pairs
const comparableByM = new Map();     // m -> pairs comparable on some field
const disagreeByM = new Map();       // m -> pairs that DISAGREE
const bump = (map, m) => map.set(m, (map.get(m) ?? 0) + 1);

let compsWithChain = 0;
let compsSkipped = 0;
let skippedRecords = 0;
const keyTypeCounts = new Map();
for (const ks of recKeys) for (const k of ks) keyTypeCounts.set(prefixOf(k), (keyTypeCounts.get(prefixOf(k)) ?? 0) + 1);

for (const comp of multi) {
  if (comp.length > MAX_COMPONENT_FOR_PAIRS) { compsSkipped++; skippedRecords += comp.length; continue; }
  const memberSet = new Set(comp);
  let hasChain = false;
  for (let i = 0; i < comp.length; i++) {
    const depths = chainDepths(comp[i], memberSet);
    for (const [j, m] of depths) {
      if (j <= comp[i]) continue;            // each unordered pair once
      bump(pairsByM, m);
      if (m >= 2) hasChain = true;
      const d = pairDisagrees(records[comp[i]], records[j]);
      if (d.comparable) bump(comparableByM, m);
      if (d.disagree) bump(disagreeByM, m);
    }
  }
  if (hasChain) compsWithChain++;
}

const allM = [...new Set([...pairsByM.keys()])].sort((a, b) => a - b);
const totalPairs = [...pairsByM.values()].reduce((a, b) => a + b, 0);
const totalDisagree = [...disagreeByM.values()].reduce((a, b) => a + b, 0);
const chainPairs = allM.filter((m) => m >= 2).reduce((a, m) => a + pairsByM.get(m), 0);
const chainDisagree = allM.filter((m) => m >= 2).reduce((a, m) => a + (disagreeByM.get(m) ?? 0), 0);

const report = {
  probe: 'C1 chain depth — OSV bulk export, PyPI ecosystem (union-find over ALL aliases)',
  registration: 'pre-registration.md Amendment A2.7 (EXPLORATORY; no confirmatory number, no instances mined)',
  question: 'do co-referent records in the wild require a chain of >= 2 key hops (the only regime where the witness index beats key-aware@1)?',
  contrastWithA27: 'A2.7 grouped by a SINGLE CVE alias, which forces m = 1 by construction and cannot see chains',
  snapshot: { source: 'https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip', note: 'record the Last-Modified header alongside this report' },
  records: records.length,
  distinctKeys: keyToRecs.size,
  keyTypes: Object.fromEntries([...keyTypeCounts.entries()].sort((a, b) => b[1] - a[1])),
  components: comps.size,
  multiRecordComponents: multi.length,
  componentsSkippedTooLarge: compsSkipped,
  recordsInSkippedComponents: skippedRecords,
  maxComponentForPairs: MAX_COMPONENT_FOR_PAIRS,
  componentsContainingAChain: compsWithChain,
  chainDepthDistribution: allM.map((m) => ({
    m,
    coReferentPairs: pairsByM.get(m) ?? 0,
    comparablePairs: comparableByM.get(m) ?? 0,
    disagreeingPairs: disagreeByM.get(m) ?? 0,
    disagreementRate: (comparableByM.get(m) ?? 0) > 0 ? (disagreeByM.get(m) ?? 0) / comparableByM.get(m) : null,
  })),
  headline: {
    totalCoReferentPairs: totalPairs,
    pairsAtM1: pairsByM.get(1) ?? 0,
    pairsAtMge2: chainPairs,
    shareOfPairsRequiringAChain: totalPairs > 0 ? chainPairs / totalPairs : null,
    totalDisagreeingPairs: totalDisagree,
    disagreeingPairsAtMge2: chainDisagree,
    shareOfDisagreementsRequiringAChain: totalDisagree > 0 ? chainDisagree / totalDisagree : null,
  },
};

console.log(JSON.stringify(report, null, 2));
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
