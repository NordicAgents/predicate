import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

const J = 'https://industriagents.com/predicate/judgment#';
const TOP = 'https://industriagents.com/predicate/top#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const cb = 'https://industriagents.com/predicate/corpus/codebase#';
const ops = 'https://industriagents.com/predicate/corpus/ops#';
const per = 'https://industriagents.com/predicate/corpus/personal#';

type Obj = { type: 'uri' | 'literal'; value: string };
function uri(v: string): Obj { return { type: 'uri', value: v }; }
function lit(v: string): Obj { return { type: 'literal', value: v }; }

async function a(client: StorageAdapter, s: string, p: string, o: Obj, conf = 0.9, src = 'judgment-corpus'): Promise<void> {
  await kgAssert(client, { subject: s, predicate: p, object: o, source: src, confidence: conf, method: 'corpus' });
}

export async function loadJudgmentCorpus(client: StorageAdapter = getAdapter()): Promise<void> {
  // ---------- Codebase: abandoned approach + ownership conflict ----------
  await a(client, `${cb}eventStoreDecision`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}eventStoreDecision`, `${J}about`, uri(`${cb}eventStore`));
  await a(client, `${cb}eventStoreDecision`, `${J}settledAs`, uri(`${cb}kafkaOption`));
  await a(client, `${cb}eventStoreDecision`, `${J}rejected`, uri(`${cb}postgresOption`));
  await a(client, `${cb}eventStoreDecision`, `${J}rationale`,
    lit('Postgres trialled 2026-02; abandoned — write amplification under fan-out exceeded budget. Kafka chosen for the append path.'));
  await a(client, `${cb}eventStoreDecision`, `${J}basedOn`, uri(`${cb}loadTest_2026_02`));
  await a(client, `${cb}eventStoreDecision`, `${J}basedOn`, uri(`${cb}incident_4471`));

  await a(client, `${cb}authFragility`, RDF_TYPE, uri(`${J}Assessment`));
  await a(client, `${cb}authFragility`, `${J}about`, uri(`${cb}authService`));
  await a(client, `${cb}authFragility`, `${J}rationale`,
    lit('Fragile: token refresh has no retry and shares a connection pool with billing; failed twice during billing spikes.'));
  await a(client, `${cb}authFragility`, `${J}basedOn`, uri(`${cb}incident_4471`));
  await a(client, `${cb}authFragility`, `${J}basedOn`, uri(`${cb}incident_4520`));

  // PLANTED CONTRADICTION: two decisions settle different owners for payments.
  await a(client, `${cb}ownerJudgmentA`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}ownerJudgmentA`, `${J}about`, uri(`${cb}paymentsModule`));
  await a(client, `${cb}ownerJudgmentA`, `${J}settledAs`, uri(`${cb}teamPlatform`));
  await a(client, `${cb}ownerJudgmentA`, `${J}rationale`, lit('Platform owns payments per 2026-03 reorg.'));
  await a(client, `${cb}ownerJudgmentA`, `${J}basedOn`, uri(`${cb}reorgDoc`));
  await a(client, `${cb}ownerJudgmentB`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}ownerJudgmentB`, `${J}about`, uri(`${cb}paymentsModule`));
  await a(client, `${cb}ownerJudgmentB`, `${J}settledAs`, uri(`${cb}teamCheckout`));
  await a(client, `${cb}ownerJudgmentB`, `${J}rationale`, lit('Checkout owns payments per on-call rotation.'));
  await a(client, `${cb}ownerJudgmentB`, `${J}basedOn`, uri(`${cb}pagerConfig`));

  // ---------- Ops: transitive topology + reconciled owner ----------
  // top:dependsOn is transitive (top.ttl) -> r03 gives blast radius.
  await a(client, `${ops}checkout`, `${TOP}dependsOn`, uri(`${ops}billingEvents`));
  await a(client, `${ops}billingEvents`, `${TOP}dependsOn`, uri(`${ops}ledger`));
  await a(client, `${ops}dunning`, `${TOP}dependsOn`, uri(`${ops}billingEvents`));

  await a(client, `${ops}dunningOwner`, RDF_TYPE, uri(`${J}Reconciliation`));
  await a(client, `${ops}dunningOwner`, `${J}about`, uri(`${ops}dunningConsumer`));
  await a(client, `${ops}dunningOwner`, `${J}settledAs`, uri(`${ops}teamBilling`));
  await a(client, `${ops}dunningOwner`, `${J}reconciledFrom`, uri(`${ops}runbookA`));
  await a(client, `${ops}dunningOwner`, `${J}reconciledFrom`, uri(`${ops}runbookB`));
  await a(client, `${ops}dunningOwner`, `${J}rationale`,
    lit('runbookA (current) overrides runbookB (last edited 14 months ago). Confirmed against the deploy that moved the consumer.'));

  // Declare the corpus-local predicate so kgAssert's gate accepts it, then assert
  // the LOSING source at LOW confidence (excluded from inference closure -> E6).
  await client.update(`INSERT DATA { GRAPH <kg:tbox-staging> {
    <${ops}claimsOwner> a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> } }`);
  await a(client, `${ops}runbookB`, `${ops}claimsOwner`, uri(`${ops}teamGrowth`), 0.3, 'runbookB');

  // ---------- Personal: standing preference (Tuesday) ----------
  await a(client, `${per}errandPref`, RDF_TYPE, uri(`${J}Preference`));
  await a(client, `${per}errandPref`, `${J}about`, uri(`${per}errandScheduling`));
  await a(client, `${per}errandPref`, `${J}prefers`, uri(`${per}tuesday`));
  await a(client, `${per}errandPref`, `${J}over`, uri(`${per}thursday`));
  await a(client, `${per}errandPref`, `${J}rationale`,
    lit('Tuesdays: lowest observed traffic on the route + a recurring free 2pm block. Inferred over ~3 months of calendar + traffic data.'));
  await a(client, `${per}errandPref`, `${J}basedOn`, uri(`${per}trafficObservations`));
  await a(client, `${per}errandPref`, `${J}basedOn`, uri(`${per}calendarPattern`));
}

// E2 helper: assert the newer conflicting preference (Thursday).
export async function assertThursdayPreference(client: StorageAdapter): Promise<void> {
  await a(client, `${per}errandPrefNew`, RDF_TYPE, uri(`${J}Preference`));
  await a(client, `${per}errandPrefNew`, `${J}about`, uri(`${per}errandScheduling`));
  await a(client, `${per}errandPrefNew`, `${J}prefers`, uri(`${per}thursday`));
  await a(client, `${per}errandPrefNew`, `${J}rationale`, lit('Recent: user moved standing 2pm meeting to Tuesdays.'));
  await a(client, `${per}errandPrefNew`, `${J}basedOn`, uri(`${per}calendarChange_2026_05`));
}

// E2 reconcile step: the new preference supersedes the old.
export async function supersedeErrandPref(client: StorageAdapter): Promise<void> {
  await a(client, `${per}errandPrefNew`, `${J}supersedes`, uri(`${per}errandPref`));
}

export const CORPUS_IRIS = { J, TOP, cb, ops, per };
