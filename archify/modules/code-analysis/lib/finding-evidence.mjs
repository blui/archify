// The evidence a review decision is bound to: each selected finding's cited
// lines, hashed from the source text captured with the run, plus its evidence
// digest and any external report binding. lib/evidence.mjs compares this with
// the current working tree before a finding can be accepted.
import { createHash } from 'node:crypto';
import { fail, findRanges, rangeDigest, splitLines } from '../core/index.mjs';
import { verifyEvidence } from './evidence.mjs';
import { locationsOf, MAX_LOCATIONS } from './finding-locations.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The hash of one cited range and how often the same lines occur in the
// captured file. More than once means a later match elsewhere cannot be taken
// as this location having moved. A location without captured text keeps a
// null hash and stays unverifiable.
export function hashLocation(loc, lines) {
  if (loc.kind === 'file' || !Number.isInteger(loc.startLine)) return { ...loc, sha256: null };
  if (!lines || loc.endLine > lines.length || loc.startLine < 1) return { ...loc, sha256: null };
  const digest = rangeDigest(lines, loc.startLine, loc.endLine);
  // A different first line cannot match for valid Unicode. UTF-8 hashing folds
  // lone surrogates to U+FFFD, so historical JSON strings containing them keep
  // the digest-only search across every candidate window.
  const firstLine = lines.some(line => /[\uD800-\uDFFF]/u.test(line)) ? null : lines[loc.startLine - 1];
  const capturedOccurrences = findRanges(lines, loc.endLine - loc.startLine + 1, digest, firstLine).length;
  return { ...loc, sha256: digest, ...(capturedOccurrences > 1 ? { capturedOccurrences } : {}) };
}

// A concentration finding is checked through its digest over every member
// file, not through a sample of cited lines.
const digestOnly = (d) => !d.external && d.code === 'coupling/concentration' && d.subject?.module && !d.subject.file
  && d.evidenceDigest?.files?.length;

export function captureEvidence({ findings, facts, ids }) {
  if (!findings || !Array.isArray(findings.diagnostics)) fail('evidence/input-invalid', 'The evidence check needs a findings document.', { supportedFixes: ['pass findings.json of the analysis run'] });
  if (!facts || !Array.isArray(facts.files)) fail('evidence/input-invalid', 'The evidence check needs the raw facts of the same run.', { supportedFixes: ['pass raw-facts.json of the analysis run'] });
  if (findings.repository?.snapshotId && facts.repository?.snapshotId && findings.repository.snapshotId !== facts.repository.snapshotId) {
    fail('evidence/snapshot-mismatch', 'findings.json and raw-facts.json come from different analysis runs.', {
      evidence: { findings: findings.repository.snapshotId, facts: facts.repository.snapshotId }, supportedFixes: ['use both files from the same analysis directory'],
    });
  }
  const wanted = [...new Set(ids || [])];
  if (!wanted.length) fail('evidence/no-findings', 'Select at least one finding to check.', { supportedFixes: ['pass one or more finding ids'] });
  const byId = new Map(findings.diagnostics.map((d) => [d.id, d]));
  const unknown = wanted.filter((id) => !byId.has(id));
  if (unknown.length) fail('evidence/finding-unknown', `Unknown finding id${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`, {
    subject: { ids: unknown }, supportedFixes: ['use ids from findings.json of the same run', 're-run the analysis if the ids come from an older page'],
  });
  const selected = wanted.map((id) => byId.get(id));
  const source = new Map(facts.files.map((f) => [f.path, typeof f.sourceText === 'string' ? splitLines(f.sourceText) : null]));
  const external = selected.filter((d) => d.external);
  const sourceIds = new Set(external.map((d) => d.external.sourceId));
  const externalSources = (findings.analysis?.external || []).filter((s) => sourceIds.has(s.id)).sort((a, b) => compareText(a.id, b.id));
  const externalFiles = new Set(external.flatMap((d) => [...(d.evidenceDigest?.files || []), ...locationsOf(d).map((l) => l.file)]));
  const supplemental = new Map();
  for (const file of findings.externalEvidence || []) {
    if (!externalFiles.has(file.path)) continue;
    if (source.has(file.path) || typeof file.sourceText !== 'string' || sha256(file.sourceText) !== file.sha256
      || (supplemental.has(file.path) && supplemental.get(file.path).text !== file.sourceText)) {
      fail('evidence/source-invalid', 'Supplemental source evidence conflicts with the captured analysis or its hash.', {
        subject: { file: file.path }, supportedFixes: ['regenerate findings.json and raw-facts.json together'],
      });
    }
    if (!supplemental.has(file.path)) supplemental.set(file.path, { text: file.sourceText, lines: splitLines(file.sourceText) });
  }
  const locations = [];
  for (const d of selected) {
    if (digestOnly(d)) continue;
    for (const loc of locationsOf(d).slice(0, MAX_LOCATIONS)) {
      locations.push(hashLocation({ findingId: d.id, ...loc }, source.has(loc.file) ? source.get(loc.file) : supplemental.get(loc.file)?.lines));
    }
  }
  return {
    findings: selected.map((d) => ({
      id: d.id,
      ...(d.evidenceDigest ? { evidenceDigest: d.evidenceDigest } : {}),
      ...(d.external ? { external: d.external } : {}),
    })),
    source: external.length ? { external: externalSources } : {},
    locations,
  };
}

// The current evidence status of the selected findings: valid, changed,
// missing or unverifiable, per finding and per cited location.
export function checkFindingEvidence({ findings, facts, ids, root, now = new Date() }) {
  return verifyEvidence(captureEvidence({ findings, facts, ids }), root, { now });
}
