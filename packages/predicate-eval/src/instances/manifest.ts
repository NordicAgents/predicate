import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { InstanceKind, InstanceRecord } from './types.js';
import { tripleId } from './types.js';
import { deriveV3Instances, isV3Oracle } from './v3.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

interface OracleFact { s: string; p: string; o: string; lit?: boolean; episode: number }
interface OracleConflict { id: string; about: string; predicate: string; values: string[]; episode: number }
interface OracleCoref { records: [string, string]; email: string; conflicted: boolean }
interface OracleBenignV1 {
  duplicateReassertions?: Array<{ s: string; p: string; o: string }>;
  multiValuedAdditions?: Array<{ s: string; p: string; o: string }>;
  sharedObjectSubjects?: Array<{ s: string; p: string; o: string }>;
}
interface OracleBenignV2 { benignCoreferences?: string[][]; sharedOfficeSubjects?: string[] }
interface Oracle {
  facts: OracleFact[];
  conflicts: OracleConflict[];
  coreference?: OracleCoref[];
  benign?: OracleBenignV1 & OracleBenignV2;
}

/** Last path segment of an IRI: http://ex/cb2/s1-p048 -> "s1-p048". */
const localName = (iri: string): string => iri.slice(Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#')) + 1);
/** Person token of a v2 record local name: "s1-p048" -> "p048". */
const personToken = (iri: string): string => localName(iri).replace(/^s\d+-/, '');

const KIND_RANK: Record<InstanceKind, number> = {
  conflict: 0,
  'benign-coreference': 1,
  'benign-shared-value': 2,
  'benign-duplicate': 3,
  'benign-multivalued': 4,
  'benign-temporal': 5,
  'benign-scoped': 6,
};

interface FactIndex {
  /** distinct objects per "s|p", in facts (= episode) order */
  bySP: Map<string, string[]>;
  /** all asserted "s|p|o" ids */
  ids: Set<string>;
  /** facts per subject, in facts order */
  byS: Map<string, OracleFact[]>;
}

function indexFacts(facts: OracleFact[]): FactIndex {
  const bySP = new Map<string, string[]>();
  const ids = new Set<string>();
  const byS = new Map<string, OracleFact[]>();
  for (const f of facts) {
    const sp = `${f.s}|${f.p}`;
    const vals = bySP.get(sp) ?? [];
    if (!vals.includes(f.o)) vals.push(f.o);
    bySP.set(sp, vals);
    ids.add(tripleId(f.s, f.p, f.o));
    const sf = byS.get(f.s) ?? [];
    sf.push(f);
    byS.set(f.s, sf);
  }
  return { bySP, ids, byS };
}

/**
 * j:SingleValued property IRIs declared in world.ttl. A deliberately narrow
 * textual parse (subject-position "pfx:name a ..., j:SingleValued" lines with
 * @prefix expansion) — enough for the frozen mechanism-v0 fixture TBoxes
 * without pulling in a Turtle parser dependency.
 */
export function parseSingleValuedProps(worldTtl: string): Set<string> {
  const prefixes = new Map<string, string>();
  for (const m of worldTtl.matchAll(/@prefix\s+([\w-]*):\s*<([^>]+)>/g)) prefixes.set(m[1]!, m[2]!);
  const out = new Set<string>();
  for (const m of worldTtl.matchAll(/^([\w-]+):([\w-]+)\s+a\s+([^;.]*)/gm)) {
    if (/\bj:SingleValued\b/.test(m[3]!)) {
      const ns = prefixes.get(m[1]!);
      if (ns !== undefined) out.add(ns + m[2]!);
    }
  }
  return out;
}

function requireWitness(ids: Set<string>, witness: string[], instanceId: string): string[] {
  for (const w of witness) {
    if (!ids.has(w)) throw new Error(`goldWitness triple not found in oracle facts for ${instanceId}: ${w}`);
  }
  return witness;
}

function singleValue(idx: FactIndex, s: string, p: string, instanceId: string): string {
  const vals = idx.bySP.get(`${s}|${p}`) ?? [];
  if (vals.length !== 1) {
    throw new Error(`${instanceId}: expected exactly 1 value for <${s}> <${p}>, got [${vals.join(', ')}]`);
  }
  return vals[0]!;
}

/** v2 (cross-record) manifest: coreference-driven pairs + shared-value FP pair. */
function buildV2(domain: string, oracle: Oracle, idx: FactIndex, singleValued: Set<string>): InstanceRecord[] {
  const out: InstanceRecord[] = [];
  const conflictsByAbout = new Map(oracle.conflicts.map((c) => [c.about, c]));

  const emailPredOf = (s: string, email: string, instanceId: string): string => {
    const f = (idx.byS.get(s) ?? []).find((x) => x.lit === true && x.o === email);
    if (!f) throw new Error(`${instanceId}: no key-literal fact <${s}> ? "${email}" in oracle facts`);
    return f.p;
  };
  const typeOf = (s: string, instanceId: string): string => singleValue(idx, s, RDF_TYPE, instanceId);

  for (const coref of oracle.coreference ?? []) {
    const [s1, s2] = coref.records;
    const person = coref.email.split('@')[0]!;
    if (coref.conflicted) {
      const c = conflictsByAbout.get(s1) ?? conflictsByAbout.get(s2);
      if (!c) throw new Error(`no conflicts[] entry for conflicted pair ${s1} / ${s2}`);
      const id = `${domain}#pair-${person}`;
      const [v1, v2] = [c.values[0]!, c.values[1]!];
      const witness = [
        tripleId(s1, RDF_TYPE, typeOf(s1, id)),
        tripleId(s2, RDF_TYPE, typeOf(s2, id)),
        tripleId(s1, emailPredOf(s1, coref.email, id), coref.email),
        tripleId(s2, emailPredOf(s2, coref.email, id), coref.email),
        tripleId(s1, c.predicate, v1),
        tripleId(s2, c.predicate, v2),
      ];
      out.push({
        id, domain, kind: 'conflict', subjects: [s1, s2], key: coref.email,
        predicate: c.predicate, goldValues: [v1, v2],
        goldWitness: requireWitness(idx.ids, witness, id), isConflict: true,
      });
    } else {
      const id = `${domain}#benign-coreference-${person}`;
      // The sparse session-2 record asserts exactly one j:SingleValued
      // property (the re-stated, agreeing value) — that is the predicate
      // under test for this benign pair.
      const svFacts = (idx.byS.get(s2) ?? []).filter((f) => singleValued.has(f.p));
      const preds = [...new Set(svFacts.map((f) => f.p))];
      if (preds.length !== 1) {
        throw new Error(`${id}: expected 1 single-valued predicate on ${s2}, got [${preds.join(', ')}]`);
      }
      const p = preds[0]!;
      const vs1 = singleValue(idx, s1, p, id);
      const vs2 = singleValue(idx, s2, p, id);
      const witness = [
        tripleId(s1, RDF_TYPE, typeOf(s1, id)),
        tripleId(s2, RDF_TYPE, typeOf(s2, id)),
        tripleId(s1, emailPredOf(s1, coref.email, id), coref.email),
        tripleId(s2, emailPredOf(s2, coref.email, id), coref.email),
        tripleId(s1, p, vs1),
        tripleId(s2, p, vs2),
      ];
      out.push({
        id, domain, kind: 'benign-coreference', subjects: [s1, s2], key: coref.email,
        predicate: p, goldValues: [...new Set([vs1, vs2])],
        goldWitness: requireWitness(idx.ids, witness, id), isConflict: false,
      });
    }
  }

  // Shared-value FP pair: two DIFFERENT people (no shared key) that must NOT
  // be flagged. Prefer the alphabetically first j:SingleValued predicate on
  // which their values genuinely intersect (the slice's namesake). The v2
  // generator does not force the pair to share an office, so when nothing is
  // shared (measured: conflict-xr-scale p121/p287 share no value on any
  // property) fall back to the domain's conflict predicate with the pair's
  // own — distinct — values; the instance remains a valid benign probe.
  const shared = oracle.benign?.sharedOfficeSubjects ?? [];
  if (shared.length >= 2) {
    const [a, b] = [shared[0]!, shared[1]!];
    const id = `${domain}#benign-shared-value-${personToken(a)}-${personToken(b)}`;
    let picked: { p: string; values: string[] } | null = null;
    for (const p of [...singleValued].sort()) {
      const va = idx.bySP.get(`${a}|${p}`) ?? [];
      const vb = idx.bySP.get(`${b}|${p}`) ?? [];
      const common = va.filter((v) => vb.includes(v)).sort();
      if (common.length > 0) { picked = { p, values: [common[0]!] }; break; }
    }
    if (!picked) {
      const p = oracle.conflicts[0]?.predicate ?? [...singleValued].sort()[0];
      if (p === undefined) throw new Error(`${id}: no predicate available for shared-value fallback`);
      picked = { p, values: [...new Set([singleValue(idx, a, p, id), singleValue(idx, b, p, id)])] };
    }
    const witness = picked.values.length === 1
      ? [tripleId(a, picked.p, picked.values[0]!), tripleId(b, picked.p, picked.values[0]!)]
      : [tripleId(a, picked.p, picked.values[0]!), tripleId(b, picked.p, picked.values[1]!)];
    out.push({
      id, domain, kind: 'benign-shared-value', subjects: [a, b], key: null,
      predicate: picked.p, goldValues: picked.values,
      goldWitness: requireWitness(idx.ids, witness, id), isConflict: false,
    });
  }
  return out;
}

/** v1 (same-subject) manifest: conflicts[] + the three benign slices. */
function buildV1(domain: string, oracle: Oracle, idx: FactIndex): InstanceRecord[] {
  const out: InstanceRecord[] = [];
  for (const c of oracle.conflicts) {
    const id = `${domain}#subject-${localName(c.about)}`;
    const witness = c.values.map((v) => tripleId(c.about, c.predicate, v));
    out.push({
      id, domain, kind: 'conflict', subjects: [c.about], key: null,
      predicate: c.predicate, goldValues: [...c.values],
      goldWitness: requireWitness(idx.ids, witness, id), isConflict: true,
    });
  }
  for (const d of oracle.benign?.duplicateReassertions ?? []) {
    const id = `${domain}#benign-duplicate-${localName(d.s)}`;
    out.push({
      id, domain, kind: 'benign-duplicate', subjects: [d.s], key: null,
      predicate: d.p, goldValues: [d.o],
      goldWitness: requireWitness(idx.ids, [tripleId(d.s, d.p, d.o)], id), isConflict: false,
    });
  }
  // Multi-valued additions are listed one-per-added-object; merge by (s, p)
  // into one instance whose goldValues are ALL values that subject holds.
  const multiBySP = new Map<string, { s: string; p: string }>();
  for (const m of oracle.benign?.multiValuedAdditions ?? []) {
    multiBySP.set(`${m.s}|${m.p}`, { s: m.s, p: m.p });
  }
  for (const { s, p } of multiBySP.values()) {
    const id = `${domain}#benign-multivalued-${localName(s)}`;
    const values = idx.bySP.get(`${s}|${p}`) ?? [];
    if (values.length < 2) throw new Error(`${id}: expected >=2 values for <${s}> <${p}>, got ${values.length}`);
    const witness = values.map((v) => tripleId(s, p, v));
    out.push({
      id, domain, kind: 'benign-multivalued', subjects: [s], key: null,
      predicate: p, goldValues: [...values],
      goldWitness: requireWitness(idx.ids, witness, id), isConflict: false,
    });
  }
  for (const sh of oracle.benign?.sharedObjectSubjects ?? []) {
    const id = `${domain}#benign-shared-value-${localName(sh.s)}`;
    out.push({
      id, domain, kind: 'benign-shared-value', subjects: [sh.s], key: null,
      predicate: sh.p, goldValues: [sh.o],
      goldWitness: requireWitness(idx.ids, [tripleId(sh.s, sh.p, sh.o)], id), isConflict: false,
    });
  }
  return out;
}

/**
 * Derive the InstanceRecord[] manifest for a fixture directory (v1 same-subject
 * or v2 cross-record, auto-detected by the presence of oracle.coreference).
 * Deterministic: ordered by kind (conflict first) then id; throws if any
 * goldWitness triple is not present in oracle.facts or ids collide.
 */
export function buildInstanceManifest(fixtureDir: string): InstanceRecord[] {
  const dir = resolve(fixtureDir);
  const domain = basename(dir);
  const oracle = JSON.parse(readFileSync(join(dir, 'oracle.json'), 'utf8')) as Oracle;
  const world = readFileSync(join(dir, 'world.ttl'), 'utf8');
  const idx = indexFacts(oracle.facts);
  const singleValued = parseSingleValuedProps(world);

  // phase1-v3 oracles (Amendment A2) carry explicit groups + witnesses and
  // share ONE derivation across all arms (src/instances/v3.ts).
  const instances = isV3Oracle(oracle)
    ? deriveV3Instances(domain, oracle)
    : Array.isArray(oracle.coreference)
      ? buildV2(domain, oracle, idx, singleValued)
      : buildV1(domain, oracle, idx);

  instances.sort((a, b) =>
    KIND_RANK[a.kind] - KIND_RANK[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const seen = new Set<string>();
  for (const i of instances) {
    if (seen.has(i.id)) throw new Error(`duplicate instance id: ${i.id}`);
    seen.add(i.id);
  }
  return instances;
}

/** Read a previously written fixtures/<domain>/instances.json. */
export function loadInstances(fixtureDir: string): InstanceRecord[] {
  const path = join(resolve(fixtureDir), 'instances.json');
  return JSON.parse(readFileSync(path, 'utf8')) as InstanceRecord[];
}
