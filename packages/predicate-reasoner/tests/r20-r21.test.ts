import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = getAdapter();

const J = 'https://industriagents.com/predicate/judgment#';

// Isolated abox/inferred graphs for r20 tests — avoids colliding with shared kg:abox / kg:inferred.
// Provenance MUST stay in kg:provenance because closureEligible hardcodes that graph.
const R20_ABOX = 'kg:abox-test-r20';
const R20_INF  = 'kg:inferred-test-r20';

beforeAll(async () => {
  await withJudgmentTBox(client);
});

async function resetR20(): Promise<void> {
  for (const g of [R20_ABOX, R20_INF]) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  // Clear only the r20 test's provenance entries by dropping and recreating
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
}

afterAll(async () => {
  for (const g of [R20_ABOX, R20_INF]) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
  }
});

/** Insert a triple into R20_ABOX with a kg:provenance entry so closureEligible includes it. */
async function withProv(s: string, p: string, o: string, conf = 1): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${R20_ABOX}>   { ${s} ${p} ${o} . }
      GRAPH <kg:provenance> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

async function materialize() {
  return new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox',
    aboxGraphs: [R20_ABOX],
    targetGraph: R20_INF,
    closureCutoff: 0.5,
  });
}

beforeEach(resetR20);

describe('judgment overlay', () => {
  it('loads j:settledAs as a ConflictFunctionalProperty (not owl:FunctionalProperty)', async () => {
    const isMarker = await client.ask(`
      PREFIX j: <https://industriagents.com/predicate/judgment#>
      ASK { GRAPH <kg:tbox> { j:settledAs a j:ConflictFunctionalProperty } }
    `);
    const isOwlFunctional = await client.ask(`
      PREFIX j:   <https://industriagents.com/predicate/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:settledAs a owl:FunctionalProperty } }
    `);
    expect(isMarker).toBe(true);
    expect(isOwlFunctional).toBe(false);
  });
});

describe('r20 current-judgment', () => {
  it('marks a non-superseded judgment as j:Current', async () => {
    // Insert j:Decision triple with provenance so r15 can propagate it to j:Judgment
    await withProv('<urn:jd:a>', 'a', `<${J}Decision>`);
    await materialize();
    const ok = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${R20_INF}> { <urn:jd:a> a j:Current } }
    `);
    expect(ok).toBe(true);
  });

  it('excludes a superseded judgment from j:Current', async () => {
    // Insert two judgments: old superseded by new (via j:supersedes on new)
    await withProv('<urn:jd:old>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:new>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:new>', `<${J}supersedes>`, '<urn:jd:old>');
    await materialize();
    const oldCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { <urn:jd:old> a j:Current } }`);
    const newCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { <urn:jd:new> a j:Current } }`);
    expect(oldCurrent).toBe(false);
    expect(newCurrent).toBe(true);
  });
});

describe('r21 unresolved-conflict', () => {
  it('flags two current decisions with different settledAs about the same subject', async () => {
    await withProv('<urn:jd:A>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:A>', `<${J}about>`, '<urn:payments>');
    await withProv('<urn:jd:A>', `<${J}settledAs>`, '<urn:teamPlatform>');
    await withProv('<urn:jd:B>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:B>', `<${J}about>`, '<urn:payments>');
    await withProv('<urn:jd:B>', `<${J}settledAs>`, '<urn:teamCheckout>');
    await materialize();
    const aConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { <urn:jd:A> a j:UnresolvedConflict } }`);
    const bConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { <urn:jd:B> a j:UnresolvedConflict } }`);
    const linked = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { <urn:jd:A> j:conflictsWith <urn:jd:B> } }`);
    const merged = await client.ask(`PREFIX owl: <http://www.w3.org/2002/07/owl#> ASK { GRAPH <${R20_INF}> { <urn:teamPlatform> owl:sameAs <urn:teamCheckout> } }`);
    expect(aConflict).toBe(true);
    expect(bConflict).toBe(true);
    expect(linked).toBe(true);
    expect(merged).toBe(false); // D4 footgun guard: no sameAs merge
  });

  it('suppresses the conflict once one judgment supersedes the other', async () => {
    await withProv('<urn:jd:A>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:A>', `<${J}about>`, '<urn:payments>');
    await withProv('<urn:jd:A>', `<${J}settledAs>`, '<urn:teamPlatform>');
    await withProv('<urn:jd:B>', 'a', `<${J}Decision>`);
    await withProv('<urn:jd:B>', `<${J}about>`, '<urn:payments>');
    await withProv('<urn:jd:B>', `<${J}settledAs>`, '<urn:teamCheckout>');
    await withProv('<urn:jd:B>', `<${J}supersedes>`, '<urn:jd:A>');
    await materialize();
    const anyConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <${R20_INF}> { ?x a j:UnresolvedConflict } }`);
    expect(anyConflict).toBe(false);
  });
});
