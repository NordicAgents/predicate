import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

describe('PromotionSweeper promoted-dir resolution', () => {
  const prev = process.env['PREDICATE_PROMOTED_DIR'];
  const prevStore = process.env['PREDICATE_STORE_PATH'];
  let store: string;

  beforeEach(() => { store = mkdtempSync(join(tmpdir(), 'pred-promo-')); });
  afterEach(() => {
    if (prev === undefined) delete process.env['PREDICATE_PROMOTED_DIR']; else process.env['PREDICATE_PROMOTED_DIR'] = prev;
    if (prevStore === undefined) delete process.env['PREDICATE_STORE_PATH']; else process.env['PREDICATE_STORE_PATH'] = prevStore;
    rmSync(store, { recursive: true, force: true });
  });

  it('defaults the promoted dir under PREDICATE_STORE_PATH, not the source tree', () => {
    delete process.env['PREDICATE_PROMOTED_DIR'];
    process.env['PREDICATE_STORE_PATH'] = store;
    const sweeper = new PromotionSweeper(new OxigraphAdapter({ storePath: ':memory:' }));
    expect((sweeper as unknown as { promotedDir: string }).promotedDir).toBe(join(store, 'promoted'));
  });

  it('creates the promoted dir on demand (no pre-existing dir)', () => {
    const target = join(store, 'nested', 'promoted');
    expect(existsSync(target)).toBe(false);
    const sweeper = new PromotionSweeper(new OxigraphAdapter({ storePath: ':memory:' }), { promotedDir: target });
    (sweeper as unknown as { ensurePromotedDir(): void }).ensurePromotedDir();
    expect(existsSync(target)).toBe(true);
  });
});
