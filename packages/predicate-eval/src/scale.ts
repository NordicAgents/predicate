import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { sweep, renderSweep } from './scale/sweep.js';

const DEFAULT_SIZES = [25, 100, 400, 1000];

if (import.meta.url === `file://${process.argv[1]}`) {
  const sizes = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  sweep(getAdapter(), sizes.length ? sizes : DEFAULT_SIZES)
    .then((rows) => { console.log(renderSweep(rows)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
