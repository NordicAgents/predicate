import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Robust project-directory resolution for the MCP server and CLI.
 *
 * Adapted from mksglu/context-mode's project-dir resolver (Elastic-2.0),
 * which documents the core problem: Claude Code spawns the plugin MCP server
 * with `cwd` set to the plugin install dir (`~/.claude/plugins/cache/...`)
 * and does NOT propagate `CLAUDE_PROJECT_DIR` into the MCP env (notably when
 * launched from the desktop app). Naively trusting cwd re-roots every store
 * under the plugin cache. We therefore reject plugin-install paths and prefer
 * the Claude Code transcript `cwd` / `PWD` signals.
 */

/** Workspace env vars across hosts, plus the universal escape hatch. */
const WORKSPACE_ENV_VARS = [
  'CLAUDE_PROJECT_DIR',
  'GEMINI_PROJECT_DIR',
  'OPENCODE_PROJECT_DIR',
  'VSCODE_CWD',
  'CURSOR_CWD',
  'PI_PROJECT_DIR',
  'PREDICATE_PROJECT_DIR',
] as const;

/**
 * Detect whether a path lives inside the Claude Code plugin install tree —
 * `<home>/.claude/plugins/cache/...` or `.../marketplaces/...`. Matches both
 * POSIX and Windows separators, independent of where home is.
 */
export function isPluginInstallPath(p: string): boolean {
  if (!p) return false;
  return /[/\\]\.claude[/\\]plugins[/\\](cache|marketplaces)[/\\]/.test(p);
}

/**
 * Read the session `cwd` from the most-recently-modified Claude Code
 * transcript under `projectsRoot` (`~/.claude/projects/<enc>/<session>.jsonl`).
 * The freshest mtime wins so the active window is chosen. Returns undefined
 * when nothing usable is found.
 */
export function resolveProjectDirFromTranscript(opts: {
  projectsRoot: string;
  maxAgeMs?: number;
  nowMs?: number;
}): string | undefined {
  if (!fs.existsSync(opts.projectsRoot)) return undefined;

  let bestPath: string | undefined;
  let bestMtime = 0;
  try {
    for (const dir of fs.readdirSync(opts.projectsRoot)) {
      const dirPath = path.join(opts.projectsRoot, dir);
      let stat;
      try { stat = fs.statSync(dirPath); } catch { continue; }
      if (!stat.isDirectory()) continue;
      let files;
      try { files = fs.readdirSync(dirPath); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue;
        const fp = path.join(dirPath, f);
        try {
          const m = fs.statSync(fp).mtimeMs;
          if (m > bestMtime) { bestMtime = m; bestPath = fp; }
        } catch { /* skip */ }
      }
    }
  } catch { return undefined; }

  if (!bestPath) return undefined;
  if (typeof opts.maxAgeMs === 'number') {
    const nowMs = opts.nowMs ?? Date.now();
    if (nowMs - bestMtime > opts.maxAgeMs) return undefined;
  }

  // Transcripts can be huge; only read a small head buffer.
  try {
    const fd = fs.openSync(bestPath, 'r');
    try {
      const buf = Buffer.alloc(8192);
      const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
      const text = buf.subarray(0, bytes).toString('utf-8');
      for (const line of text.split('\n').slice(0, 10)) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as { cwd?: unknown };
          if (typeof obj.cwd === 'string' && obj.cwd.length > 0) return obj.cwd;
        } catch { /* skip malformed line */ }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch { /* file vanished mid-read */ }

  return undefined;
}

/**
 * Pure resolver. Resolution order:
 *   1. workspace env vars — first non-empty AND non-plugin-path wins
 *   2. cwd, when it is a real (non-plugin) directory — a human-run CLI must
 *      use its own terminal cwd, NOT an unrelated active Claude session's
 *      transcript. This step is skipped only when cwd is the plugin cache
 *      (the MCP-server respawn case), which is what makes 3–4 necessary.
 *   3. Claude Code transcript `cwd` (when transcriptsRoot is given)
 *   4. PWD (shell-set, survives process.chdir into the plugin dir)
 *   5. cwd (last resort; may be a plugin path — caller tolerates it)
 */
export function resolveProjectDir(opts: {
  env: Record<string, string | undefined>;
  cwd: string;
  pwd: string | undefined;
  transcriptsRoot?: string;
  transcriptMaxAgeMs?: number;
  nowMs?: number;
}): string {
  for (const name of WORKSPACE_ENV_VARS) {
    const v = opts.env[name];
    if (v && !isPluginInstallPath(v)) return v;
  }
  if (opts.cwd && !isPluginInstallPath(opts.cwd)) return opts.cwd;
  if (opts.transcriptsRoot) {
    const fromTx = resolveProjectDirFromTranscript({
      projectsRoot: opts.transcriptsRoot,
      maxAgeMs: opts.transcriptMaxAgeMs,
      nowMs: opts.nowMs,
    });
    if (fromTx && !isPluginInstallPath(fromTx)) return fromTx;
  }
  if (opts.pwd && !isPluginInstallPath(opts.pwd)) return opts.pwd;
  return opts.cwd;
}
