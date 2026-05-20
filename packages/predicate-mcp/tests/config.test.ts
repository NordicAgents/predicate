import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, scopeStorePath, projectStorePath, userStorePath } from '../src/config.js';

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

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.PREDICATE_STORE_PATH;
    delete process.env.XDG_DATA_HOME;
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.PWD;
    process.env.HOME = '/home/u';
  });
  afterEach(() => { process.env = original; });

  it('honours an explicit PREDICATE_STORE_PATH override above all else', () => {
    process.env.PREDICATE_STORE_PATH = '/explicit/store';
    process.env.CLAUDE_PROJECT_DIR = '/proj';
    expect(loadConfig().oxigraphStorePath).toBe('/explicit/store');
  });

  it('keys the store by the resolved project dir (CLAUDE_PROJECT_DIR)', () => {
    process.env.CLAUDE_PROJECT_DIR = '/proj/x';
    expect(loadConfig().oxigraphStorePath).toBe(projectStorePath('/proj/x'));
  });

  it('rejects a plugin-cache project dir and keys by PWD instead', () => {
    process.env.CLAUDE_PROJECT_DIR = '/home/u/.claude/plugins/cache/predicate/predicate/2.0.9';
    process.env.PWD = '/proj/real';
    expect(loadConfig().oxigraphStorePath).toBe(projectStorePath('/proj/real'));
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

  it('maps "local" to the project-keyed store for baseDir', () => {
    const base = join(tmp, 'work', 'sub');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('local', base)).toBe(projectStorePath(base));
  });

  it('maps "project" to the project-keyed store for the git root', () => {
    const root = join(tmp, 'repo');
    const sub = join(root, 'a', 'b');
    mkdirSync(join(root, '.git'), { recursive: true });
    mkdirSync(sub, { recursive: true });
    expect(scopeStorePath('project', sub)).toBe(projectStorePath(root));
  });

  it('maps "project" to baseDir when no git root is found', () => {
    const base = join(tmp, 'loose');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('project', base)).toBe(projectStorePath(base));
  });

  it('maps "user" to ~/.predicate/store regardless of baseDir', () => {
    const base = join(tmp, 'anywhere');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('user', base)).toBe(userStorePath());
    expect(scopeStorePath('user', base)).toBe(join(tmp, 'home', '.predicate', 'store'));
  });
});
