import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analysisLocale, createTranslator, messagesFor } from '../overlay/i18n.mjs';
import { buildOverview } from '../overlay/overview.mjs';

test('analysis UI locale is explicit, falls back to English and preserves literal substitutions', () => {
  for (const input of [undefined, 'en', 'fr', 'zh', '__proto__']) {
    assert.equal(analysisLocale(input), 'en');
    assert.equal(createTranslator(messagesFor(input))('Code Analysis'), 'Code Analysis');
  }
  const tr = createTranslator(messagesFor('zh-CN'));
  assert.equal(tr('Code Analysis'), '架构诊断');
  assert.equal(tr('{count} error-level diagnostics still present', { count: 3 }), '仍有 3 项错误级发现');
  assert.equal(tr('Unknown {name}', { name: '$&<source>' }), 'Unknown $&<source>');
});

test('architecture overview ranks reading hotspots and keeps coverage limits', () => {
  const repository = { language: 'ts' };
  const module = (id, loc, fanIn) => ({ id, path: id, files: 2, loc, fanIn, fanOut: 1, entry: [] });
  const graph = { repository, modules: [module('small', 10, 2), module('large', 90, 0)], edges: [],
    excluded: { roles: ['test'], files: 4 }, unresolved: { unknown: 2, opaque: 1 } };
  const overview = buildOverview({ graph, facts: { files: [], parse_errors: [{ path: 'bad.ts' }] }, unmapped: graph.modules,
    run: { rules: ['coupling/cycle'], otherLanguages: [{ adapter: 'py', files: 3 }] } });
  assert.deepEqual(overview.investigation.architecture.hotspots.map(m => m.id), ['large', 'small']);
  const c = overview.coverage;
  assert.equal(c.files.excludedByRole, 4);
  assert.equal(c.files.parseErrors.length, 1);
  assert.equal(c.unresolved.unknown + c.unresolved.opaque, 3);
  assert.deepEqual(c.otherLanguages.map(x => [x.adapter, x.files]), [['py', 3]]);
});
