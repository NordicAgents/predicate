import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { dockerAvailable } from '../docker.js';

interface Check { name: string; ok: boolean; detail?: string }

export async function doctor(): Promise<number> {
  const cfg = loadConfig();
  const checks: Check[] = [];

  checks.push({
    name: 'docker installed',
    ok: dockerAvailable(),
    detail: dockerAvailable() ? '' : 'install Docker Desktop',
  });

  const ping = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
  checks.push({
    name: 'fuseki reachable',
    ok: Boolean(ping?.ok),
    detail: ping?.ok ? cfg.fusekiUrl : `not reachable at ${cfg.fusekiUrl} — try 'predicate up'`,
  });

  if (ping?.ok) {
    const client = new SparqlClient(cfg);
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: 'kg:tbox loaded',
      ok: tboxOk,
      detail: tboxOk ? '' : "no classes found — try 'predicate up' (re-runs bootstrap)",
    });
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? '[x]' : '[ ]';
    const name = c.name.padEnd(width);
    const detail = c.detail ? `  — ${c.detail}` : '';
    console.log(`${mark} ${name}${detail}`);
  }

  return checks.every((c) => c.ok) ? 0 : 1;
}
