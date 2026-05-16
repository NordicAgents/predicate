import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

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
