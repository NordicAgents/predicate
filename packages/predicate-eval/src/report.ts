import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ScoreRow } from './eval-types.js';

const DEFAULT_FILE = join(import.meta.dirname, '..', 'results', 'scoreboard.jsonl');

export function appendScoreboard(rows: ScoreRow[], file: string = DEFAULT_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  for (const r of rows) appendFileSync(file, JSON.stringify(r) + '\n');
}

/** ASCII curve of accuracy (and lift) vs episode, for the inference-on rows. */
export function renderCurve(rows: ScoreRow[]): string {
  const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);
  if (on.length === 0) return '(no rows)';
  const domain = on[0]!.domain;
  const lines = [`domain: ${domain}  (accuracy ●  lift ·)`];
  for (const r of on) {
    const acc = Math.round(r.accuracy * 20);
    const lift = Math.round((r.lift ?? 0) * 20);
    const bar = Array.from({ length: 20 }, (_, i) =>
      i < lift ? '·' : i < acc ? '●' : ' ').join('');
    lines.push(`e${r.episode} |${bar}| acc=${r.accuracy.toFixed(2)} lift=${(r.lift ?? 0).toFixed(2)}`);
  }
  return lines.join('\n');
}
