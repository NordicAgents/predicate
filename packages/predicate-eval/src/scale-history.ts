import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { historySweep, renderHistory } from './scale/history-sweep.js';

const DEFAULT_SESSIONS = [10, 100, 500, 1000];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  historySweep(getAdapter(), args.length ? args : DEFAULT_SESSIONS)
    .then((rows) => { console.log(renderHistory(rows)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
