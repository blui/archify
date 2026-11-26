import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSCPD_VERSION } from '../archify/modules/code-analysis/lib/duplicates.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('default and compatibility share the real public CLI core while full discovers every suite', () => {
  assert.equal(manifest.scripts.test, 'pnpm run test:core');
  assert.equal(manifest.scripts['test:compat'], 'pnpm run test:core');
  assert.match(manifest.scripts['test:core'], /core-smoke\.test\.mjs/);
  assert.match(manifest.scripts['test:full'], /test:generated/);
  assert.match(manifest.scripts['test:full'], /archify\/modules\/code-analysis test && node scripts\/run-tests\.mjs$/);
  assert.ok(!manifest.scripts['test:core'].includes('golden'));
});

test('generated checks have one explicit entrypoint separate from core feedback', () => {
  const checks = manifest.scripts['test:generated'];
  for (const required of ['check:viewer', 'check:brand-marks', 'check:validators', 'check:release-identity', 'test/golden.mjs']) assert.ok(checks.includes(required));
});
