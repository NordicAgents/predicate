import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { homeRoot } from '../config.js';

/** Thrown when the native Oxigraph backend cannot be made available; the
 *  caller (DefaultOxigraphAdapter) treats this as the signal to fall back to
 *  the in-process WASM store. */
export class BackendUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailable';
  }
}

export const OXIGRAPH_VERSION = '0.5.8';

const ASSET_BY_TARGET: Record<string, string> = {
  'darwin-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_apple`,
  'darwin-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_apple`,
  'linux-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_linux_gnu`,
  'linux-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_linux_gnu`,
  'win32-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_windows_msvc.exe`,
  'win32-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_windows_msvc.exe`,
};

// SHA-256 of each release asset, pinned from the v0.5.8 GitHub release.
// Populate via scripts/pin-oxigraph-checksums.mjs (Task 3).
const SHA256_BY_ASSET: Record<string, string> = {
  // filled in Task 3
};

export function detectTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const key = `${platform}-${arch}`;
  const asset = ASSET_BY_TARGET[key];
  if (!asset) throw new BackendUnavailable(`no prebuilt oxigraph binary for ${key}`);
  return asset;
}

export function binDir(): string {
  return join(homeRoot(), 'bin');
}

export function binPath(asset = detectTarget()): string {
  return join(binDir(), asset.endsWith('.exe') ? 'oxigraph.exe' : 'oxigraph');
}

function downloadUrl(asset: string): string {
  return `https://github.com/oxigraph/oxigraph/releases/download/v${OXIGRAPH_VERSION}/${asset}`;
}

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Ensure the native oxigraph binary exists locally; download + verify on first
 *  use. Returns the executable path. Throws BackendUnavailable on any failure. */
export async function ensureBinary(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const asset = detectTarget();
  const dest = binPath(asset);
  if (await fileExists(dest)) return dest;

  const expected = SHA256_BY_ASSET[asset];
  if (!expected) throw new BackendUnavailable(`no pinned checksum for ${asset}`);

  let bytes: Uint8Array;
  try {
    const res = await fetchImpl(downloadUrl(asset));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    throw new BackendUnavailable(`download failed for ${asset}: ${(err as Error).message}`);
  }

  const got = sha256(bytes);
  if (got !== expected) {
    throw new BackendUnavailable(`checksum mismatch for ${asset}: expected ${expected}, got ${got}`);
  }

  await fs.mkdir(binDir(), { recursive: true });
  const tmp = `${dest}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.chmod(tmp, 0o755);
  await fs.rename(tmp, dest);
  return dest;
}
