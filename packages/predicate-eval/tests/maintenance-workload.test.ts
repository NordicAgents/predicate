import { describe, expect, it } from 'vitest';
import { runMaintenanceWorkload } from '../src/scale-ledger/maintenance-workload-cli.js';

describe('maintained versus on-demand workload', () => {
  it('compares both paths over the same in-memory source snapshot', () => {
    const result = runMaintenanceWorkload([100], [1, 3], 2);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0]!;
    expect(row.persons).toBe(100);
    expect(row.sampledQueries).toBe(3);
    expect(row.cwiRetained.indexEntries).toBeGreaterThan(0);
    expect(row.cwiRetained.materializedConflicts).toBeGreaterThan(0);
    expect(row.cwiRetained.totalRetainedItems).toBe(
      row.cwiRetained.indexEntries + row.cwiRetained.materializedConflicts,
    );
    expect(row.workloads.map((cell) => cell.queries)).toEqual([1, 3]);
    expect(row.workloads.every((cell) => cell.cwiTotalMs.runs.length === 2)).toBe(true);
    expect(row.workloads.every((cell) => cell.onDemandTotalMs.runs.length === 2)).toBe(true);
    expect(row.missing).toBe(0);
    expect(row.spurious).toBe(0);
  });
});
