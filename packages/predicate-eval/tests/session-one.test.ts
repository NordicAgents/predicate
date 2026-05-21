import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import {
  loadJudgmentCorpus, assertThursdayPreference, supersedeErrandPref, CORPUS_IRIS,
} from '../src/judgment-corpus.js';

const client = getAdapter();
const { J, TOP, cb, ops, per } = CORPUS_IRIS;
const adapter = new FusekiConstructAdapter(client);

function materialize(): ReturnType<typeof adapter.materialize> {
  return adapter.materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });
}

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>'); await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>'); await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await loadJudgmentCorpus(client);
  await materialize();
});

describe('session-one eval (PRD leading indicator)', () => {
  it('E1: why Tuesdays — returns the preference + rationale (no live source)', async () => {
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?why WHERE { GRAPH <kg:abox> {
        ?p a j:Preference ; j:about <${per}errandScheduling> ; j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.why?.value).toMatch(/Tuesdays/);
  });

  it('E3: why not Postgres — returns the rejected option + rationale', async () => {
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?rej ?why WHERE { GRAPH <kg:abox> {
        <${cb}eventStoreDecision> j:rejected ?rej ; j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.rej?.value).toBe(`${cb}postgresOption`);
    expect(r.results.bindings[0]?.why?.value).toMatch(/write amplification/);
  });

  it('E4: payments owner — reasoner MATERIALIZES UnresolvedConflict in kg:inferred', async () => {
    const aConf = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${cb}ownerJudgmentA> a j:UnresolvedConflict } }`);
    const bConf = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${cb}ownerJudgmentB> a j:UnresolvedConflict } }`);
    const merged = await client.ask(`PREFIX owl: <http://www.w3.org/2002/07/owl#> ASK { GRAPH <kg:inferred> { <${cb}teamPlatform> owl:sameAs <${cb}teamCheckout> } }`);
    expect(aConf).toBe(true);
    expect(bConf).toBe(true);
    expect(merged).toBe(false);
  });

  it('E5: blast radius — TRANSITIVE dependsOn reaches ledger via r03', async () => {
    // checkout -> billingEvents -> ledger and dunning -> billingEvents -> ledger.
    // Reaching ledger requires r03 transitivity; there is no direct edge to ledger.
    const r = await client.select(`
      PREFIX top: <${TOP}>
      SELECT ?dep WHERE {
        { GRAPH <kg:abox> { ?dep top:dependsOn <${ops}ledger> } }
        UNION
        { GRAPH <kg:inferred> { ?dep top:dependsOn <${ops}ledger> } }
      }
    `);
    const deps = r.results.bindings.map((b) => b.dep!.value);
    expect(deps).toContain(`${ops}checkout`);  // only via checkout->billingEvents->ledger
    expect(deps).toContain(`${ops}dunning`);   // only via dunning->billingEvents->ledger
  });

  it('E6: dunning owner — settled owner returned; losing source kept at low confidence', async () => {
    const settled = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:abox> { <${ops}dunningOwner> j:settledAs <${ops}teamBilling> } }`);
    expect(settled).toBe(true);
    const present = await client.ask(`ASK { GRAPH <kg:abox> { <${ops}runbookB> <${ops}claimsOwner> <${ops}teamGrowth> } }`);
    expect(present).toBe(true);
    const inferredLeak = await client.ask(`ASK { GRAPH <kg:inferred> { <${ops}runbookB> <${ops}claimsOwner> <${ops}teamGrowth> } }`);
    expect(inferredLeak).toBe(false);
  });

  it('E2: preference conflict then reconcile via supersession', async () => {
    await assertThursdayPreference(client);
    await materialize();
    const conflictBefore = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { ?x a j:UnresolvedConflict } GRAPH <kg:abox> { ?x j:about <${per}errandScheduling> } }`);
    expect(conflictBefore).toBe(true);

    await supersedeErrandPref(client);
    await materialize();
    const conflictAfter = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { ?x a j:UnresolvedConflict } GRAPH <kg:abox> { ?x j:about <${per}errandScheduling> } }`);
    expect(conflictAfter).toBe(false);
    const oldCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${per}errandPref> a j:Current } }`);
    const newCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${per}errandPrefNew> a j:Current } }`);
    expect(oldCurrent).toBe(false);
    expect(newCurrent).toBe(true);
  });
});
