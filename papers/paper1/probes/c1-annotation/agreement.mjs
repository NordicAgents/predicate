// agreement.mjs — inter-annotator agreement for the C1 semantic-annotation
// harness, registered as EXPLORATORY TOOLING in pre-registration Amendment
// A4.4. Reads the two filled annotator CSVs produced from the sample-cli.mjs
// skeletons and computes: label distribution per annotator, raw agreement,
// Cohen's kappa, and a confusion matrix; writes adjudication.csv listing only
// the disagreeing rows for a third-pass adjudicator.
//
// CSV dialect: RFC4180-minimal, matching sample-cli.mjs — fields containing
// comma, quote, CR, or LF are double-quoted with internal quotes doubled
// (the rationale field routinely contains commas). Documented in guide.md.
//
// Rows where EITHER annotator left the label blank are excluded from all
// statistics and reported as a count. Labels outside the registered
// vocabulary are also excluded (counted separately) so a typo cannot
// silently enter kappa.
//
// The resulting semantic-disagreement rate is NOT citable as a confirmatory
// number under the current registration (A4.4): confirmatory use requires a
// future pre-registration amendment.
//
// Usage:
//   node agreement.mjs <annotator-A.csv> <annotator-B.csv> [output-dir]
// output-dir default: the directory containing annotator-A.csv (never the
// repo — adjudication.csv carries annotator rationales about record text).
//
// Node builtins only.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const LABELS = [
  'semantic-contradiction',
  'representational-difference',
  'temporal-supersession',
  'scope-difference',
  'agree',
  'unsure',
];

const [fileA, fileB, outDirArg] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error('usage: node agreement.mjs <annotator-A.csv> <annotator-B.csv> [output-dir]');
  process.exit(1);
}
const outDir = outDirArg ?? dirname(resolve(fileA));

/** Minimal RFC4180 parser (quoted fields may contain commas/quotes/newlines). */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  // Drop trailing fully-empty rows (final newline artifacts).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
};

const loadAnnotations = (path) => {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const header = rows[0]?.map((h) => h.trim());
  const expect = ['cve', 'stratum', 'label', 'rationale'];
  if (!header || expect.some((h, i) => header[i] !== h)) {
    console.error(`${path}: expected header "${expect.join(',')}", got "${header?.join(',')}"`);
    process.exit(1);
  }
  const byCve = new Map();
  for (const r of rows.slice(1)) {
    const [cve, stratum, label, rationale] = [r[0] ?? '', r[1] ?? '', r[2] ?? '', r[3] ?? ''];
    byCve.set(cve.trim(), { stratum: stratum.trim(), label: label.trim(), rationale });
  }
  return byCve;
};

const A = loadAnnotations(fileA);
const B = loadAnnotations(fileB);

const cves = [...A.keys()].filter((c) => B.has(c));
const onlyA = [...A.keys()].filter((c) => !B.has(c)).length;
const onlyB = [...B.keys()].filter((c) => !A.has(c)).length;
if (onlyA || onlyB) {
  console.error(`WARNING: row sets differ (only in A: ${onlyA}, only in B: ${onlyB}); using the intersection.`);
}

let blank = 0;
let invalid = 0;
const paired = []; // { cve, stratum, a, b, rationaleA, rationaleB }
for (const cve of cves) {
  const a = A.get(cve);
  const b = B.get(cve);
  if (a.label === '' || b.label === '') { blank++; continue; }
  if (!LABELS.includes(a.label) || !LABELS.includes(b.label)) {
    console.error(`invalid label on ${cve}: A="${a.label}" B="${b.label}" — excluded`);
    invalid++;
    continue;
  }
  paired.push({ cve, stratum: a.stratum, a: a.label, b: b.label, rationaleA: a.rationale, rationaleB: b.rationale });
}

if (paired.length === 0) {
  console.error('no doubly-labelled rows — nothing to compute.');
  process.exit(1);
}

// ---- statistics ------------------------------------------------------------

const dist = (key) => {
  const d = Object.fromEntries(LABELS.map((l) => [l, 0]));
  for (const p of paired) d[p[key]]++;
  return d;
};
const distA = dist('a');
const distB = dist('b');

const n = paired.length;
const agreeN = paired.filter((p) => p.a === p.b).length;
const po = agreeN / n;
// Cohen's kappa: pe from the marginal label distributions of each annotator.
const pe = LABELS.reduce((s, l) => s + (distA[l] / n) * (distB[l] / n), 0);
const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);

// Confusion matrix: rows = annotator A, columns = annotator B.
const confusion = {};
for (const la of LABELS) {
  confusion[la] = Object.fromEntries(LABELS.map((lb) => [lb, 0]));
}
for (const p of paired) confusion[p.a][p.b]++;

// ---- adjudication.csv (disagreeing rows only) ------------------------------

const csvField = (v) =>
  /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
const csvRow = (cells) => cells.map(csvField).join(',');
const disagreeing = paired.filter((p) => p.a !== p.b);
const adjudication =
  [csvRow(['cve', 'stratum', 'labelA', 'rationaleA', 'labelB', 'rationaleB', 'adjudicatedLabel', 'adjudicationNote'])]
    .concat(disagreeing.map((p) =>
      csvRow([p.cve, p.stratum, p.a, p.rationaleA, p.b, p.rationaleB, '', ''])))
    .join('\n') + '\n';
const adjPath = join(outDir, 'adjudication.csv');
writeFileSync(adjPath, adjudication);

console.log(JSON.stringify({
  registration: 'pre-registration.md Amendment A4.4 (EXPLORATORY — not citable without a future amendment)',
  rowsInBoth: cves.length,
  excludedBlankLabel: blank,
  excludedInvalidLabel: invalid,
  scoredPairs: n,
  labelDistribution: { annotatorA: distA, annotatorB: distB },
  rawAgreement: po,
  cohensKappa: kappa,
  confusionMatrix: confusion, // rows: annotator A, columns: annotator B
  disagreeingRows: disagreeing.length,
  adjudicationFile: adjPath,
}, null, 2));
