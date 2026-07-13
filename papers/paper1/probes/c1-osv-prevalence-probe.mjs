// c1-osv-prevalence-probe.mjs — Gate C preview probe on domain C1
// (vulnerability records), registered as EXPLORATORY in pre-registration
// Amendment A2.7 and specified in domain-selection.md §6 (C1 step 4).
//
// Question: does a realistic domain reproduce the cross-record mechanism —
// records co-referent ONLY through a shared key (here: the CVE id, a string
// identifier exactly analogous to the benchmark's email literal), carrying
// independently authored, genuinely conflicting constrained values (severity,
// affected ranges)?
//
// Input: an extracted OSV bulk export slice (one ecosystem), e.g.
//   curl -sSL -o osv-pypi-all.zip \
//     "https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip"
//   unzip -q osv-pypi-all.zip -d osv-pypi
//   node c1-osv-prevalence-probe.mjs osv-pypi <report.json>
//
// The raw OSV data is NOT committed (29 MB; per-source licenses — see
// domain-selection.md §5); the probe commits only aggregate rates + the
// snapshot identifier, and the fetch commands above reproduce the input.
//
// Measured quantities (aggregates only, no example mining):
//   a. records with >= 1 CVE alias; CVE-keyed groups with >= 2 records
//      (= cross-record co-reference through the shared key);
//   b. within multi-record groups: disagreement rate on severity
//      (normalized CVSS vector / database_specific severity label) and on
//      affected version ranges for the SAME package (canonicalized events).
//
// Node builtins only. Exploratory: no benchmark instance is built from this.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node c1-osv-prevalence-probe.mjs <extracted-osv-dir> [report.json]');
  process.exit(1);
}

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

// ---- a. co-reference through the CVE key --------------------------------
const groups = new Map(); // CVE id -> record indices
records.forEach((r, i) => {
  for (const cve of cveIdsOf(r)) {
    const g = groups.get(cve) ?? [];
    g.push(i);
    groups.set(cve, g);
  }
});
const withCve = records.filter((r) => cveIdsOf(r).length > 0).length;
const multiRecord = [...groups.values()].filter((g) => g.length >= 2);

// ---- b. disagreement within multi-record groups -------------------------
let sevComparable = 0;
let sevDisagree = 0;
let rangeComparable = 0;
let rangeDisagree = 0;
for (const g of multiRecord) {
  const members = g.map((i) => records[i]);

  // Severity: COMPARABLE when >= 2 members carry severity of a common type
  // (same CVSS family, or both a database label); DISAGREE when a shared
  // type carries >= 2 distinct values across members.
  const typedVals = new Map(); // type -> Set of values
  const typedMembers = new Map(); // type -> number of members carrying it
  for (const m of members) {
    const perMemberTypes = new Map(); // type -> Set of values (this member)
    for (const sig of severitySigs(m)) {
      // sig = "<TYPE>:<value>" where TYPE is CVSS_V2/V3/V4 or LABEL.
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
  if (sharedSevTypes.length > 0) {
    sevComparable++;
    if (sharedSevTypes.some(([t]) => typedVals.get(t).size >= 2)) sevDisagree++;
  }

  // Ranges: a package is COMPARABLE when >= 2 members of the group describe
  // it; the group DISAGREES when any comparable package has >= 2 distinct
  // canonicalized range signatures across members.
  const pkgSigs = new Map(); // package -> Set of range signatures
  const perPkgMembers = new Map(); // package -> number of members describing it
  for (const m of members) {
    for (const [pkg, sig] of rangeSigs(m)) {
      const s = pkgSigs.get(pkg) ?? new Set();
      s.add(sig);
      pkgSigs.set(pkg, s);
      perPkgMembers.set(pkg, (perPkgMembers.get(pkg) ?? 0) + 1);
    }
  }
  const comparable = [...perPkgMembers.entries()].filter(([, n]) => n >= 2);
  if (comparable.length > 0) {
    rangeComparable++;
    if (comparable.some(([pkg]) => pkgSigs.get(pkg).size >= 2)) rangeDisagree++;
  }
}

const report = {
  probe: 'C1 vulnerability records — OSV bulk export, PyPI ecosystem',
  registration: 'pre-registration.md Amendment A2.7 (EXPLORATORY)',
  snapshot: {
    source: 'https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip',
    note: 'record the Last-Modified header of the download alongside this report',
  },
  records: records.length,
  recordsWithCveAlias: withCve,
  cveGroups: groups.size,
  cveGroupsWithMultipleRecords: multiRecord.length,
  crossRecordCoReferenceRate: multiRecord.length / groups.size,
  severity: {
    comparableGroups: sevComparable,
    disagreeingGroups: sevDisagree,
    disagreementRate: sevComparable > 0 ? sevDisagree / sevComparable : null,
  },
  affectedRanges: {
    comparableGroups: rangeComparable,
    disagreeingGroups: rangeDisagree,
    disagreementRate: rangeComparable > 0 ? rangeDisagree / rangeComparable : null,
  },
};

console.log(JSON.stringify(report, null, 2));
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
