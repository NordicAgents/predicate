import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STAGED = join(homedir(), '.predicate', 'compose');

const existsSyncMock = vi.fn();
const cpSyncMock = vi.fn();

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => existsSyncMock(...args),
    cpSync: (...args: Parameters<typeof actual.cpSync>) => cpSyncMock(...args),
  };
});

async function loadFindComposeDir() {
  vi.resetModules();
  const mod = await import('../src/docker.js');
  return mod.findComposeDir;
}

describe('findComposeDir — Docker shared-path staging', () => {
  const prevEnv = process.env.PREDICATE_COMPOSE_DIR;

  beforeEach(() => {
    existsSyncMock.mockReset();
    cpSyncMock.mockReset();
    delete process.env.PREDICATE_COMPOSE_DIR;
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.PREDICATE_COMPOSE_DIR;
    else process.env.PREDICATE_COMPOSE_DIR = prevEnv;
  });

  it('returns the path unchanged when under /Users (Docker-shared)', async () => {
    process.env.PREDICATE_COMPOSE_DIR = '/Users/me/repo/compose';
    existsSyncMock.mockReturnValue(true);

    const findComposeDir = await loadFindComposeDir();
    expect(findComposeDir()).toBe('/Users/me/repo/compose');
    expect(cpSyncMock).not.toHaveBeenCalled();
  });

  it.each([
    ['/Volumes/ext/compose'],
    ['/private/var/compose'],
    ['/tmp/compose'],
    ['/var/folders/aa/bb/compose'],
  ])('returns %s unchanged (shared prefix)', async (p) => {
    process.env.PREDICATE_COMPOSE_DIR = p;
    existsSyncMock.mockReturnValue(true);

    const findComposeDir = await loadFindComposeDir();
    expect(findComposeDir()).toBe(p);
    expect(cpSyncMock).not.toHaveBeenCalled();
  });

  it('stages to ~/.predicate/compose when path is outside shared prefixes', async () => {
    process.env.PREDICATE_COMPOSE_DIR = '/opt/homebrew/lib/node_modules/predicate-skill';
    existsSyncMock.mockReturnValue(true);

    const findComposeDir = await loadFindComposeDir();
    expect(findComposeDir()).toBe(STAGED);
    expect(cpSyncMock).toHaveBeenCalledTimes(1);
    expect(cpSyncMock).toHaveBeenCalledWith(
      '/opt/homebrew/lib/node_modules/predicate-skill',
      STAGED,
      { recursive: true, force: true },
    );
  });

  it('throws when no candidate contains docker-compose.yml', async () => {
    process.env.PREDICATE_COMPOSE_DIR = '/opt/missing';
    existsSyncMock.mockReturnValue(false);

    const findComposeDir = await loadFindComposeDir();
    expect(() => findComposeDir()).toThrow(/Could not locate docker-compose\.yml/);
    expect(cpSyncMock).not.toHaveBeenCalled();
  });
});
