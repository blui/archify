import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBrandSourceUrl } from '../archify/renderers/shared/brand-marks.mjs';

test('public brand links strip request data while preserving HTTP(S) origin and encoded paths', () => {
  for (const [input, expected] of [
    ['https://synthetic-user:synthetic-password@EXAMPLE.com:443/brand%2Fmark?session=synthetic#part', 'https://example.com/brand%2Fmark'],
    ['http://example.com:8080/a%20b?revision=synthetic#part', 'http://example.com:8080/a%20b'],
    ['https://[2001:db8::1]:8443/logo.png?size=16#part', 'https://[2001:db8::1]:8443/logo.png'],
    ['https://example.com/brand', 'https://example.com/brand'],
    ['https://example.com', 'https://example.com/'],
    ['javascript:synthetic', null],
    ['/relative', null],
  ]) {
    assert.equal(normalizeBrandSourceUrl(input), expected);
  }
  const request = new URL('https://example.com/mark?revision=synthetic#part');
  const original = request.href;
  assert.equal(normalizeBrandSourceUrl(request), 'https://example.com/mark');
  assert.equal(request.href, original, 'normalization must not mutate the request URL');
});
