import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, scopeStorePath } from '../src/config.js';

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

describe('loadConfig store-path resolution', () => {
  const original = { ...process.env };
  let tmp: string;

  beforeEach(() => {
    process.env = { ...original };
    tmp = mkdtempSync(join(tmpdir(), 'predicate-cfg-'));
    // Isolate from the developer's real env so resolution is deterministic.
    delete process.env.PREDICATE_STORE_PATH;
    delete process.env.XDG_DATA_HOME;
    delete process.env.CLAUDE_PROJECT_DIR;
    process.env.HOME = join(tmp, 'home'); // empty home → no user store by default
  });

  afterEach(() => {
    process.env = original;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('honours an explicit PREDICATE_STORE_PATH override above all else', () => {
    process.env.PREDICATE_STORE_PATH = join(tmp, 'explicit', 'store');
    mkdirSync(join(tmp, 'proj', '.predicate'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'proj');
    expect(loadConfig().oxigraphStorePath).toBe(join(tmp, 'explicit', 'store'));
  });

  it('finds the nearest .predicate/ marker walking up from the base dir', () => {
    mkdirSync(join(tmp, 'proj', '.predicate'), { recursive: true });
    mkdirSync(join(tmp, 'proj', 'src', 'deep'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'proj', 'src', 'deep');
    expect(loadConfig().oxigraphStorePath).toBe(join(tmp, 'proj', '.predicate', 'store'));
  });

  it('falls back to ~/.predicate/store when it exists and no marker is found', () => {
    mkdirSync(join(tmp, 'home', '.predicate', 'store'), { recursive: true });
    mkdirSync(join(tmp, 'proj'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'proj');
    expect(loadConfig().oxigraphStorePath).toBe(join(tmp, 'home', '.predicate', 'store'));
  });

  it('defaults to <baseDir>/.predicate/store when no marker and no user store', () => {
    mkdirSync(join(tmp, 'fresh'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'fresh');
    expect(loadConfig().oxigraphStorePath).toBe(join(tmp, 'fresh', '.predicate', 'store'));
  });

  it('prefers a project marker over an existing user store', () => {
    mkdirSync(join(tmp, 'home', '.predicate', 'store'), { recursive: true });
    mkdirSync(join(tmp, 'proj', '.predicate'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'proj');
    expect(loadConfig().oxigraphStorePath).toBe(join(tmp, 'proj', '.predicate', 'store'));
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
    expect(scopeStorePath('local', base)).toBe(join(base, '.predicate', 'store'));
  });

  it('maps "project" to the git-root .predicate/store', () => {
    const root = join(tmp, 'repo');
    const sub = join(root, 'a', 'b');
    mkdirSync(join(root, '.git'), { recursive: true });
    mkdirSync(sub, { recursive: true });
    expect(scopeStorePath('project', sub)).toBe(join(root, '.predicate', 'store'));
  });

  it('maps "project" to baseDir when no git root is found', () => {
    const base = join(tmp, 'loose');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('project', base)).toBe(join(base, '.predicate', 'store'));
  });

  it('maps "user" to ~/.predicate/store regardless of baseDir', () => {
    const base = join(tmp, 'anywhere');
    mkdirSync(base, { recursive: true });
    expect(scopeStorePath('user', base)).toBe(join(tmp, 'home', '.predicate', 'store'));
  });
});
