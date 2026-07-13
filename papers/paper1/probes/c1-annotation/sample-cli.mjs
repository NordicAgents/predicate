// sample-cli.mjs — deterministic stratified sampler for the C1 semantic-
// annotation harness, registered as EXPLORATORY TOOLING in pre-registration
// Amendment A4.4 (continuation of A2.7; domain-selection.md §6 C1 step 4).
//
// Reuses the grouping/comparison semantics of ../c1-osv-prevalence-probe.mjs
// verbatim: records are grouped by shared CVE alias, and each multi-record
// group is classified severity-disagree / range-disagree using the same
// severity- and range-signature logic. Groups are then stratified
// (range-disagree-only / severity-disagree-only / both-disagree /
// no-disagreement controls; sizes fixed in guide.md BEFORE sampling) and
// sampled deterministically: candidate CVE ids sorted lexicographically,
// then one seeded Fisher-Yates shuffle (mulberry32, seed 0xc1a0) per
// stratum, taking the first N.
//
// !!! DO NOT COMMIT THE OUTPUTS OF THIS SCRIPT !!!
// sample.jsonl embeds VERBATIM record text (severity + affected payloads)
// from the OSV bulk export, which carries per-source licenses
// (domain-selection.md §5). Outputs default to the INPUT DIR'S PARENT and
// must never be written into or committed to this repository. Only the
// eventual aggregate agreement statistics are committable.
//
// Usage:
//   node sample-cli.mjs <extracted-osv-dir> [output-dir]
//
// Outputs (in output-dir; default = parent of extracted-osv-dir):
//   sample.jsonl       one line per sampled CVE group: cve, stratum, record
//                      ids, and each member's verbatim severity + affected
//                      payloads (+ modified date, for the temporal-
//                      supersession decision rule in guide.md)
//   annotator-A.csv    blank annotation skeleton (cve, stratum, label,
//   annotator-B.csv    rationale) — RFC4180-quoted CSV, see guide.md
//
// Node builtins only. Exploratory: produces no confirmatory numbers.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const [dir, outDirArg] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node sample-cli.mjs <extracted-osv-dir> [output-dir]');
  process.exit(1);
}
const outDir = outDirArg ?? dirname(resolve(dir));

// Strata sizes: fixed in guide.md BEFORE sampling (Amendment A4.4).
const STRATA = {
  'range-disagree-only': 100,
  'severity-disagree-only': 50,
  'both-disagree': 50,
  'no-disagreement': 100,
};

// ---- record loading + signature logic, identical to the prevalence probe --

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const records = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const cveIdsOf = (r) => {
  const ids = new Set();
  for (const x of [r.id, ...(r.aliases ?? [])]) {
    if (typeof x === 'string' && x.startsWith('CVE-')) ids.add(x);
  }
  return [...ids];
};

/** Normalized severity signatures of one record (CVSS vectors + DB labels). */
const severitySigs = (r) => {
  const sigs = new Set();
  for (const s of r.severity ?? []) {
    if (s?.type && s?.score) sigs.add(`${s.type}:${s.score}`);
  }
  const label = r.database_specific?.severity;
  if (typeof label === 'string') sigs.add(`LABEL:${label.toUpperCase()}`);
  return sigs;
};

/** Map package name -> canonicalized affected-range signature. */
const rangeSigs = (r) => {
  const byPkg = new Map();
  for (const a of r.affected ?? []) {
    const name = a?.package?.name;
    if (!name) continue;
    const events = (a.ranges ?? []).flatMap((rg) => rg.events ?? [])
      .map((e) => JSON.stringify(e));
    const versions = (a.versions ?? []).slice().sort();
    const sig = JSON.stringify({ events: events.sort(), versions });
    byPkg.set(name, byPkg.has(name) ? `${byPkg.get(name)}|${sig}` : sig);
  }
  return byPkg;
};

// ---- group by shared CVE alias (same as probe) ----------------------------

const groups = new Map(); // CVE id -> record indices
records.forEach((r, i) => {
  for (const cve of cveIdsOf(r)) {
    const g = groups.get(cve) ?? [];
    g.push(i);
    groups.set(cve, g);
  }
});

// ---- classify each multi-record group (same comparison logic as probe) ----

const classify = (memberIdx) => {
  const members = memberIdx.map((i) => records[i]);

  // Severity: comparable when >= 2 members carry severity of a common type;
  // disagree when a shared type carries >= 2 distinct values across members.
  const typedVals = new Map();
  const typedMembers = new Map();
  for (const m of members) {
    const perMemberTypes = new Map();
    for (const sig of severitySigs(m)) {
      const [type, ...rest] = sig.split(':');
      const vals = perMemberTypes.get(type) ?? new Set();
      vals.add(rest.join(':'));
      perMemberTypes.set(type, vals);
    }
    for (const [key, vals] of perMemberTypes) {
      typedMembers.set(key, (typedMembers.get(key) ?? 0) + 1);
      const all = typedVals.get(key) ?? new Set();
      for (const v of vals) all.add(v);
      typedVals.set(key, all);
    }
  }
  const sharedSevTypes = [...typedMembers.entries()].filter(([, n]) => n >= 2);
  const sevComparable = sharedSevTypes.length > 0;
  const sevDisagree =
    sevComparable && sharedSevTypes.some(([t]) => typedVals.get(t).size >= 2);

  // Ranges: a package is comparable when >= 2 members describe it; the group
  // disagrees when any comparable package has >= 2 distinct signatures.
  const pkgSigs = new Map();
  const perPkgMembers = new Map();
  for (const m of members) {
    for (const [pkg, sig] of rangeSigs(m)) {
      const s = pkgSigs.get(pkg) ?? new Set();
      s.add(sig);
      pkgSigs.set(pkg, s);
      perPkgMembers.set(pkg, (perPkgMembers.get(pkg) ?? 0) + 1);
    }
  }
  const comparablePkgs = [...perPkgMembers.entries()].filter(([, n]) => n >= 2);
  const rangeComparable = comparablePkgs.length > 0;
  const rangeDisagree =
    rangeComparable && comparablePkgs.some(([pkg]) => pkgSigs.get(pkg).size >= 2);

  return { sevComparable, sevDisagree, rangeComparable, rangeDisagree };
};

const candidates = new Map(Object.keys(STRATA).map((s) => [s, []]));
for (const [cve, memberIdx] of groups) {
  if (memberIdx.length < 2) continue;
  const c = classify(memberIdx);
  let stratum = null;
  if (c.sevDisagree && c.rangeDisagree) stratum = 'both-disagree';
  else if (c.sevDisagree) stratum = 'severity-disagree-only';
  else if (c.rangeDisagree) stratum = 'range-disagree-only';
  // Controls: comparable on at least one field, agreeing on every
  // comparable field (a group with nothing comparable is not a control).
  else if (c.sevComparable || c.rangeComparable) stratum = 'no-disagreement';
  if (stratum) candidates.get(stratum).push(cve);
}

// ---- deterministic per-stratum selection ----------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates: fresh mulberry32(0xc1a0) generator per stratum. */
const seededShuffle = (arr) => {
  const rand = mulberry32(0xc1a0);
  const a = arr.slice();
  for (let i = a.length - 1; i >= 1; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sampled = []; // { cve, stratum }
const counts = {};
for (const [stratum, target] of Object.entries(STRATA)) {
  const pool = candidates.get(stratum).slice().sort(); // lexicographic
  const picked = seededShuffle(pool).slice(0, target);
  for (const cve of picked) sampled.push({ cve, stratum });
  counts[stratum] = { candidates: pool.length, target, sampled: picked.length };
  if (picked.length < target) {
    console.error(
      `NOTE: stratum "${stratum}" has only ${pool.length} candidates ` +
      `(< target ${target}); took all. Record this shortfall in the report.`,
    );
  }
}

// ---- outputs ---------------------------------------------------------------

const sampleLines = sampled.map(({ cve, stratum }) => {
  const members = groups.get(cve).map((i) => {
    const r = records[i];
    return {
      id: r.id,
      modified: r.modified ?? null,
      severity: r.severity ?? null, // verbatim payload
      databaseSpecificSeverity: r.database_specific?.severity ?? null,
      affected: r.affected ?? null, // verbatim payload
    };
  });
  return JSON.stringify({ cve, stratum, recordIds: members.map((m) => m.id), members });
});
writeFileSync(join(outDir, 'sample.jsonl'), sampleLines.join('\n') + '\n');

// RFC4180-minimal quoting: quote a field iff it contains comma, quote, CR,
// or LF; internal quotes doubled. agreement.mjs parses the same dialect.
const csvField = (v) =>
  /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
const csvRow = (cells) => cells.map(csvField).join(',');
const skeleton =
  [csvRow(['cve', 'stratum', 'label', 'rationale'])]
    .concat(sampled.map(({ cve, stratum }) => csvRow([cve, stratum, '', ''])))
    .join('\n') + '\n';
writeFileSync(join(outDir, 'annotator-A.csv'), skeleton);
writeFileSync(join(outDir, 'annotator-B.csv'), skeleton);

console.log(JSON.stringify({
  registration: 'pre-registration.md Amendment A4.4 (EXPLORATORY tooling)',
  seed: '0xc1a0 (mulberry32, fresh per stratum, pool sorted lexicographically)',
  inputRecords: records.length,
  outputDir: outDir,
  strata: counts,
  totalSampled: sampled.length,
  warning: 'sample.jsonl embeds verbatim OSV record text — DO NOT COMMIT',
}, null, 2));
