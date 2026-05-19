import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { PromotionSweeper } from 'predicate-agent/src/promotion-sweeper.js';

const META = 'https://predicate.dev/meta#';
const PROPOSAL_IRI = /^[A-Za-z][A-Za-z0-9+.-]*:[A-Za-z0-9:_./#-]+$/;

function help(): void {
  console.log(`predicate schema <verb> [args]

Verbs:
  list                    Print pending proposals from kg:tbox-staging as JSON.
  approve <proposalIri>   Force-promote a proposal (still runs validation).
  reject  <proposalIri>   Reject and remove a proposal from staging.
`);
}

async function listProposals(): Promise<number> {
  const client = new SparqlClient(loadConfig());
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?id ?kind ?justification ?motivatingGoal ?proposedAt ?expiresAt ?useCount
    WHERE {
      GRAPH <kg:tbox-staging> {
        ?id a pred:Proposal ;
            pred:kind          ?kind ;
            pred:justification ?justification ;
            pred:proposedAt    ?proposedAt ;
            pred:expiresAt     ?expiresAt ;
            pred:useCount      ?useCount .
        OPTIONAL { ?id pred:motivatingGoal ?motivatingGoal }
      }
    }
    ORDER BY ?expiresAt
    LIMIT 200
  `);
  const out = r.results.bindings.map((b) => ({
    id: b['id']!.value,
    kind: b['kind']!.value,
    justification: b['justification']!.value,
    motivatingGoal: b['motivatingGoal']?.value,
    proposedAt: b['proposedAt']!.value,
    expiresAt: b['expiresAt']!.value,
    useCount: parseInt(b['useCount']!.value, 10),
  }));
  process.stdout.write(JSON.stringify(out));
  return 0;
}

async function approveProposal(id: string): Promise<number> {
  if (!PROPOSAL_IRI.test(id)) {
    console.error(`predicate schema approve: invalid proposal IRI: ${id}`);
    return 2;
  }
  const client = new SparqlClient(loadConfig());
  const sweeper = new PromotionSweeper(client);
  const decision = await sweeper.promoteById(id, { actor: 'user-approve' });
  const ok = decision.outcome === 'promoted';
  process.stdout.write(JSON.stringify({ ok, ...decision }));
  return ok ? 0 : 1;
}

async function rejectProposal(id: string): Promise<number> {
  if (!PROPOSAL_IRI.test(id)) {
    console.error(`predicate schema reject: invalid proposal IRI: ${id}`);
    return 2;
  }
  const client = new SparqlClient(loadConfig());
  const sweeper = new PromotionSweeper(client);
  const decision = await sweeper.rejectById(id, {
    actor: 'user-reject',
    reason: 'rejected via dashboard',
  });
  const ok = decision.outcome === 'rejected-expired';
  process.stdout.write(JSON.stringify({ ok, ...decision }));
  return ok ? 0 : 1;
}

export async function schema(args: string[]): Promise<number> {
  const verb = args[0];
  switch (verb) {
    case 'list':    return listProposals();
    case 'approve': {
      const id = args[1];
      if (!id) { help(); return 2; }
      return approveProposal(id);
    }
    case 'reject': {
      const id = args[1];
      if (!id) { help(); return 2; }
      return rejectProposal(id);
    }
    case undefined:
    case '--help':
    case 'help': help(); return 0;
    default:
      console.error(`predicate schema: unknown verb: ${verb}`);
      help();
      return 2;
  }
}
