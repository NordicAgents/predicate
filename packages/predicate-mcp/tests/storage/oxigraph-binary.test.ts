import { describe, it, expect } from 'vitest';
import { detectTarget, BackendUnavailable, OXIGRAPH_VERSION } from '../../src/storage/oxigraph-binary.js';

describe('detectTarget', () => {
  it('maps darwin/arm64 to the aarch64 apple asset', () => {
    expect(detectTarget('darwin', 'arm64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_aarch64_apple`);
  });
  it('maps linux/x64 to the x86_64 linux gnu asset', () => {
    expect(detectTarget('linux', 'x64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_x86_64_linux_gnu`);
  });
  it('maps win32/x64 to the windows .exe asset', () => {
    expect(detectTarget('win32', 'x64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_x86_64_windows_msvc.exe`);
  });
  it('throws BackendUnavailable for an unsupported target', () => {
    expect(() => detectTarget('sunos', 'mips')).toThrow(BackendUnavailable);
  });
});
