import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isPluginInstallPath,
  resolveProjectDir,
  resolveProjectDirFromTranscript,
} from '../src/project-dir.js';

describe('isPluginInstallPath', () => {
  it('matches the Claude Code plugin cache tree', () => {
    expect(isPluginInstallPath('/Users/x/.claude/plugins/cache/predicate/predicate/2.0.9')).toBe(true);
    expect(isPluginInstallPath('/Users/x/.claude/plugins/marketplaces/predicate')).toBe(true);
  });
  it('matches Windows separators', () => {
    expect(isPluginInstallPath('C:\\Users\\x\\.claude\\plugins\\cache\\p')).toBe(true);
  });
  it('does not match ordinary project paths', () => {
    expect(isPluginInstallPath('/Users/x/Work/predicate')).toBe(false);
    expect(isPluginInstallPath('')).toBe(false);
  });
});

describe('resolveProjectDir', () => {
  const PLUGIN = '/Users/x/.claude/plugins/cache/predicate/predicate/2.0.9';

  it('prefers a workspace env var', () => {
    expect(resolveProjectDir({ env: { CLAUDE_PROJECT_DIR: '/proj/a' }, cwd: '/some/cwd', pwd: undefined }))
      .toBe('/proj/a');
  });

  it('trusts a real (non-plugin) cwd over the transcript and PWD', () => {
    // A human running the CLI in their terminal: cwd is authoritative, and
    // must beat any active Claude session transcript or stale PWD.
    expect(resolveProjectDir({ env: {}, cwd: '/proj/terminal', pwd: '/proj/pwd' }))
      .toBe('/proj/terminal');
  });

  it('falls through to PWD when cwd is a plugin-cache path', () => {
    // The MCP-server case: Claude spawns it with cwd = plugin cache.
    expect(resolveProjectDir({ env: {}, cwd: PLUGIN, pwd: '/proj/real' })).toBe('/proj/real');
  });

  it('rejects an env var inside the plugin cache, using cwd instead', () => {
    expect(resolveProjectDir({ env: { CLAUDE_PROJECT_DIR: PLUGIN }, cwd: '/proj/cwd', pwd: undefined }))
      .toBe('/proj/cwd');
  });

  it('returns cwd even as a last resort when nothing else is usable', () => {
    expect(resolveProjectDir({ env: {}, cwd: '/fallback/cwd', pwd: undefined })).toBe('/fallback/cwd');
  });

  it('honours the PREDICATE_PROJECT_DIR escape hatch', () => {
    expect(resolveProjectDir({ env: { PREDICATE_PROJECT_DIR: '/proj/escape' }, cwd: '/some/cwd', pwd: undefined }))
      .toBe('/proj/escape');
  });
});

describe('resolveProjectDirFromTranscript', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'predicate-tx-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('reads cwd from the most-recently-modified transcript', () => {
    const root = join(tmp, 'projects');
    const enc = join(root, '-Users-x-Work-predicate');
    mkdirSync(enc, { recursive: true });
    writeFileSync(
      join(enc, 'session.jsonl'),
      `${JSON.stringify({ type: 'meta' })}\n${JSON.stringify({ cwd: '/Users/x/Work/predicate' })}\n`,
    );
    expect(resolveProjectDirFromTranscript({ projectsRoot: root })).toBe('/Users/x/Work/predicate');
  });

  it('returns undefined when the projects root does not exist', () => {
    expect(resolveProjectDirFromTranscript({ projectsRoot: join(tmp, 'nope') })).toBeUndefined();
  });

  it('respects the freshness guard', () => {
    const root = join(tmp, 'projects');
    const enc = join(root, 'p');
    mkdirSync(enc, { recursive: true });
    writeFileSync(join(enc, 's.jsonl'), `${JSON.stringify({ cwd: '/old/proj' })}\n`);
    // maxAgeMs 0 with a now far in the future => stale => undefined
    expect(
      resolveProjectDirFromTranscript({ projectsRoot: root, maxAgeMs: 0, nowMs: Date.now() + 1_000_000 }),
    ).toBeUndefined();
  });
});
