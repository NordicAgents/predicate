import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import type {
  DeltaQuad, ProposalMeta, SchemaDelta, Term,
} from './types.js';

const META = 'https://predicate.dev/meta#';
const DEFAULT_TTL_DAYS = 7;

function newProposalId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `urn:predicate:proposal:P-${ts}-${rand}`;
}

function newEventId(kind: string): string {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderTerm(t: Term): string {
  if (t.type === 'uri') return escapeIRI(t.value);
  if (t.datatype) return `${escapeLiteral(t.value)}^^${escapeIRI(t.datatype)}`;
  return escapeLiteral(t.value);
}

function tripleSparql(q: DeltaQuad): string {
  return `${escapeIRI(q.s)} ${escapeIRI(q.p)} ${renderTerm(q.o)}`;
}

export interface ProposeInput {
  justification: string;
  motivatingGoal?: string;
  ttlDays?: number;
}

export class SchemaProposer {
  constructor(private client: StorageAdapter) {}

  async propose(delta: SchemaDelta, meta: ProposeInput): Promise<string> {
    const id = newProposalId();
    const proposedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + (meta.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000,
    ).toISOString();

    const triplesToTag: DeltaQuad[] = [...delta.add];
    if (delta.shapes) triplesToTag.push(...delta.shapes);

    const tagTripleStmts = triplesToTag.map((q) => `
      << ${tripleSparql(q)} >>
        pred:proposalId ${escapeIRI(id)} .
      ${tripleSparql(q)} .
    `).join('\n');

    const goalLine = meta.motivatingGoal
      ? `${escapeIRI(id)} pred:motivatingGoal ${escapeIRI(meta.motivatingGoal)} .`
      : '';
    const parentLine = delta.kind === 'refine-class'
      ? `${escapeIRI(id)} pred:parent ${escapeIRI(delta.parent)} .`
      : '';
    const migrationLine = delta.kind === 'breaking'
      ? `${escapeIRI(id)} pred:migration ${escapeLiteral(delta.migration)} .`
      : '';

    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox-staging> {
          ${tagTripleStmts}
          ${escapeIRI(id)} a pred:Proposal ;
            pred:kind          ${escapeLiteral(delta.kind)} ;
            pred:justification ${escapeLiteral(meta.justification)} ;
            pred:proposedAt    "${proposedAt}"^^xsd:dateTime ;
            pred:expiresAt     "${expiresAt}"^^xsd:dateTime ;
            pred:useCount      "0"^^xsd:integer .
          ${goalLine}
          ${parentLine}
          ${migrationLine}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-proposed'))} a pred:SchemaProposed ;
            pred:at    "${proposedAt}"^^xsd:dateTime ;
            pred:actor "SchemaProposer" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({
              kind: delta.kind, justification: meta.justification,
              motivatingGoal: meta.motivatingGoal,
            }))} .
        }
      }
    `);
    return id;
  }
}

export type { ProposalMeta };
