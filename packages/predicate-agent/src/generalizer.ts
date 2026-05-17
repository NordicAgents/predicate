import { createHash } from 'node:crypto';
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { SchemaProposer } from './schema-proposer.js';
import type { GeneralizerProposal, GeneralizerResult } from './types.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export interface GeneralizerOptions {
  k?: number;
}

interface SubjectRow {
  s: string;
  predicates: string[];
}

function fingerprintHash(fingerprint: string[]): string {
  return createHash('sha1').update(fingerprint.join('|')).digest('hex').slice(0, 12);
}

export class Generalizer {
  private k: number;
  constructor(private client: SparqlClient, opts: GeneralizerOptions = {}) {
    this.k = opts.k ?? 5;
  }

  private async isSchemaLearningEnabled(): Promise<boolean> {
    const r = await this.client.select(
      `PREFIX pred: <https://predicate.dev/meta#>
       SELECT ?v WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?v } }`,
    );
    const b = r.results.bindings[0];
    if (!b) return true;
    return b['v']!.value === 'true';
  }

  async run(): Promise<GeneralizerResult> {
    const t0 = Date.now();
    if (!(await this.isSchemaLearningEnabled())) {
      return {
        proposals: [],
        scannedSubjects: 0,
        durationMs: Date.now() - t0,
        autoProposalsSkipped: true,
      };
    }
    const subjects = await this.listUntypedSubjects();
    const groups = this.groupByFingerprint(subjects);
    const proposals: GeneralizerProposal[] = [];
    const proposer = new SchemaProposer(this.client);

    for (const [key, members] of groups.entries()) {
      if (members.length < this.k) continue;
      const fingerprint = key.split('|');
      const hash = fingerprintHash(fingerprint);
      const className = `urn:predicate:gen:${hash}`;
      const proposalId = await proposer.propose({
        kind: 'add-class',
        add: [{
          s: className,
          p: RDF_TYPE,
          o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
        }],
      }, {
        justification: `auto-proposed: ${members.length} untyped instances share predicates [${fingerprint.join(', ')}]`,
      });
      proposals.push({ fingerprint, members, proposalId, className });
    }
    return {
      proposals,
      scannedSubjects: subjects.length,
      durationMs: Date.now() - t0,
    };
  }

  private async listUntypedSubjects(): Promise<SubjectRow[]> {
    const r = await this.client.select(`
      SELECT ?s (GROUP_CONCAT(DISTINCT ?p; separator="|") AS ?preds)
      WHERE {
        GRAPH <kg:abox> {
          ?s ?p ?o .
          FILTER (?p != <${RDF_TYPE}>)
          FILTER NOT EXISTS { ?s <${RDF_TYPE}> ?t }
        }
        FILTER NOT EXISTS { GRAPH <kg:inferred> { ?s <${RDF_TYPE}> ?ti } }
        FILTER NOT EXISTS { GRAPH <kg:tbox>     { ?s <${RDF_TYPE}> ?tb } }
      }
      GROUP BY ?s
    `);
    return r.results.bindings.map((b) => ({
      s: b.s!.value,
      predicates: (b.preds?.value ?? '').split('|').filter((p) => p.length > 0),
    }));
  }

  private groupByFingerprint(rows: SubjectRow[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const key = [...new Set(row.predicates)].sort().join('|');
      const arr = groups.get(key) ?? [];
      arr.push(row.s);
      groups.set(key, arr);
    }
    return groups;
  }
}
