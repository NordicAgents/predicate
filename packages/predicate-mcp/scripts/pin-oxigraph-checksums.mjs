import { createHash } from 'node:crypto';

const VERSION = '0.5.8';
const ASSETS = [
  `oxigraph_v${VERSION}_aarch64_apple`,
  `oxigraph_v${VERSION}_x86_64_apple`,
  `oxigraph_v${VERSION}_aarch64_linux_gnu`,
  `oxigraph_v${VERSION}_x86_64_linux_gnu`,
  `oxigraph_v${VERSION}_aarch64_windows_msvc.exe`,
  `oxigraph_v${VERSION}_x86_64_windows_msvc.exe`,
];

for (const asset of ASSETS) {
  const url = `https://github.com/oxigraph/oxigraph/releases/download/v${VERSION}/${asset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${asset}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');
  console.log(`  '${asset}': '${sha}',`);
}
