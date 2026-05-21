import { loadConfig } from 'predicate-mcp/src/config.js';
import { getAdapter, OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { dockerAvailable } from '../docker.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';
import { existsSync, accessSync, constants, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface Check { name: string; ok: boolean; detail?: string }

export interface RoundTripResult {
  persisted: boolean;
  detail: string;
}

/**
 * Assert one triple in an isolated store, close (flush), reopen with a fresh
 * adapter, and confirm the triple survived. Proves durability + query end to
 * end. Uses its own throwaway store dir — never the user's data.
 */
export async function roundTripSelfTest(storePath: string): Promise<RoundTripResult> {
  const S = 'urn:predicate:selftest:s';
  const P = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const O = 'urn:predicate:selftest:Probe';

  const w = new OxigraphAdapter({ storePath });
  await w.ready();
  await w.update(`INSERT DATA { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  await w.close(); // force flush to disk

  const r = new OxigraphAdapter({ storePath });
  await r.ready();
  const survived = await r.ask(`ASK { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  await r.close();

  return survived
    ? { persisted: true, detail: 'assert → flush → reopen → read OK' }
    : { persisted: false, detail: 'triple lost across reopen — flush-on-close is broken' };
}

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
    if (writable) {
      const selftestDir = join(dirname(cfg.oxigraphStorePath), 'doctor-selftest');
      const rt = await roundTripSelfTest(selftestDir)
        .catch((err) => ({ persisted: false, detail: (err as Error).message }));
      checks.push({
        name: 'round-trip (assert→flush→reopen→read)',
        ok: rt.persisted,
        detail: rt.detail,
      });
      // Best-effort cleanup: never let a cleanup failure fail doctor.
      try { rmSync(selftestDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
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
