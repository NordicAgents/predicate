// c2-ctgov-chain-depth-probe.mjs — Gate C chain-depth probe on domain C2
// (clinical-trial registry records), EXPLORATORY under Amendment A2.7's terms
// (aggregates only, no benchmark instance, no confirmatory number).
//
// WHY: the C1/OSV chain probe (2026-07-17) found 99.5% of co-referent record
// pairs share a key DIRECTLY (m = 1) and no pair at m >= 3 exists at all. Since
// CWI's measured advantage over key-aware@1 lives ENTIRELY at m >= 2, that
// result says the witness index earns nothing in C1. The obvious question is
// whether C1 is representative. C2 is the natural contrast: trial registrations
// carry an NCT number PLUS sponsor protocol ids, NIH grant numbers, EudraCT
// numbers, and other-registry ids (domain-selection.md §C2(b)), so records can
// chain A --sponsor-id-- B --grant-- C without A and C sharing anything.
//
// SAMPLING (fixed here, before the run):
//   - ClinicalTrials.gov API v2, /studies, paged by nextPageToken.
//   - Fields: NCTId, NCTIdAlias, OrgStudyIdInfo, SecondaryIdInfo. (NCTIdAlias
//     carries retired NCT numbers a record has absorbed -- a genuine alias
//     edge, and exactly the kind that produced chains in C1's OSV data.)
//   - Records are taken in API default order until PAGES pages are consumed.
//     This is a CONVENIENCE SAMPLE, not a random one, and no rate is claimed
//     for the registry as a whole -- it estimates whether the m >= 2 STRUCTURE
//     occurs at all, which is what the CWI argument turns on.
//
// KEYS. A record's identifiers are its NCT id, its org study id, and every
// secondary id. Identifiers are normalized (trim + uppercase) and a stop-list
// of non-identifying junk values is removed -- without that, placeholder org
// ids like "NA" or "PENDING" would fuse thousands of unrelated trials into one
// giant component and manufacture chains that do not exist. The stop-list and
// the min-length rule are declared BEFORE the run, below.
//
// OUTPUT: identical shape to the C1 probe, so the two are directly comparable.
//
//   node c2-ctgov-chain-depth-probe.mjs [pages] [report.json]

import { writeFileSync } from 'node:fs';

const PAGES = Number(process.argv[2] ?? 40);
const OUT = process.argv[3];
const PAGE_SIZE = 1000;
const MAX_COMPONENT_FOR_PAIRS = 60;

/** Values that are not identifiers. Declared before the run (see header). */
const STOP = new Set([
  'NA', 'N/A', 'NONE', 'NULL', 'PENDING', 'TBD', 'NOT APPLICABLE', 'NOTAPPLICABLE',
  'UNKNOWN', '0', '1', '-', '--', 'NOT AVAILABLE', 'NO', 'NIL',
]);
const MIN_KEY_LEN = 4;

const normKey = (raw, type) => {
  if (typeof raw !== 'string') return null;
  const k = raw.trim().toUpperCase();
  if (k.length < MIN_KEY_LEN || STOP.has(k)) return null;
  // Namespace by type so a sponsor id "12345" cannot collide with a grant "12345".
  return `${type}:${k}`;
};

async function fetchPage(token) {
  const url = new URL('https://clinicaltrials.gov/api/v2/studies');
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  url.searchParams.set('fields', 'NCTId,NCTIdAlias,OrgStudyIdInfo,SecondaryIdInfo');
  if (token) url.searchParams.set('pageToken', token);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.ok) return await res.json();
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('unreachable');
}

// ---- collect ------------------------------------------------------------
const recKeys = [];      // record index -> [namespaced keys]
let token;
let pages = 0;
process.stderr.write('fetching');
do {
  const page = await fetchPage(token);
  for (const s of page.studies ?? []) {
    const idm = s?.protocolSection?.identificationModule ?? {};
    const ks = new Set();
    const nct = normKey(idm.nctId, 'NCT');
    if (nct) ks.add(nct);
    for (const al of idm.nctIdAliases ?? []) {
      const k = normKey(al, 'NCT');
      if (k) ks.add(k);
    }
    const org = normKey(idm.orgStudyIdInfo?.id, 'ORG');
    if (org) ks.add(org);
    for (const sec of idm.secondaryIdInfos ?? []) {
      const k = normKey(sec?.id, sec?.type ? String(sec.type).toUpperCase() : 'SEC');
      if (k) ks.add(k);
    }
    if (ks.size > 0) recKeys.push([...ks]);
  }
  token = page.nextPageToken;
  pages++;
  process.stderr.write('.');
} while (token && pages < PAGES);
process.stderr.write(`\n${recKeys.length} records over ${pages} pages\n`);

// ---- bipartite record <-> key graph, union-find --------------------------
const keyToRecs = new Map();
recKeys.forEach((ks, i) => {
  for (const k of ks) {
    const g = keyToRecs.get(k) ?? [];
    g.push(i);
    keyToRecs.set(k, g);
  }
});

const parent = recKeys.map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; };
for (const recs of keyToRecs.values()) for (let i = 1; i < recs.length; i++) union(recs[0], recs[i]);

const comps = new Map();
recKeys.forEach((_, i) => {
  const r = find(i);
  const g = comps.get(r) ?? [];
  g.push(i);
  comps.set(r, g);
});
const multi = [...comps.values()].filter((c) => c.length >= 2);

/** BFS over the bipartite graph; record -> chain depth m (= bipartite dist / 2). */
function chainDepths(src, memberSet) {
  const dist = new Map([[`r${src}`, 0]]);
  const q = [`r${src}`];
  const out = new Map();
  while (q.length) {
    const cur = q.shift();
    const d = dist.get(cur);
    if (cur[0] === 'r') {
      const ri = Number(cur.slice(1));
      if (ri !== src && d % 2 === 0) out.set(ri, d / 2);
      for (const k of recKeys[ri]) {
        const nk = `k${k}`;
        if (!dist.has(nk)) { dist.set(nk, d + 1); q.push(nk); }
      }
    } else {
      for (const ri of keyToRecs.get(cur.slice(1)) ?? []) {
        if (!memberSet.has(ri)) continue;
        const nr = `r${ri}`;
        if (!dist.has(nr)) { dist.set(nr, d + 1); q.push(nr); }
      }
    }
  }
  return out;
}

const pairsByM = new Map();
let compsWithChain = 0;
let compsSkipped = 0;
let skippedRecords = 0;
for (const comp of multi) {
  if (comp.length > MAX_COMPONENT_FOR_PAIRS) { compsSkipped++; skippedRecords += comp.length; continue; }
  const memberSet = new Set(comp);
  let hasChain = false;
  for (let i = 0; i < comp.length; i++) {
    for (const [j, m] of chainDepths(comp[i], memberSet)) {
      if (j <= comp[i]) continue;
      pairsByM.set(m, (pairsByM.get(m) ?? 0) + 1);
      if (m >= 2) hasChain = true;
    }
  }
  if (hasChain) compsWithChain++;
}

const keyTypeCounts = new Map();
for (const ks of recKeys) for (const k of ks) {
  const t = k.split(':')[0];
  keyTypeCounts.set(t, (keyTypeCounts.get(t) ?? 0) + 1);
}

const allM = [...pairsByM.keys()].sort((a, b) => a - b);
const totalPairs = [...pairsByM.values()].reduce((a, b) => a + b, 0);
const chainPairs = allM.filter((m) => m >= 2).reduce((a, m) => a + pairsByM.get(m), 0);

const report = {
  probe: 'C2 chain depth — ClinicalTrials.gov API v2 (union-find over NCT + org + secondary ids)',
  registration: 'pre-registration.md Amendment A2.7 (EXPLORATORY; no confirmatory number, no instances mined)',
  question: 'do co-referent trial records require a chain of >= 2 key hops — the regime where the witness index beats key-aware@1?',
  contrastWithC1: 'C1/OSV (2026-07-17): 99.5% of co-referent pairs at m=1, no pair at m>=3, so CWI earned nothing there',
  sampling: `convenience sample: API default order, ${pages} pages x ${PAGE_SIZE}; NOT random; no registry-wide rate claimed`,
  normalization: { minKeyLength: MIN_KEY_LEN, stopList: [...STOP], namespacedByType: true },
  fetchedAt: new Date().toISOString(),
  records: recKeys.length,
  distinctKeys: keyToRecs.size,
  keyTypes: Object.fromEntries([...keyTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)),
  components: comps.size,
  multiRecordComponents: multi.length,
  componentsSkippedTooLarge: compsSkipped,
  recordsInSkippedComponents: skippedRecords,
  componentsContainingAChain: compsWithChain,
  chainDepthDistribution: allM.map((m) => ({ m, coReferentPairs: pairsByM.get(m) })),
  headline: {
    totalCoReferentPairs: totalPairs,
    pairsAtM1: pairsByM.get(1) ?? 0,
    pairsAtMge2: chainPairs,
    shareOfPairsRequiringAChain: totalPairs > 0 ? chainPairs / totalPairs : null,
    maxDepthObserved: allM.length ? allM[allM.length - 1] : 0,
  },
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
