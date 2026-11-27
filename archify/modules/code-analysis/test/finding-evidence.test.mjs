// The evidence check that guards review acceptance: cited lines and digests
// of a run compared with an edited copy of its source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { captureEvidence, checkFindingEvidence } from '../lib/finding-evidence.mjs';
import { locationsOf } from '../lib/finding-locations.mjs';
import { analyzeFixture, copySource, prepend, replace } from './py-fixture.mjs';

function analyzed(t) {
  const dir = copySource();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, ...analyzeFixture(dir) };
}
const pick = (findings, code) => {
  const finding = findings.diagnostics.find((d) => d.code === code);
  assert.ok(finding, `fixture produced no ${code} finding`);
  return finding;
};
const check = (run, finding, root) => checkFindingEvidence({ findings: run.findings, facts: run.facts, ids: [finding.id], root, now: new Date('2026-10-17T00:00:00.000Z') });

test('unchanged source keeps every cited finding valid', t => {
  const run = analyzed(t);
  for (const code of ['complexity/function', 'coupling/import-cycle', 'coupling/cycle', 'architecture/boundary']) {
    const finding = pick(run.findings, code);
    assert.equal(check(run, finding, run.dir).evidence.findings[finding.id].status, 'valid', code);
  }
});

test('a function that only moved stays valid and reports its new position', t => {
  const run = analyzed(t);
  const finding = pick(run.findings, 'complexity/function');
  prepend(run.dir, 'app/engine.py', '# routing table lives in docs/routing.md\n');
  const result = check(run, finding, run.dir);
  assert.equal(result.evidence.findings[finding.id].status, 'valid');
  const [location] = result.locations;
  assert.equal(location.currentStartLine, location.startLine + 1);
});

test('an edited cited import marks the finding changed', t => {
  const run = analyzed(t);
  const finding = pick(run.findings, 'coupling/import-cycle');
  replace(run.dir, 'app/b.py', 'from app.a import DEFAULT_TIMEOUT', 'from app.a import DEFAULT_TIMEOUT  # noqa');
  assert.equal(check(run, finding, run.dir).evidence.findings[finding.id].status, 'changed');
});

test('a deleted importing file marks the finding missing', t => {
  const run = analyzed(t);
  const finding = pick(run.findings, 'architecture/boundary');
  fs.rmSync(path.join(run.dir, 'domain/order.py'));
  assert.equal(check(run, finding, run.dir).evidence.findings[finding.id].status, 'missing');
});

test('captured evidence hashes each cited location of the selected findings only', t => {
  const run = analyzed(t);
  const finding = pick(run.findings, 'coupling/import-cycle');
  const captured = captureEvidence({ findings: run.findings, facts: run.facts, ids: [finding.id] });
  assert.deepEqual(captured.findings.map((f) => f.id), [finding.id]);
  assert.equal(captured.locations.length, locationsOf(finding).length);
  assert.ok(captured.locations.every((loc) => loc.findingId === finding.id && /^[0-9a-f]{64}$/.test(loc.sha256)));
  assert.throws(() => captureEvidence({ findings: run.findings, facts: run.facts, ids: ['XX-000000000000'] }), /Unknown finding id/);
});
