/**
 * Phase-1 hypothesis verdicts (pre-registration Amendment A2.4): computes
 * H3 / H6 / H7 / H8 PASS/FAIL from prediction rows + instance manifests ONLY
 * — no other code path may adjudicate these hypotheses. A FAIL is a result,
 * not an error: the script always exits 0 and reports what it measured.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval exec tsx src/instances/phase1-verdicts-cli.ts
 *
 * Writes results/instances/phase1-verdicts.json. Decision fields (rates,
 * counts, PASS/FAIL) are deterministic; the H8 cost ratios are single-run
 * wall-clock and vary between rebuilds (disclosed in the output).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InstanceRecord, PredictionRow } from './types.js';
import { scorePredictions, type SystemScore } from './score-cli.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

const CHAIN_DOMAINS = ['conflict-chain-m2', 'conflict-chain-m3'] as const;
const H3_DOMAINS = ['conflict-h3-nk1', 'conflict-h3-nk3'] as const;
const TAUSIG_DOMAIN = 'conflict-tausig';
const MECH_V0_DOMAINS = ['conflict-d20', 'conflict-xr-small', 'conflict-xr-scale'] as const;
const HOPS = [1, 2, 3, 4] as const;

const BLIND_SYSTEMS = ['exact-key-join', 'sparql-groupby', 'reasoner-r14r23r22'] as const;
const X_SYSTEM = 'exact-key-join-x';

interface DomainData {
  instances: InstanceRecord[];
  rows: PredictionRow[];
  scores: Map<string, SystemScore>;
}

function readRows(file: string): PredictionRow[] {
  return readFileSync(file, 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l) as PredictionRow);
}

function loadDomain(domain: string): DomainData {
  const instances = JSON.parse(
    readFileSync(join(PKG_ROOT, 'fixtures', domain, 'instances.json'), 'utf8'),
  ) as InstanceRecord[];
  const rows = [
    join(PKG_ROOT, 'results', 'exact', `exact-key-join.${domain}.jsonl`),
    join(PKG_ROOT, 'results', 'exact', `sparql-groupby.${domain}.jsonl`),
    join(PKG_ROOT, 'results', 'exact', `exact-key-join-x.${domain}.jsonl`),
    join(PKG_ROOT, 'results', 'instances', `reasoner-r14r23r22.${domain}.jsonl`),
    join(PKG_ROOT, 'results', 'retrieval', `retrieval.${domain}.jsonl`),
  ].flatMap(readRows).filter((r) => r.domain === domain);
  const scores = new Map(scorePredictions(instances, rows).map((s) => [s.system, s]));
  return { instances, rows, scores };
}

const chainLengthOf = (domain: string): number =>
  (JSON.parse(readFileSync(join(PKG_ROOT, 'fixtures', domain, 'oracle.json'), 'utf8')) as { chainLength: number }).chainLength;

/** Witness-complete rate of a retrieval system over conflict instances = its recall. */
const rateOf = (d: DomainData, system: string): number | null =>
  d.scores.get(system)?.conflict.recall ?? null;

const perfect = (s: SystemScore | undefined): boolean =>
  s !== undefined && s.conflict.precision === 1 && s.conflict.recall === 1 && s.missing === 0;

/** Mean of extra.<field> over the rows of `system` on instances passing `pick`. */
function meanExtra(
  d: DomainData, system: string, field: string, pick: (i: InstanceRecord) => boolean,
): number {
  const ids = new Set(d.instances.filter(pick).map((i) => i.id));
  const xs = d.rows
    .filter((r) => r.system === system && ids.has(r.instanceId))
    .map((r) => r.extra[field]);
  if (xs.length === 0 || xs.some((x) => typeof x !== 'number')) {
    throw new Error(`no numeric extra.${field} rows for ${system}`);
  }
  return (xs as number[]).reduce((a, b) => a + b, 0) / xs.length;
}

const extraOfDomain = (d: DomainData, system: string, field: string): number => {
  const r = d.rows.find((x) => x.system === system);
  const v = r?.extra[field];
  if (typeof v !== 'number') throw new Error(`no extra.${field} on ${system} rows`);
  return v;
};

function main(): void {
  const domains = new Map<string, DomainData>();
  for (const dom of [...CHAIN_DOMAINS, ...H3_DOMAINS, TAUSIG_DOMAIN, ...MECH_V0_DOMAINS]) {
    domains.set(dom, loadDomain(dom));
  }

  // ---- H6: chain depth --------------------------------------------------
  const h6 = CHAIN_DOMAINS.map((dom) => {
    const d = domains.get(dom)!;
    const m = chainLengthOf(dom);
    const singleJoinBlind = (['exact-key-join', 'sparql-groupby'] as const).map((sys) => {
      const s = d.scores.get(sys);
      return {
        system: sys,
        recall: s?.conflict.recall ?? null,
        fp: s?.conflict.fp ?? null,
        pass: s !== undefined && s.conflict.recall === 0 && s.conflict.fp === 0,
      };
    });
    const full = ([X_SYSTEM, 'reasoner-r14r23r22'] as const).map((sys) => ({
      system: sys,
      precision: d.scores.get(sys)?.conflict.precision ?? null,
      recall: d.scores.get(sys)?.conflict.recall ?? null,
      pass: perfect(d.scores.get(sys)),
    }));
    const keyAware = HOPS.map((k) => ({
      k,
      rate: rateOf(d, `retrieval:key-aware@${k}`),
      expected: k < m ? 0 : 1,
    }));
    const iriBfs = HOPS.map((k) => ({ k, rate: rateOf(d, `retrieval:iri-bfs@${k}`), expected: 0 }));
    return {
      domain: dom, chainLength: m,
      'i-single-join-structurally-insufficient': {
        systems: singleJoinBlind, pass: singleJoinBlind.every((s) => s.pass),
      },
      'ii-full-fragment-perfect': { systems: full, pass: full.every((s) => s.pass) },
      'iii-key-aware-needs-k-ge-m': {
        cells: keyAware, pass: keyAware.every((c) => c.rate === c.expected),
      },
      'iv-iri-bfs-incomplete-at-every-k': {
        cells: iriBfs, pass: iriBfs.every((c) => c.rate === 0),
      },
    };
  });
  const h6pass = h6.every((d) =>
    d['i-single-join-structurally-insufficient'].pass && d['ii-full-fragment-perfect'].pass
    && d['iii-key-aware-needs-k-ge-m'].pass && d['iv-iri-bfs-incomplete-at-every-k'].pass);

  // ---- H7: tau/sigma conditioning ---------------------------------------
  const dTau = domains.get(TAUSIG_DOMAIN)!;
  const blind = BLIND_SYSTEMS.map((sys) => {
    const s = dTau.scores.get(sys);
    const temporal = s?.perKind['benign-temporal'];
    const scoped = s?.perKind['benign-scoped'];
    return {
      system: sys,
      recall: s?.conflict.recall ?? null,
      precision: s?.conflict.precision ?? null,
      temporalFlagged: temporal ? `${temporal.flagged}/${temporal.n}` : null,
      scopedFlagged: scoped ? `${scoped.flagged}/${scoped.n}` : null,
      pass: temporal !== undefined && scoped !== undefined
        && temporal.flagged === temporal.n && scoped.flagged === scoped.n,
    };
  });
  const xTau = dTau.scores.get(X_SYSTEM);
  const xBenignFlags = Object.entries(xTau?.perKind ?? {})
    .filter(([k]) => k !== 'conflict')
    .reduce((n, [, c]) => n + c.flagged, 0);
  const h7 = {
    domain: TAUSIG_DOMAIN,
    blindSystemsOverFlag: { systems: blind, pass: blind.every((s) => s.pass) },
    awareBaselinePerfect: {
      system: X_SYSTEM,
      precision: xTau?.conflict.precision ?? null,
      recall: xTau?.conflict.recall ?? null,
      benignFlagged: xBenignFlags,
      pass: perfect(xTau) && xBenignFlags === 0,
    },
  };
  const h7pass = h7.blindSystemsOverFlag.pass && h7.awareBaselinePerfect.pass;

  // ---- H3: literal-aware context premium --------------------------------
  const h3ByDomain = H3_DOMAINS.map((dom) => {
    const d = domains.get(dom)!;
    const isConflict = (i: InstanceRecord): boolean => i.isConflict;
    const isSharedValue = (i: InstanceRecord): boolean => i.kind === 'benign-shared-value';
    const cell = (pick: (i: InstanceRecord) => boolean): { lit: number; key: number; triplePremium: number } => {
      const lit = meanExtra(d, 'retrieval:literal-aware@1', 'contextTriples', pick);
      const key = meanExtra(d, 'retrieval:key-aware@1', 'contextTriples', pick);
      return { lit, key, triplePremium: lit / key };
    };
    const conflictCell = cell(isConflict);
    const sharedCell = cell(isSharedValue);
    const bytePremium = meanExtra(d, 'retrieval:literal-aware@1', 'contextBytes', isConflict)
      / meanExtra(d, 'retrieval:key-aware@1', 'contextBytes', isConflict);
    return {
      domain: dom,
      completeAt1: {
        literalAware: rateOf(d, 'retrieval:literal-aware@1'),
        keyAware: rateOf(d, 'retrieval:key-aware@1'),
      },
      conflictMeanCtxTriples: conflictCell,
      conflictBytePremium: bytePremium,
      sharedValuePremium: sharedCell.triplePremium,
    };
  });
  const [nk1, nk3] = h3ByDomain;
  const h3 = {
    domains: h3ByDomain,
    premiumExists: nk1!.conflictMeanCtxTriples.triplePremium > 1 && nk3!.conflictMeanCtxTriples.triplePremium > 1
      && nk1!.conflictBytePremium > 1 && nk3!.conflictBytePremium > 1,
    monotoneInNk: nk3!.conflictMeanCtxTriples.triplePremium > nk1!.conflictMeanCtxTriples.triplePremium,
    largestOnSharedValue: h3ByDomain.every((d) => d.sharedValuePremium > d.conflictMeanCtxTriples.triplePremium),
    completenessCarriesOver: h3ByDomain.every(
      (d) => d.completeAt1.literalAware === 1 && d.completeAt1.keyAware === 1),
  };
  const h3pass = h3.premiumExists && h3.monotoneInNk && h3.largestOnSharedValue && h3.completenessCarriesOver;

  // ---- H8: extended-baseline cost (single-run wall-clock; run-variable) --
  const h8ByDomain = [...CHAIN_DOMAINS, TAUSIG_DOMAIN, ...MECH_V0_DOMAINS].map((dom) => {
    const d = domains.get(dom)!;
    const xMs = extraOfDomain(d, X_SYSTEM, 'totalDomainMs');
    const reasonerRow = d.rows.find((r) => r.system === 'reasoner-r14r23r22');
    const reasonerMs = reasonerRow?.costMs ?? null;
    const bothPerfect = perfect(d.scores.get(X_SYSTEM)) && perfect(d.scores.get('reasoner-r14r23r22'));
    const keyJoinMs = MECH_V0_DOMAINS.includes(dom as (typeof MECH_V0_DOMAINS)[number])
      ? extraOfDomain(d, 'exact-key-join', 'totalDomainMs')
      : null;
    return {
      domain: dom,
      xTotalMs: xMs,
      reasonerMaterializeMs: reasonerMs,
      reasonerOverX: reasonerMs === null ? null : reasonerMs / xMs,
      bothPerfect,
      keyJoinTotalMs: keyJoinMs,
      xOverKeyJoin: keyJoinMs === null ? null : xMs / keyJoinMs,
    };
  });
  const h8 = {
    note: 'single-run wall-clock; ratios vary between rebuilds (decision values elsewhere are byte-stable)',
    domains: h8ByDomain,
    xTenXCheaperThanReasonerWhereBothPerfect: h8ByDomain
      .filter((d) => d.bothPerfect && d.reasonerOverX !== null)
      .every((d) => (d.reasonerOverX ?? 0) >= 10),
    xWithinTenXOfPlainJoinOnMechV0: h8ByDomain
      .filter((d) => d.xOverKeyJoin !== null)
      .every((d) => (d.xOverKeyJoin ?? Infinity) <= 10),
  };
  const h8pass = h8.xTenXCheaperThanReasonerWhereBothPerfect && h8.xWithinTenXOfPlainJoinOnMechV0;

  const verdicts = {
    registration: 'pre-registration.md Amendment A2 (2026-07-13)',
    H3: { pass: h3pass, ...h3 },
    H6: { pass: h6pass, domains: h6 },
    H7: { pass: h7pass, ...h7 },
    H8: { pass: h8pass, ...h8 },
  };

  const outDir = join(PKG_ROOT, 'results', 'instances');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, 'phase1-verdicts.json');
  writeFileSync(out, JSON.stringify(verdicts, null, 2) + '\n');

  for (const [h, v] of Object.entries({ H3: h3pass, H6: h6pass, H7: h7pass, H8: h8pass })) {
    console.log(`${h}: ${v ? 'PASS' : 'FAIL'}`);
  }
  console.log(`wrote ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
