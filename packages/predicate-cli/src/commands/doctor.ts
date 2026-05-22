import { loadConfig } from 'predicate-mcp/src/config.js';
import { getAdapter, OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { dockerAvailable } from '../docker.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';
import { existsSync, accessSync, constants, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Check { name: string; ok: boolean; detail?: string }

export interface PlatformCheck { name: string; ok: boolean; detail?: string }

const PLATFORM_HOOK_DIR: Record<string, string> = {
  codex: 'hooks/codex-cli',
  gemini: 'hooks/gemini-cli',
};

export function platformChecks(platform: string): PlatformCheck[] {
  const dir = PLATFORM_HOOK_DIR[platform];
  if (!dir) {
    return [{ name: 'platform', ok: false, detail: `unknown platform '${platform}' (codex|gemini)` }];
  }
  // The bundled CLI sits at the predicate-skill package root; hooks/ is a sibling.
  const root = dirname(fileURLToPath(import.meta.url));
  const scripts = ['session-start.sh', 'stop.sh'];
  const present = scripts.map((s) => existsSync(resolve(root, dir, s)));
  return [{
    name: 'hook scripts',
    ok: present.every(Boolean),
    detail: scripts.join(', '),
  }];
}

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
  try {
    await w.ready();
    await w.update(`INSERT DATA { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  } finally {
    await w.close().catch(() => {}); // flush + release; swallow close errors
  }

  const r = new OxigraphAdapter({ storePath });
  let survived: boolean;
  try {
    await r.ready();
    survived = await r.ask(`ASK { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  } finally {
    await r.close().catch(() => {}); // release; swallow close errors
  }

  return survived
    ? { persisted: true, detail: 'assert → flush → reopen → read OK' }
    : { persisted: false, detail: 'triple lost across reopen — flush-on-close is broken' };
}

export async function doctor(args: string[] = []): Promise<number> {
  const platform = args[0];
  if (platform) {
    const checks = platformChecks(platform);
    for (const c of checks) {
      console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    return checks.every((c) => c.ok) ? 0 : 1;
  }
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
    if (cfg.backend === 'oxigraph') {
      const { daemonStatus } = await import('predicate-mcp/src/storage/index.js');
      const h = await daemonStatus(cfg.oxigraphStorePath).catch(() => null);
      let live = false;
      if (h) {
        live = await fetch(`http://${h.host}:${h.port}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sparql-query', 'Accept': 'application/sparql-results+json' },
          body: 'ASK {}',
          signal: AbortSignal.timeout(1000),
        }).then((r) => r.ok).catch(() => false);
      }
      checks.push({
        name: 'oxigraph daemon',
        ok: live,
        detail: live
          ? `127.0.0.1:${h!.port} (pid ${h!.pid}, v${h!.version})`
          : "no live daemon — run 'predicate up' (native default; falls back to WASM if the binary is unavailable)",
      });
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
