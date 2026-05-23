import { getAdapter } from 'predicate-mcp/src/storage/index.js';

const META = 'https://industriagents.com/predicate/meta#';

interface Cell { n: number; ttlDays: number; decision: string }

export async function shadowReport(): Promise<number> {
  try {
    const client = getAdapter();
    const r = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }
    `);
    // For each (n, ttl) cell, count promote/wait/expire across the latest record per proposal.
    const latest = new Map<string, { ts: string; cells: Cell[]; goalSource: string }>();
    for (const b of r.results.bindings) {
      const rec = JSON.parse(b['payload']!.value) as {
        proposalId: string; passTimestamp: string; goalSource: string; counterfactual: Cell[];
      };
      const prev = latest.get(rec.proposalId);
      if (!prev || rec.passTimestamp > prev.ts) {
        latest.set(rec.proposalId, { ts: rec.passTimestamp, cells: rec.counterfactual, goalSource: rec.goalSource });
      }
    }
    const grid: Record<string, { promote: number; wait: number; expire: number; inferredPromote: number }> = {};
    for (const { cells, goalSource } of latest.values()) {
      for (const c of cells) {
        const key = `N=${c.n},TTL=${c.ttlDays}d`;
        grid[key] ??= { promote: 0, wait: 0, expire: 0, inferredPromote: 0 };
        grid[key][c.decision as 'promote' | 'wait' | 'expire']++;
        if (c.decision === 'promote' && goalSource === 'inferred') grid[key].inferredPromote++;
      }
    }
    process.stdout.write(JSON.stringify({ proposals: latest.size, grid }, null, 2));
    return 0;
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: (e as Error).message }));
    return 1;
  }
}
