import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runFixpoint } from '../../src/fixpoint.js';
import { r14 } from '../../src/rules/r14-has-key.js';
import { r22 } from '../../src/rules/r22-value-conflict.js';
import { r23 } from '../../src/rules/r23-sameas-value-propagation.js';
import { r22t } from '../../src/rules/r22t-value-conflict-tau.js';
import { r23t } from '../../src/rules/r23t-sameas-value-propagation-tau.js';

/**
 * Unit tests for the τ/σ-aware chain variants (pre-registration Amendment
 * A4.3, hypothesis H12): r23t must carry the SOURCE record's τ/σ onto
 * propagated values as RDF-star annotations (chains preserving the ORIGINAL
 * endpoint's τ), and r22t must flag j:ValueConflict only under τ-interval
 * overlap ([from,to)) and σ equality-or-absence. On an unannotated fragment
 * the pair must behave exactly like blind r23/r22.
 *
 * Runs the chain via runFixpoint directly (NOT adapter.materialize — that
 * executes the full default RULES set, which by design excludes r22t/r23t).
 */

const client = getAdapter();
const J = 'https://industriagents.com/predicate/judgment#';
const T = 'kg:tbox-test-r22t';
const A = 'kg:abox-test-r22t';
const I = 'kg:inferred-test-r22t';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function withProv(s: string, p: string, o: string, conf = 1): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}>          { ${s} ${p} ${o} . }
      GRAPH <kg:provenance> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

const M = (): Promise<unknown> =>
  runFixpoint(client, [r14, r23t, r22t], {
    tboxGraph: T, aboxGraphs: [A], inferredGraph: I, closureCutoff: 0.5,
  });

interface RecordSpec {
  office: string;
  emails?: string[];
  validFrom?: string;
  validTo?: string;
  scope?: string;
}

/** Seed a PersonRecord with an email key, one office value, optional τ/σ. */
async function seedRecord(iri: string, spec: RecordSpec): Promise<string> {
  const rec = `<${iri}>`;
  await withProv(rec, '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/PersonRecord>');
  for (const email of spec.emails ?? []) await withProv(rec, '<https://ex/email>', `"${email}"`);
  await withProv(rec, '<https://ex/office>', `<${spec.office}>`);
  if (spec.validFrom !== undefined) await withProv(rec, '<https://ex/validFrom>', `"${spec.validFrom}"`);
  if (spec.validTo !== undefined) await withProv(rec, '<https://ex/validTo>', `"${spec.validTo}"`);
  if (spec.scope !== undefined) await withProv(rec, '<https://ex/scope>', `"${spec.scope}"`);
  return rec;
}

const flagged = (rec: string): Promise<boolean> => client.ask(`
  PREFIX j: <${J}>
  ASK { GRAPH <${I}> { ${rec} a j:ValueConflict ; j:conflictOn <https://ex/office> } }
`);

beforeAll(async () => {
  await reset(T);
  await client.update(`
    PREFIX ex:  <https://ex/>
    PREFIX j:   <${J}>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT DATA { GRAPH <${T}> {
      ex:PersonRecord owl:hasKey ( ex:email ) .
      ex:office    a j:SingleValued .
      ex:validFrom a j:ValidFrom .
      ex:validTo   a j:ValidTo .
      ex:scope     a j:SourceScope .
    } }
  `);
});
beforeEach(async () => { await reset(A); await reset(I); });

describe('r23t/r22t — τ/σ-aware cross-record conflict chain', () => {
  it('overlapping τ intervals on distinct values: conflict fires on both records', async () => {
    const r1 = await seedRecord('https://ex/ov1', {
      emails: ['ov@ex.com'], office: 'https://ex/officeA', validFrom: '2026-01-01', validTo: '2026-07-01',
    });
    const r2 = await seedRecord('https://ex/ov2', {
      emails: ['ov@ex.com'], office: 'https://ex/officeB', validFrom: '2026-04-01', validTo: '2026-10-01',
    });
    await M();
    // r23t carried the SOURCE record's τ onto the propagated value. NOTE:
    // oxigraph realizes << >> as RDF 1.2 reifiers, one FRESH reifier per
    // template line — so each annotation must be matched as its own
    // quoted-triple statement, never ;-chained onto one reifier.
    const carried = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> {
        ${r1} <https://ex/office> <https://ex/officeB> .
        << ${r1} <https://ex/office> <https://ex/officeB> >> j:tauFrom "2026-04-01" .
        << ${r1} <https://ex/office> <https://ex/officeB> >> j:tauTo "2026-10-01" .
      } }
    `);
    expect(carried).toBe(true);
    expect(await flagged(r1)).toBe(true);
    expect(await flagged(r2)).toBe(true);
  });

  it('disjoint τ intervals: co-reference and propagation happen, but NO conflict (temporal update)', async () => {
    const r1 = await seedRecord('https://ex/dj1', {
      emails: ['dj@ex.com'], office: 'https://ex/officeA', validFrom: '2026-01-01', validTo: '2026-03-01',
    });
    const r2 = await seedRecord('https://ex/dj2', {
      emails: ['dj@ex.com'], office: 'https://ex/officeB', validFrom: '2026-05-01', validTo: '2026-09-01',
    });
    await M();
    const coref = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { ${r1} owl:sameAs ${r2} } }
    `);
    expect(coref).toBe(true);
    const propagated = await client.ask(`
      ASK { GRAPH <${I}> { ${r1} <https://ex/office> <https://ex/officeB> } }
    `);
    expect(propagated).toBe(true);
    expect(await flagged(r1)).toBe(false);
    expect(await flagged(r2)).toBe(false);
  });

  it('differing σ scopes: NO conflict; scoped vs UNSCOPED still conflicts (absent = comparable)', async () => {
    const r1 = await seedRecord('https://ex/sc1', {
      emails: ['sc@ex.com'], office: 'https://ex/officeA', scope: 'hr-system',
    });
    const r2 = await seedRecord('https://ex/sc2', {
      emails: ['sc@ex.com'], office: 'https://ex/officeB', scope: 'field-directory',
    });
    // Second person: one scoped record vs one unscoped record — comparable.
    const r3 = await seedRecord('https://ex/sc3', {
      emails: ['sd@ex.com'], office: 'https://ex/officeA', scope: 'hr-system',
    });
    const r4 = await seedRecord('https://ex/sc4', {
      emails: ['sd@ex.com'], office: 'https://ex/officeB',
    });
    await M();
    expect(await flagged(r1)).toBe(false);
    expect(await flagged(r2)).toBe(false);
    expect(await flagged(r3)).toBe(true);
    expect(await flagged(r4)).toBe(true);
  });

  it('2-hop propagation chain carries the ORIGINAL endpoint record\'s τ, not the intermediate\'s', async () => {
    // a—b share key1, b—c share key2; c's office reaches a only via b.
    // b carries its OWN record-level τ, which must NOT be re-stamped onto
    // the value it relays from c.
    const ra = await seedRecord('https://ex/ch-a', {
      emails: ['k1@ex.com'], office: 'https://ex/officeA', validFrom: '2026-01-01', validTo: '2026-02-01',
    });
    await seedRecord('https://ex/ch-b', {
      emails: ['k1@ex.com', 'k2@ex.com'], office: 'https://ex/officeA', validFrom: '2026-03-01', validTo: '2026-04-01',
    });
    await seedRecord('https://ex/ch-c', {
      emails: ['k2@ex.com'], office: 'https://ex/officeC', validFrom: '2026-06-01', validTo: '2026-08-01',
    });
    await M();
    const noDirectCoref = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> {
        { ${ra} owl:sameAs <https://ex/ch-c> } UNION { <https://ex/ch-c> owl:sameAs ${ra} }
      } }
    `);
    expect(noDirectCoref).toBe(false); // c's value reached a through b only
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?f ?t WHERE { GRAPH <${I}> {
        << ${ra} <https://ex/office> <https://ex/officeC> >> j:tauFrom ?f .
        << ${ra} <https://ex/office> <https://ex/officeC> >> j:tauTo ?t .
      } }
    `);
    expect(r.results.bindings.map((b) => [b.f!.value, b.t!.value]))
      .toEqual([['2026-06-01', '2026-08-01']]); // c's τ, NOT b's [03-01, 04-01)
    // a's own value holds [01-01, 02-01) — disjoint from c's τ — so despite
    // two distinct values converging on a, no conflict is flagged there.
    expect(await flagged(ra)).toBe(false);
  });

  it('unannotated fragment behaves exactly like the blind r14→r23→r22 chain', async () => {
    await seedRecord('https://ex/un1', { emails: ['un@ex.com'], office: 'https://ex/officeA' });
    await seedRecord('https://ex/un2', { emails: ['un@ex.com'], office: 'https://ex/officeB' });
    // benign co-reference: same office both records
    await seedRecord('https://ex/un3', { emails: ['ub@ex.com'], office: 'https://ex/officeC' });
    await seedRecord('https://ex/un4', { emails: ['ub@ex.com'], office: 'https://ex/officeC' });

    const IB = 'kg:inferred-test-r22t-blind';
    await M();
    await runFixpoint(client, [r14, r23, r22], {
      tboxGraph: T, aboxGraphs: [A], inferredGraph: IB, closureCutoff: 0.5,
    });
    const conflictSet = async (g: string): Promise<string[]> => {
      const r = await client.select(`
        PREFIX j: <${J}>
        SELECT ?x ?p WHERE { GRAPH <${g}> { ?x a j:ValueConflict ; j:conflictOn ?p } }
      `);
      return r.results.bindings.map((b) => `${b.x!.value}|${b.p!.value}`).sort();
    };
    const tau = await conflictSet(I);
    const blind = await conflictSet(IB);
    expect(tau).toEqual(blind);
    expect(tau).toEqual([
      `https://ex/un1|https://ex/office`,
      `https://ex/un2|https://ex/office`,
    ]);
    // no τ/σ annotations were invented for unannotated sources
    const anyAnn = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { << ?s ?p ?o >> j:tauFrom ?f } }
    `);
    expect(anyAnn).toBe(false);
    await client.update(`DROP SILENT GRAPH <${IB}>`);
  });
});
