import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runFixpoint, runFixpointNaive } from '../src/fixpoint.js';
import { RULES } from '../src/rules/index.js';
import type { Rule, RuleConfig } from '../src/rules/types.js';

const client = getAdapter();
const J = 'https://industriagents.com/predicate/judgment#';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — worlds must be reproducible across runs.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Random-world generation. Each world exercises: owl:TransitiveProperty
// chains + branches, rdfs:subClassOf chains + branches, owl:inverseOf,
// rdfs:domain/range, rdfs:subPropertyOf, a j:SingleValued two-value conflict
// (r22) and an owl:disjointWith conflict on an INFERRED type (r11).
// Seed-scoped namespaces keep the global kg:provenance graph (keyed by
// triple content) free of cross-world contamination.
// ---------------------------------------------------------------------------
interface AboxTriple { s: string; p: string; o: string; conf: number; }
interface World {
  ns: string;
  tbox: string[];
  abox: AboxTriple[];
  chainLen: number;
  clsLen: number;
}

function generateWorld(seed: number): World {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const ns = `https://ex/sn${seed}/`;
  const iri = (n: string): string => `<${ns}${n}>`;
  const tbox: string[] = [];
  const abox: AboxTriple[] = [];

  // Transitive property chain with forward-only branches (acyclic keeps the
  // closure small enough for the naive reference engine to stay fast).
  tbox.push(`${iri('link')} a owl:TransitiveProperty .`);
  tbox.push(`${iri('linkedFrom')} owl:inverseOf ${iri('link')} .`);
  const chainLen = int(8, 16);
  for (let i = 0; i < chainLen; i++) {
    abox.push({ s: iri(`n${i}`), p: iri('link'), o: iri(`n${i + 1}`), conf: 0.9 });
  }
  const branches = int(2, 4);
  for (let b = 0; b < branches; b++) {
    const at = int(0, chainLen - 1);
    abox.push({ s: iri(`n${at}`), p: iri('link'), o: iri(`br${b}`), conf: 0.9 });
    abox.push({ s: iri(`br${b}`), p: iri('link'), o: iri(`n${int(at + 1, chainLen)}`), conf: 0.9 });
  }
  // A sub-cutoff edge that the closure gate must exclude in BOTH engines.
  abox.push({ s: iri('lowConf'), p: iri('link'), o: iri('n0'), conf: 0.2 });

  // subClassOf chain with branches, plus an instance typed at the bottom
  // (r15 propagates it all the way up).
  const clsLen = int(6, 12);
  for (let i = 0; i < clsLen; i++) {
    tbox.push(`${iri(`C${i}`)} rdfs:subClassOf ${iri(`C${i + 1}`)} .`);
  }
  const clsBranches = int(1, 3);
  for (let b = 0; b < clsBranches; b++) {
    tbox.push(`${iri(`CB${b}`)} rdfs:subClassOf ${iri(`C${int(0, clsLen)}`)} .`);
  }
  abox.push({ s: iri('inst0'), p: 'rdf:type', o: iri('C0'), conf: 0.9 });

  // domain / range
  tbox.push(`${iri('worksAt')} rdfs:domain ${iri('Employee')} .`);
  tbox.push(`${iri('worksAt')} rdfs:range ${iri('Org')} .`);
  abox.push({ s: iri('emp0'), p: iri('worksAt'), o: iri('org0'), conf: 0.9 });

  // subPropertyOf chain + an instance triple (r02 + r16)
  tbox.push(`${iri('p0')} rdfs:subPropertyOf ${iri('p1')} .`);
  tbox.push(`${iri('p1')} rdfs:subPropertyOf ${iri('p2')} .`);
  abox.push({ s: iri('a0'), p: iri('p0'), o: iri('a1'), conf: 0.9 });

  // r22: two closure-eligible values on a j:SingleValued property
  tbox.push(`${iri('reportsTo')} a j:SingleValued .`);
  abox.push({ s: iri('lee'), p: iri('reportsTo'), o: iri('omar'), conf: 0.9 });
  abox.push({ s: iri('lee'), p: iri('reportsTo'), o: iri('nadia'), conf: 0.9 });

  // r11: disjointWith conflict where ONE of the two types is only reachable
  // through the inferred subclass chain (C0 ⊑ … ⊑ C_clsLen ⊑ DA).
  tbox.push(`${iri('DA')} owl:disjointWith ${iri('DB')} .`);
  tbox.push(`${iri(`C${clsLen}`)} rdfs:subClassOf ${iri('DA')} .`);
  abox.push({ s: iri('inst0'), p: 'rdf:type', o: iri('DB'), conf: 0.9 });

  // Cross-rule feeds into r01/r02's lean work graphs (the semi-naive engine's
  // riskiest mechanism): the ONLY route across these bridges is an
  // equivalence-derived (r12/r13) inferred edge, which must flow
  // engine-delta → work graph W for the closure to cross.
  tbox.push(`${iri('E0')} rdfs:subClassOf ${iri('E1')} .`);
  tbox.push(`${iri('E1')} owl:equivalentClass ${iri('E1b')} .`);
  tbox.push(`${iri('E1b')} rdfs:subClassOf ${iri('E2')} .`);
  abox.push({ s: iri('einst'), p: 'rdf:type', o: iri('E0'), conf: 0.9 });
  tbox.push(`${iri('q0')} rdfs:subPropertyOf ${iri('q1')} .`);
  tbox.push(`${iri('q1')} owl:equivalentProperty ${iri('q1b')} .`);
  tbox.push(`${iri('q1b')} rdfs:subPropertyOf ${iri('q2')} .`);
  abox.push({ s: iri('qa'), p: iri('q0'), o: iri('qb'), conf: 0.9 });

  // subClassOf 3-cycle — the r01 path evaluator must terminate and still
  // close every cross-member edge.
  tbox.push(`${iri('Y0')} rdfs:subClassOf ${iri('Y1')} .`);
  tbox.push(`${iri('Y1')} rdfs:subClassOf ${iri('Y2')} .`);
  tbox.push(`${iri('Y2')} rdfs:subClassOf ${iri('Y0')} .`);

  // Cross-record conflict chain (r14 hasKey → sameAs, r23 value propagation,
  // r22 flag): two records co-referent ONLY through a shared literal key,
  // holding different values on a j:SingleValued property.
  tbox.push(`${iri('Rec')} owl:hasKey ( ${iri('key')} ) .`);
  tbox.push(`${iri('slot')} a j:SingleValued .`);
  for (const [r, val] of [['recA', 'slotV1'], ['recB', 'slotV2']] as const) {
    abox.push({ s: iri(r), p: 'rdf:type', o: iri('Rec'), conf: 0.9 });
    abox.push({ s: iri(r), p: iri('key'), o: `"k-${seed}"`, conf: 0.9 });
    abox.push({ s: iri(r), p: iri('slot'), o: iri(val), conf: 0.9 });
  }

  return { ns, tbox, abox, chainLen, clsLen };
}

// ---------------------------------------------------------------------------
// Store plumbing
// ---------------------------------------------------------------------------
const PREFIXES = `
  PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl:  <http://www.w3.org/2002/07/owl#>
  PREFIX j:    <${J}>
  PREFIX pred: <https://industriagents.com/predicate/meta#>
  PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
`;

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function loadWorld(w: World, tboxGraph: string, aboxGraph: string): Promise<void> {
  await reset(tboxGraph);
  await reset(aboxGraph);
  await client.update(`${PREFIXES}
    INSERT DATA { GRAPH <${tboxGraph}> {
      ${w.tbox.join('\n      ')}
    } }
  `);
  const aboxLines = w.abox.map((t) => `${t.s} ${t.p} ${t.o} .`).join('\n      ');
  const provLines = w.abox
    .map((t) => `<< ${t.s} ${t.p} ${t.o} >> pred:confidence "${t.conf}"^^xsd:decimal .`)
    .join('\n      ');
  await client.update(`${PREFIXES}
    INSERT DATA {
      GRAPH <${aboxGraph}>      { ${aboxLines} }
      GRAPH <kg:provenance>     { ${provLines} }
    }
  `);
}

/** Triples in graph a that are missing from graph b, rendered for assertion output. */
async function missingFrom(a: string, b: string): Promise<string[]> {
  const r = await client.select(`
    SELECT ?s ?p ?o WHERE {
      GRAPH <${a}> { ?s ?p ?o }
      FILTER NOT EXISTS { GRAPH <${b}> { ?s ?p ?o } }
    }
  `);
  return r.results.bindings.map((x) => `${x.s!.value} ${x.p!.value} ${x.o!.value}`);
}

const cfgFor = (tbox: string, abox: string, inferred: string): RuleConfig => ({
  tboxGraph: tbox,
  aboxGraphs: [abox],
  inferredGraph: inferred,
  closureCutoff: 0.5,
});

// ---------------------------------------------------------------------------
// Equivalence property test: naive and semi-naive engines must compute the
// IDENTICAL least fixpoint on every seeded world.
// ---------------------------------------------------------------------------
const SEEDS = [11, 23, 37, 42, 59];

describe('semi-naive fixpoint — equivalence with the naive engine', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: identical inferred triple sets`, async () => {
      const w = generateWorld(seed);
      const T = `kg:tbox-sn-${seed}`;
      const A = `kg:abox-sn-${seed}`;
      const IN = `kg:inf-sn-naive-${seed}`;
      const IS = `kg:inf-sn-semi-${seed}`;
      await loadWorld(w, T, A);
      await reset(IN);
      await reset(IS);

      const naive = await runFixpointNaive(client, RULES, cfgFor(T, A, IN));
      const semi = await runFixpoint(client, RULES, cfgFor(T, A, IS));

      expect(semi.inferredCount).toBe(naive.inferredCount);
      expect(await missingFrom(IN, IS)).toEqual([]);
      expect(await missingFrom(IS, IN)).toEqual([]);

      // The worlds really exercise the conflict rules …
      const valueConflict = await client.ask(`
        PREFIX j: <${J}>
        ASK { GRAPH <${IS}> { <${w.ns}lee> a j:ValueConflict ; j:conflictOn <${w.ns}reportsTo> } }
      `);
      expect(valueConflict).toBe(true);
      const disjointConflict = await client.ask(`
        PREFIX j: <${J}>
        ASK { GRAPH <${IS}> { <${w.ns}inst0> a j:DisjointClassConflict } }
      `);
      expect(disjointConflict).toBe(true);
      // … and the transitive machinery (full chain reach + inverse).
      const reach = await client.ask(`
        ASK { GRAPH <${IS}> { <${w.ns}n0> <${w.ns}link> <${w.ns}n${w.chainLen}> } }
      `);
      expect(reach).toBe(true);
      const inverse = await client.ask(`
        ASK { GRAPH <${IS}> { <${w.ns}n${w.chainLen}> <${w.ns}linkedFrom> <${w.ns}n0> } }
      `);
      expect(inverse).toBe(true);

      // Cross-rule feeds: these conclusions exist ONLY via r12/r13-derived
      // inferred edges flowing through the engine delta into r01/r02's work
      // graphs — the mechanism the design deviation introduced.
      const PR = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`;
      expect(await client.ask(`${PR}
        ASK { GRAPH <${IS}> { <${w.ns}E0> rdfs:subClassOf <${w.ns}E2> } }`)).toBe(true);
      expect(await client.ask(`${PR}
        ASK { GRAPH <${IS}> { <${w.ns}einst> rdf:type <${w.ns}E2> } }`)).toBe(true);
      expect(await client.ask(`${PR}
        ASK { GRAPH <${IS}> { <${w.ns}qa> <${w.ns}q2> <${w.ns}qb> } }`)).toBe(true);
      // Cycle closed without divergence (r01's a != c guard excludes self-loops).
      expect(await client.ask(`${PR}
        ASK { GRAPH <${IS}> { <${w.ns}Y2> rdfs:subClassOf <${w.ns}Y1> } }`)).toBe(true);

      // Cross-record chain (r14 → r23 → r22): both key-co-referent records flagged.
      for (const r of ['recA', 'recB']) {
        expect(await client.ask(`
          PREFIX j: <${J}>
          ASK { GRAPH <${IS}> { <${w.ns}${r}> a j:ValueConflict } }`), `${r} flagged`).toBe(true);
      }

      // The sub-cutoff edge produced NO derived triples (direct gate check,
      // not just naive-vs-semi equivalence).
      expect(await client.ask(`
        ASK { GRAPH <${IS}> { <${w.ns}lowConf> <${w.ns}link> <${w.ns}n1> } }`)).toBe(false);

      // Bookkeeping AND rule-owned aux graphs are dropped on the way out.
      expect(await client.ask(`ASK { GRAPH <${IS}-prev>  { ?s ?p ?o } }`)).toBe(false);
      expect(await client.ask(`ASK { GRAPH <${IS}-delta> { ?s ?p ?o } }`)).toBe(false);
      for (const aux of ['r01w', 'r01o', 'r02w', 'r02o']) {
        expect(await client.ask(`ASK { GRAPH <${IS}-delta-${aux}> { ?s ?p ?o } }`)).toBe(false);
      }
    }, 30_000);
  }
});

describe('semi-naive fixpoint — fallback and doubling', () => {
  it('rules stripped of deltaInsertWhere still converge to the identical closure', async () => {
    const w = generateWorld(101);
    const T = 'kg:tbox-sn-fallback';
    const A = 'kg:abox-sn-fallback';
    const ID = 'kg:inf-sn-fallback-delta';
    const IF = 'kg:inf-sn-fallback-full';
    await loadWorld(w, T, A);
    await reset(ID);
    await reset(IF);

    const stripped: Rule[] = RULES.map((r) => {
      const clone: Rule = { ...r };
      delete clone.deltaInsertWhere;
      return clone;
    });
    const withDelta = await runFixpoint(client, RULES, cfgFor(T, A, ID));
    const fullOnly = await runFixpoint(client, stripped, cfgFor(T, A, IF));

    expect(fullOnly.inferredCount).toBe(withDelta.inferredCount);
    expect(await missingFrom(ID, IF)).toEqual([]);
    expect(await missingFrom(IF, ID)).toEqual([]);
  }, 30_000);

  it('a 200-step subclass chain converges in ~log2(n) rounds (doubling preserved)', async () => {
    const T = 'kg:tbox-sn-chain200';
    const A = 'kg:abox-sn-chain200';
    const I = 'kg:inf-sn-chain200';
    await reset(T);
    await reset(A);
    await reset(I);
    const lines: string[] = [];
    for (let i = 0; i < 200; i++) {
      lines.push(`<https://ex/snchain/c${i}> rdfs:subClassOf <https://ex/snchain/c${i + 1}> .`);
    }
    await client.update(`${PREFIXES}
      INSERT DATA { GRAPH <${T}> { ${lines.join('\n        ')} } }
    `);

    const r = await runFixpoint(client, RULES, cfgFor(T, A, I));
    // Doubling: paths of length 2^k after k rounds → 200 needs 8 + 1 stability
    // round. A linear (delta JOIN full only) evaluation would need 200 rounds
    // and trip the 30-iteration cap instead.
    expect(r.iterations).toBeLessThanOrEqual(12);
    const reach = await client.ask(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { <https://ex/snchain/c0> rdfs:subClassOf <https://ex/snchain/c200> } }
    `);
    expect(reach).toBe(true);
  }, 60_000);

  it('a 200-step owl:TransitiveProperty ABOX chain converges within the doubling bound (r03 join variants)', async () => {
    // r01/r02 use the native property-path route, so the chain200 test above no
    // longer exercises the (delta JOIN full) UNION (full JOIN delta) doubling
    // shape. r03's predicate is a tbox-bound VARIABLE (property paths need
    // constant IRIs), so it keeps the join variants — this test would trip the
    // 30-iteration cap under a linear-only regression there.
    const NS = 'https://ex/snr03chain/';
    const T = 'kg:tbox-sn-r03chain';
    const A = 'kg:abox-sn-r03chain';
    const I = 'kg:inf-sn-r03chain';
    await reset(T);
    await reset(A);
    await reset(I);
    await client.update(`${PREFIXES}
      INSERT DATA { GRAPH <${T}> { <${NS}link> a owl:TransitiveProperty . } }
    `);
    const abox: string[] = [];
    const prov: string[] = [];
    for (let i = 0; i < 200; i++) {
      abox.push(`<${NS}m${i}> <${NS}link> <${NS}m${i + 1}> .`);
      prov.push(`<< <${NS}m${i}> <${NS}link> <${NS}m${i + 1}> >> pred:confidence "0.9"^^xsd:decimal .`);
    }
    await client.update(`${PREFIXES}
      INSERT DATA {
        GRAPH <${A}>          { ${abox.join('\n        ')} }
        GRAPH <kg:provenance> { ${prov.join('\n        ')} }
      }
    `);

    const r = await runFixpoint(client, RULES, cfgFor(T, A, I));
    expect(r.iterations).toBeLessThanOrEqual(12);
    const reach = await client.ask(`
      ASK { GRAPH <${I}> { <${NS}m0> <${NS}link> <${NS}m200> } }
    `);
    expect(reach).toBe(true);
  }, 120_000);
});
