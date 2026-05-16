import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeLiteral, escapeIRI } from 'predicate-mcp/src/sparql/escape.js';
import type { Goal, GoalStatus } from './types.js';

const META = 'https://predicate.dev/meta#';

function newGoalId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `urn:predicate:goal:G-${ts}-${rand}`;
}

function newEventId(kind: string): string {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateGoalInput {
  statement: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
}

export class GoalStore {
  constructor(private client: SparqlClient) {}

  async create(input: CreateGoalInput): Promise<Goal> {
    const id = newGoalId();
    const now = new Date().toISOString();
    const goal: Goal = {
      id,
      statement: input.statement,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      source: input.source,
      parentGoal: input.parentGoal,
    };

    const parentTriple = input.parentGoal
      ? `${escapeIRI(id)} pred:parentGoal ${escapeIRI(input.parentGoal)} .`
      : '';

    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} a pred:Goal ;
            pred:statement ${escapeLiteral(input.statement)} ;
            pred:status    "active" ;
            pred:createdAt "${now}"^^xsd:dateTime ;
            pred:updatedAt "${now}"^^xsd:dateTime ;
            pred:source    "${input.source}" .
          ${parentTriple}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('goal-created'))} a pred:GoalCreated ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "GoalStore" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ statement: input.statement, source: input.source }))} .
        }
      }
    `);
    return goal;
  }

  async get(id: string): Promise<Goal | null> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?statement ?status ?createdAt ?updatedAt ?source ?parent WHERE {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} pred:statement ?statement ;
                            pred:status    ?status ;
                            pred:createdAt ?createdAt ;
                            pred:updatedAt ?updatedAt ;
                            pred:source    ?source .
          OPTIONAL { ${escapeIRI(id)} pred:parentGoal ?parent }
        }
      } LIMIT 1
    `);
    const b = r.results.bindings[0];
    if (!b) return null;
    return {
      id,
      statement: b.statement!.value,
      status: b.status!.value as GoalStatus,
      createdAt: b.createdAt!.value,
      updatedAt: b.updatedAt!.value,
      source: b.source!.value as 'user' | 'inferred',
      parentGoal: b.parent?.value,
    };
  }

  async setStatus(id: string, newStatus: GoalStatus): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Goal not found: ${id}`);
    const now = new Date().toISOString();

    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DELETE { GRAPH <kg:goals> { ${escapeIRI(id)} pred:status ?old ; pred:updatedAt ?ts } }
      INSERT {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} pred:status "${newStatus}" ;
                            pred:updatedAt "${now}"^^xsd:dateTime .
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('goal-status-changed'))} a pred:GoalStatusChanged ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "GoalStore" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ from: existing.status, to: newStatus }))} .
        }
      }
      WHERE { GRAPH <kg:goals> { ${escapeIRI(id)} pred:status ?old ; pred:updatedAt ?ts } }
    `);
  }

  async listActive(): Promise<Goal[]> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id WHERE {
        GRAPH <kg:goals> { ?id pred:status "active" }
      }
    `);
    const ids = r.results.bindings.map((b) => b.id!.value);
    const goals = await Promise.all(ids.map((id) => this.get(id)));
    return goals.filter((g): g is Goal => g !== null);
  }
}
