import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadConfig,
  scopeStorePath,
  resolveStorePathForScope,
  projectStorePath,
  userStorePath,
  inRepoStorePath,
  ensureGitignoreForStore,
} from '../src/config.js';

describe('loadConfig', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it('uses defaults when no env is set', () => {
    delete process.env.FUSEKI_URL;
    delete process.env.PREDICATE_DATASET;
    const cfg = loadConfig();
    expect(cfg.fusekiUrl).toBe('http://localhost:3030');
    expect(cfg.dataset).toBe('predicate');
  });

  it('reads FUSEKI_URL from env', () => {
    process.env.FUSEKI_URL = 'http://fuseki.local:3030';
    expect(loadConfig().fusekiUrl).toBe('http://fuseki.local:3030');
  });

  it('strips trailing slash from FUSEKI_URL', () => {
    process.env.FUSEKI_URL = 'http://x:3030/';
    expect(loadConfig().fusekiUrl).toBe('http://x:3030');
  });

  it('defaults backend to oxigraph when PREDICATE_BACKEND is unset', () => {
    delete process.env.PREDICATE_BACKEND;
    expect(loadConfig().backend).toBe('oxigraph');
  });

  it('defaults backend to oxigraph when PREDICATE_BACKEND is empty or whitespace', () => {
    process.env.PREDICATE_BACKEND = '';
    expect(loadConfig().backend).toBe('oxigraph');
    process.env.PREDICATE_BACKEND = '   ';
    expect(loadConfig().backend).toBe('oxigraph');
  });

  it('honors an explicit PREDICATE_BACKEND', () => {
    process.env.PREDICATE_BACKEND = 'fuseki';
    expect(loadConfig().backend).toBe('fuseki');
  });
});

describe('projectStorePath', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env = { ...original };
    delete process.env.XDG_DATA_HOME;
    process.env.HOME = '/home/u';
  });
  afterEach(() => { process.env = original; });

  it('keys the store under ~/.predicate/projects/<hash>/store', () => {
    const p = projectStorePath('/Users/x/Work/predicate');
    expect(p.startsWith(join('/home/u', '.predicate', 'projects'))).toBe(true);
    expect(p.endsWith(join('store'))).toBe(true);
  });

  it('is deterministic for the same project dir', () => {
    expect(projectStorePath('/proj/a')).toBe(projectStorePath('/proj/a'));
  });

  it('differs between projects', () => {
    expect(projectStorePath('/proj/a')).not.toBe(projectStorePath('/proj/b'));
  });

  it('is stable across relative vs absolute spellings of the same dir', () => {
    expect(projectStorePath('/proj/a/')).toBe(projectStorePath('/proj/a'));
  });
});

describe('loadConfig store-path resolution', () => {
  const original = { ...process.env };
  let tmp: string;

  beforeEach(() => {
    process.env = { ...original };
    tmp = mkdtempSync(join(tmpdir(), 'predicate-res-'));
    delete process.env.PREDICATE_STORE_PATH;
    delete process.env.XDG_DATA_HOME;
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.PWD;
    process.env.HOME = join(tmp, 'home');
  });
  afterEach(() => {
    process.env = original;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('honours an explicit PREDICATE_STORE_PATH override above all else', () => {
    process.env.PREDICATE_STORE_PATH = '/explicit/store';
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'proj');
    expect(loadConfig().oxigraphStorePath).toBe('/explicit/store');
  });

  it('resolveStorePathForScope: an explicit --scope maps to its path when no env override', () => {
    expect(resolveStorePathForScope('local', '/work/proj')).toBe(scopeStorePath('local', '/work/proj'));
  });

  it('resolveStorePathForScope: PREDICATE_STORE_PATH wins even when --scope is given', () => {
    process.env.PREDICATE_STORE_PATH = '/explicit/store';
    // Without this, `up --scope local` opens ./.predicate/store while the
    // server/CLI read PREDICATE_STORE_PATH — two divergent stores.
    expect(resolveStorePathForScope('local', '/work/proj')).toBe('/explicit/store');
  });

  it('uses <git-root>/.predicate/store inside a git repo', () => {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = repo;
    expect(loadConfig().oxigraphStorePath).toBe(inRepoStorePath(repo));
  });

  it('reuses an existing .predicate/store from a parent dir (subdir work)', () => {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    mkdirSync(join(repo, '.predicate', 'store'), { recursive: true });
    const sub = join(repo, 'packages', 'x');
    mkdirSync(sub, { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = sub;
    expect(loadConfig().oxigraphStorePath).toBe(inRepoStorePath(repo));
  });

  it('does NOT reuse the global ~/.predicate/store as a parent store (git repo under home)', () => {
    // Repro of the reported bug: home is an ancestor of every project, and the
    // global store lives at <home>/.predicate/store — the walk-up must ignore
    // it so a git repo still gets its own in-repo store.
    mkdirSync(join(tmp, 'home', '.predicate', 'store'), { recursive: true });
    const repo = join(tmp, 'home', 'work', 'myrepo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = repo;
    expect(loadConfig().oxigraphStorePath).toBe(inRepoStorePath(repo));
  });

  it('falls back to the home-keyed store for a non-git dir', () => {
    const dir = join(tmp, 'loose');
    mkdirSync(dir, { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = dir;
    expect(loadConfig().oxigraphStorePath).toBe(projectStorePath(dir));
  });

  it('rejects a plugin-cache cwd and resolves via PWD (the MCP-server case)', () => {
    const repo = join(tmp, 'realrepo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    process.env.PWD = repo;
    // Simulate the Claude-spawned MCP server: cwd is the plugin cache.
    const pluginCwd = join(tmp, 'home', '.claude', 'plugins', 'cache', 'predicate', 'predicate', '2.0.11');
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(pluginCwd);
    try {
      expect(loadConfig().oxigraphStorePath).toBe(inRepoStorePath(repo));
    } finally {
      cwdSpy.mockRestore();
    }
  });
});

describe('scopeStorePath', () => {
  const original = { ...process.env };
  let tmp: string;

  beforeEach(() => {
    process.env = { ...original };
    tmp = mkdtempSync(join(tmpdir(), 'predicate-scope-'));
    delete process.env.XDG_DATA_HOME;
    process.env.HOME = join(tmp, 'home');
  });

  afterEach(() => {
    process.env = original;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('maps "local" to <baseDir>/.predicate/store', () => {
    const base = join(tmp, 'work', 'sub');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('local', base)).toBe(inRepoStorePath(base));
  });

  it('maps "project" to the git-root .predicate/store', () => {
    const root = join(tmp, 'repo');
    const sub = join(root, 'a', 'b');
    mkdirSync(join(root, '.git'), { recursive: true });
    mkdirSync(sub, { recursive: true });
    expect(scopeStorePath('project', sub)).toBe(inRepoStorePath(root));
  });

  it('maps "user" to ~/.predicate/store regardless of baseDir', () => {
    const base = join(tmp, 'anywhere');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('user', base)).toBe(userStorePath());
    expect(scopeStorePath('user', base)).toBe(join(tmp, 'home', '.predicate', 'store'));
  });
});

describe('ensureGitignoreForStore', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'predicate-gi-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('adds .predicate/ to the repo .gitignore for an in-repo store', () => {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    ensureGitignoreForStore(inRepoStorePath(repo));
    expect(readFileSync(join(repo, '.gitignore'), 'utf8')).toContain('.predicate/');
  });

  it('is idempotent', () => {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, '.git'), { recursive: true });
    ensureGitignoreForStore(inRepoStorePath(repo));
    ensureGitignoreForStore(inRepoStorePath(repo));
    const body = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(body.match(/\.predicate\//g)?.length).toBe(1);
  });

  it('does nothing outside a git repo', () => {
    const dir = join(tmp, 'plain');
    mkdirSync(dir, { recursive: true });
    ensureGitignoreForStore(inRepoStorePath(dir));
    expect(existsSync(join(dir, '.gitignore'))).toBe(false);
  });
});
