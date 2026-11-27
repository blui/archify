import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { extractFacts } from '../lib/analysis.mjs';
import { readEntry } from './entry-reader.mjs';

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-incoming-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(root, file), source);
  return { root, facts: extractFacts(root, { language: 'ts' }).facts, entry: 'target.mjs', symbol: 'work' };
}

test('incoming uses exact bound declaration identity, including initializer and same-line targets', t => {
  const args = fixture(t, {
    'target.mjs': 'export function work() {} export function other() {}\nexport const arrow = () => {};\n',
    'caller.mjs': "import {work,other,arrow} from './target.mjs';\nwork(); other(); arrow();\n",
    'other.mjs': 'export function work() {}\nwork();\n',
    'local.mjs': "import './target.mjs';\nfunction work() {} work();\n",
  });
  const brief = readEntry(args);
  assert.equal(brief.importers.total, 2);
  assert.deepEqual(brief.importers.records.map(r => r.fact.from), ['caller.mjs', 'local.mjs']);
  assert.ok(brief.importers.records.every(r => r.origin.factsStatus === 'valid' && r.navigation.location.line === 1));
  assert.equal(brief.callers.total, 1, 'same names in other files and a same-line sibling are not callers');
  const [record] = brief.callers.records;
  assert.deepEqual(record.fact, args.facts.calls[record.factIndex]);
  assert.equal(record.targetNavigation.status, 'valid');
  assert.deepEqual(record.navigation.location, { file: 'caller.mjs', line: 2, column: 1, endLine: 2, endColumn: 7 });
  assert.equal(record.fact.directCaller, undefined, 'do not invent a containing function');
  assert.equal(readEntry({ ...args, symbol: 'arrow' }).callers.total, 1);
  assert.equal(readEntry({ ...args, symbol: undefined }).callers.total, 3, 'file mode counts all bound targets in that file');
  const wrongColumn = structuredClone(args.facts);
  wrongColumn.calls[record.factIndex].target.column++;
  assert.equal(readEntry({ ...args, facts: wrongColumn }).callers.total, 0, 'declaration column participates in identity');
});

test('reverse limits apply after target selection, with deterministic omitted counts', t => {
  const files = { 'target.mjs': 'export function work() {}\n' };
  for (let i = 0; i < 43; i++) files[`caller-${String(i).padStart(2, '0')}.mjs`] = "import {work} from './target.mjs';\n" + 'unknown();\n'.repeat(45) + 'work();\n';
  const args = fixture(t, files);
  const brief = readEntry(args);
  for (const list of [brief.importers, brief.callers]) {
    assert.equal(list.coverage, 'available');
    assert.equal(list.total, 43); assert.equal(list.included, 40); assert.equal(list.omitted, 3);
    assert.equal(list.records.length, 40);
  }
  assert.equal(brief.callers.records[0].navigation.location.line, 47, 'outgoing per-file limits must not hide later incoming matches');
  const reordered = { ...args, facts: { ...args.facts, calls: [...args.facts.calls].reverse(), imports: [...args.facts.imports].reverse() } };
  assert.deepEqual(readEntry(reordered).callers.records.map(r => r.navigation), brief.callers.records.map(r => r.navigation));
});

test('incoming freshness checks origins and forwarding paths without claiming current bindings', t => {
  const args = fixture(t, {
    'target.mjs': 'export function work() {}\n',
    'api.mjs': "export {work} from './target.mjs';\n",
    'caller.mjs': "import {work} from './api.mjs';\nwork();\n",
  });
  assert.equal(readEntry(args).callers.records[0].navigation.status, 'valid');
  fs.appendFileSync(path.join(args.root, 'api.mjs'), '// forwarding changed\n');
  let brief = readEntry(args);
  assert.equal(brief.callers.total, 1, 'totals remain captured totals');
  assert.equal(brief.callers.records[0].targetNavigation.reason, 'forwarding-path-changed');
  assert.equal(brief.callers.records[0].navigation.location, null);
  assert.equal(brief.importers.records[0].origin.factsStatus, 'changed');
  fs.appendFileSync(path.join(args.root, 'caller.mjs'), '// caller changed\n');
  brief = readEntry(args);
  assert.equal(brief.callers.records[0].navigation.status, 'changed');
  fs.rmSync(path.join(args.root, 'caller.mjs'));
  assert.equal(readEntry(args).callers.records[0].origin.factsStatus, 'missing');
  fs.appendFileSync(path.join(args.root, 'target.mjs'), '// target changed\n');
  brief = readEntry(args);
  assert.equal(brief.callers.coverage, 'unavailable'); assert.equal(brief.callers.total, null);
  assert.equal(brief.importers.reason, 'entry-changed');
});

test('unavailable call models stay unknown, importers remain usable, and recovered origins are not navigable', t => {
  const args = fixture(t, {
    'target.mjs': 'export function work() {}\n',
    'caller.mjs': "import {work} from './target.mjs';\nwork();\n",
  });
  for (const model of [undefined, 'future-unknown']) {
    const facts = { ...args.facts, callModel: model };
    const brief = readEntry({ ...args, facts });
    assert.equal(brief.callers.coverage, 'unavailable'); assert.equal(brief.callers.total, null);
    assert.equal(brief.importers.total, 1);
  }
  const absent = readEntry({ ...args, facts: null });
  assert.equal(absent.callers.total, null); assert.equal(absent.importers.total, null);
  fs.appendFileSync(path.join(args.root, 'caller.mjs'), 'function broken( {');
  const facts = extractFacts(args.root, { language: 'ts' }).facts;
  const brief = readEntry({ ...args, facts });
  assert.equal(brief.importers.records[0].navigation.status, 'parse-error');
  assert.equal(brief.importers.records[0].navigation.location, null);
});
