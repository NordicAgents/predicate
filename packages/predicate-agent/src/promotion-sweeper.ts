import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import type {
  DeltaQuad, PromotionDecision, SweeperResult, Term,
} from './types.js';

const META = 'https://predicate.dev/meta#';

interface ProposalRow {
  id: string;
  kind: string;
  expiresAt: string;
  useCount: number;
  justification: string;
  parent?: string;
  migration?: string;
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

function tripleTurtle(q: DeltaQuad): string {
  return tripleSparql(q) + ' .';
}

export interface PromotionSweeperOptions {
  useThreshold?: number;
  promotedDir?: string;
}

export class PromotionSweeper {
  private useThreshold: number;
  private promotedDir: string;
  private reasoner: FusekiConstructAdapter;

  constructor(private client: StorageAdapter, opts: PromotionSweeperOptions = {}) {
    this.useThreshold = opts.useThreshold ?? 3;
    this.promotedDir = opts.promotedDir
      ?? process.env['PREDICATE_PROMOTED_DIR']
      ?? resolve(
        import.meta.dirname ?? process.cwd(),
        '..', '..', 'predicate-ontology', 'tbox', 'promoted',
      );
    this.reasoner = new FusekiConstructAdapter(client);
  }

  async run(): Promise<SweeperResult> {
    const t0 = Date.now();
    const proposals = await this.listProposals();
    const decisions: PromotionDecision[] = [];
    for (const p of proposals) {
      decisions.push(await this.decide(p));
    }
    return { decisions, durationMs: Date.now() - t0 };
  }

  async promoteById(
    id: string,
    opts: { actor: string },
  ): Promise<PromotionDecision> {
    const row = await this.loadProposalRow(id);
    if (!row) {
      return { proposalId: id, outcome: 'rejected-validation', reason: 'proposal not found' };
    }
    const validation = await this.validateProposalInIsolation(row);
    if (!validation.ok) {
      await this.recordValidationFailed(row, validation.reason ?? 'validation failed');
      return {
        proposalId: id,
        outcome: 'rejected-validation',
        reason: validation.reason,
      };
    }
    const promoted = await this.promote(row, opts.actor);
    return {
      proposalId: id,
      outcome: 'promoted',
      turtleFile: promoted.turtleFile,
      tboxVersion: promoted.tboxVersion,
    };
  }

  async rejectById(
    id: string,
    opts: { actor: string; reason: string },
  ): Promise<PromotionDecision> {
    const row = await this.loadProposalRow(id);
    if (!row) {
      return { proposalId: id, outcome: 'rejected-validation', reason: 'proposal not found' };
    }
    await this.rejectExpired(row, opts.actor, opts.reason);
    return { proposalId: id, outcome: 'rejected-expired', reason: opts.reason };
  }

  private async listProposals(): Promise<ProposalRow[]> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id ?kind ?expiresAt ?justification ?parent ?migration WHERE {
        GRAPH <kg:tbox-staging> {
          ?id a pred:Proposal ;
              pred:kind          ?kind ;
              pred:expiresAt     ?expiresAt ;
              pred:justification ?justification .
          OPTIONAL { ?id pred:parent    ?parent    }
          OPTIONAL { ?id pred:migration ?migration }
        }
      }
    `);
    const out: ProposalRow[] = [];
    for (const b of r.results.bindings) {
      const useCount = await this.countUses(b['id']!.value);
      out.push({
        id: b['id']!.value,
        kind: b['kind']!.value,
        expiresAt: b['expiresAt']!.value,
        useCount,
        justification: b['justification']!.value,
        parent: b['parent']?.value,
        migration: b['migration']?.value,
      });
    }
    return out;
  }

  private async loadProposalRow(id: string): Promise<ProposalRow | null> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?kind ?expiresAt ?justification ?parent ?migration WHERE {
        GRAPH <kg:tbox-staging> {
          ${escapeIRI(id)} a pred:Proposal ;
                            pred:kind          ?kind ;
                            pred:expiresAt     ?expiresAt ;
                            pred:justification ?justification .
          OPTIONAL { ${escapeIRI(id)} pred:parent    ?parent }
          OPTIONAL { ${escapeIRI(id)} pred:migration ?migration }
        }
      }
    `);
    const b = r.results.bindings[0];
    if (!b) return null;
    const useCount = await this.countUses(id);
    return {
      id,
      kind: b['kind']!.value,
      expiresAt: b['expiresAt']!.value,
      useCount,
      justification: b['justification']!.value,
      parent: b['parent']?.value,
      migration: b['migration']?.value,
    };
  }

  private async countUses(proposalId: string): Promise<number> {
    const subjects = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT DISTINCT ?s WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} .
        }
      }
    `);
    const iris = subjects.results.bindings.map((b) => b['s']!.value);
    if (iris.length === 0) return 0;

    const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(' || ');
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:usage> {
          ?q a pred:Query ; pred:sparql ?sparql .
          FILTER (${filters})
        }
      }
    `);
    return parseInt(r.results.bindings[0]!['n']!.value, 10);
  }

  private async decide(p: ProposalRow): Promise<PromotionDecision> {
    const now = Date.now();
    const exp = new Date(p.expiresAt).getTime();

    if (now > exp && p.useCount < this.useThreshold) {
      await this.rejectExpired(p);
      return { proposalId: p.id, outcome: 'rejected-expired', reason: 'TTL elapsed before usage gate met' };
    }
    if (p.useCount >= this.useThreshold) {
      const validation = await this.validateProposalInIsolation(p);
      if (!validation.ok) {
        await this.recordValidationFailed(p, validation.reason ?? 'validation failed');
        return {
          proposalId: p.id,
          outcome: 'rejected-validation',
          reason: validation.reason,
        };
      }
      const promoted = await this.promote(p);
      return {
        proposalId: p.id,
        outcome: 'promoted',
        turtleFile: promoted.turtleFile,
        tboxVersion: promoted.tboxVersion,
      };
    }
    return { proposalId: p.id, outcome: 'awaiting' };
  }

  private async validateProposalInIsolation(
    p: ProposalRow,
  ): Promise<{ ok: boolean; reason?: string }> {
    const scratch = `kg:tbox-staging-tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await this.client.update(`CREATE SILENT GRAPH <${scratch}>`);
    try {
      await this.client.update(`
        PREFIX pred: <${META}>
        INSERT { GRAPH <${scratch}> { ?s ?p ?o } }
        WHERE {
          GRAPH <kg:tbox-staging> {
            << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
            ?s ?p ?o .
          }
        }
      `);
      const result = await this.reasoner.validate({
        tboxGraph: 'kg:tbox',
        stagingGraph: scratch,
        aboxSample: 'kg:abox',
      });
      if (result.ok) return { ok: true };
      const parts: string[] = [];
      if (result.unsatisfiableClasses.length) {
        parts.push(`unsatisfiable: ${result.unsatisfiableClasses.join(', ')}`);
      }
      if (result.shaclViolations.length) {
        parts.push(`${result.shaclViolations.length} SHACL violations`);
      }
      return { ok: false, reason: parts.join('; ') || 'validation failed' };
    } finally {
      await this.client.update(`DROP SILENT GRAPH <${scratch}>`);
    }
  }

  private async rejectExpired(p: ProposalRow, actor: string = 'PromotionSweeper', reason: string = 'expired'): Promise<void> {
    // Delete the RDF-star tagged triples and the proposal metadata node
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-rejected'))} a pred:SchemaRejected ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor ${escapeLiteral(actor)} ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason }))} .
        }
      }
    `);
  }

  private async recordValidationFailed(p: ProposalRow, reason: string): Promise<void> {
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-validation-failed'))} a pred:SchemaValidationFailed ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason }))} .
        }
      }
    `);
  }

  private async promote(p: ProposalRow, actor: string = 'PromotionSweeper'): Promise<{ turtleFile: string; tboxVersion: string }> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?s ?p ?o WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
        }
      }
    `);

    type SparqlBinding = { type: string; value: string; datatype?: string };
    const quads: DeltaQuad[] = r.results.bindings.map((b) => {
      const o = b['o'] as SparqlBinding;
      return {
        s: b['s']!.value,
        p: b['p']!.value,
        o: o.type === 'uri'
          ? ({ type: 'uri', value: o.value } as Term)
          : ({ type: 'literal', value: o.value, datatype: o.datatype } as Term),
      };
    });

    const turtleFile = resolve(this.promotedDir, `${p.id.replace(/[^A-Za-z0-9-]/g, '_')}.ttl`);
    const turtle = quads.map(tripleTurtle).join('\n') + '\n';
    writeFileSync(turtleFile, turtle, 'utf8');

    const tboxVersion = `urn:predicate:tbox:v-${Date.now().toString(36)}`;
    const insertSparql = quads.map((q) => tripleSparql(q) + ' .').join('\n');
    const now = new Date().toISOString();
    const promotedEventId = newEventId('schema-promoted');
    const advancedEventId = newEventId('tbox-version-advanced');
    const payloadPromoted = escapeLiteral(JSON.stringify({
      kind: p.kind, turtleFile, tboxVersion, useCount: p.useCount,
    }));
    const payloadAdvanced = escapeLiteral(JSON.stringify({ proposalId: p.id, turtleFile }));

    // Drop inferred graph
    await this.client.update(`DROP SILENT GRAPH <kg:inferred>`);

    // Copy delta triples to kg:tbox and emit events
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox> {
          ${insertSparql}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(promotedEventId)} a pred:SchemaPromoted ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor ${escapeLiteral(actor)} ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${payloadPromoted} .
          ${escapeIRI(advancedEventId)} a pred:TBoxVersionAdvanced ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor ${escapeLiteral(actor)} ;
            pred:goal  ${escapeIRI(tboxVersion)} ;
            pred:payload ${payloadAdvanced} .
        }
      }
    `);

    // Remove from staging (delta triples + RDF-star tags + proposal metadata)
    await this.client.update(`
      PREFIX pred: <${META}>
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);

    return { turtleFile, tboxVersion };
  }
}
