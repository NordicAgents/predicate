import type { Tier2Row } from './tier2-types.js';

/** Per-question and aggregate Tier1−Tier2 gap (how much the model's SPARQL underperforms golden). */
export function tier1VsTier2(
  domain: string, t2: Tier2Row[], tier1Final: Map<string, number>,
): string {
  const lines = [`Tier1 vs Tier2 — ${domain}`, 'question            t1    t2    gap   valid'];
  let sumT1 = 0; let sumT2 = 0;
  for (const r of t2) {
    const t1 = tier1Final.get(r.questionId) ?? 0;
    sumT1 += t1; sumT2 += r.f1;
    lines.push(
      `${r.questionId.padEnd(18)} ${t1.toFixed(2)}  ${r.f1.toFixed(2)}  ${(t1 - r.f1).toFixed(2)}  ${r.sparqlValid ? 'ok' : 'INVALID'}`,
    );
  }
  const n = t2.length || 1;
  const gap = sumT1 / n - sumT2 / n;
  const validRate = t2.filter((r) => r.sparqlValid).length / n;
  lines.push(`aggregate: t1=${(sumT1 / n).toFixed(2)} t2=${(sumT2 / n).toFixed(2)} gap=${gap.toFixed(2)} sparql_valid_rate=${validRate.toFixed(2)}`);
  return lines.join('\n');
}
