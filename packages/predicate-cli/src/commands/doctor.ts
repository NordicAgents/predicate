import { loadConfig } from 'predicate-mcp/src/config.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { dockerAvailable } from '../docker.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';
import { existsSync, accessSync, constants } from 'node:fs';
import { dirname } from 'node:path';

interface Check { name: string; ok: boolean; detail?: string }

export async function doctor(): Promise<number> {
  const cfg = loadConfig();
  const checks: Check[] = [];

  checks.push({ name: 'backend', ok: true, detail: cfg.backend });

  if (cfg.backend === 'fuseki') {
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
  } else {
    // Oxigraph: directory must be writable.
    let writable = true;
    try {
      const dir = dirname(cfg.oxigraphStorePath);
      if (existsSync(dir)) accessSync(dir, constants.W_OK);
    } catch { writable = false; }
    checks.push({
      name: 'oxigraph store writable',
      ok: writable,
      detail: writable ? cfg.oxigraphStorePath : `cannot write to ${cfg.oxigraphStorePath}`,
    });
    // Detect a leftover Fuseki to nudge migration (informational, no state change).
    const fusekiPing = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
    if (fusekiPing?.ok) {
      checks.push({
        name: 'fuseki detected',
        ok: true,
        detail: `${cfg.fusekiUrl} — set PREDICATE_BACKEND=fuseki to keep using it, or run 'predicate migrate --from fuseki --to oxigraph'`,
      });
    }
  }

  try {
    const client = getAdapter();
    await client.ready();
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${GRAPH.tbox}> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: 'kg:tbox loaded',
      ok: tboxOk,
      detail: tboxOk ? '' : "no classes found — try 'predicate up' (re-runs bootstrap)",
    });
  } catch (err) {
    checks.push({ name: 'adapter open', ok: false, detail: (err as Error).message });
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
