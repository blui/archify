import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BRAND_MARKS } from '../archify/renderers/shared/generated-brand-marks.mjs';
import {
  THIRD_PARTY_NOTICE_DISCLOSURE_COUNT,
  validateThirdPartyNotices,
} from '../scripts/third-party-notices-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '..', 'archify');
const cli = path.join(skillRoot, 'bin', 'archify.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-brand-marks-'));
const cases = {
  architecture: ['web-app.architecture.json', 'components'],
  workflow: ['agent-tool-call.workflow.json', 'nodes'],
  sequence: ['cache-miss-request.sequence.json', 'participants'],
  dataflow: ['product-analytics.dataflow.json', 'nodes'],
  lifecycle: ['agent-run.lifecycle.json', 'states'],
};

test('third-party notices cover every recorded individual mark license', () => {
  const notices = fs.readFileSync(path.join(skillRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const licensedMarks = BRAND_MARKS.filter((mark) => mark.provenance?.license);

  assert.equal(THIRD_PARTY_NOTICE_DISCLOSURE_COUNT, 39, 'notice contract changed without review');
  assert.deepEqual(validateThirdPartyNotices(notices), { ok: true, missing: [] });
  assert.equal(licensedMarks.length, 8, 'pinned Simple Icons license inventory changed');
  for (const mark of licensedMarks) {
    assert.match(notices, new RegExp(`\\| ${mark.title.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\|`));
    assert.ok(notices.includes(mark.provenance.source), `${mark.id} source must be disclosed`);
    assert.ok(notices.includes(mark.provenance.license.type), `${mark.id} license must be disclosed`);
  }
  assert.match(notices, /OpenAI brand guidelines/);
  assert.match(notices, /does not state or imply endorsement by OpenAI/);
  assert.match(notices, /does not imply sponsorship, endorsement, partnership/);
  assert.match(notices, /commercial, promotional, or redistributive use/);
  assert.match(notices, /does not grant rights\s+that Archify does not hold/);
});

function writeFixture(type, name, brand, customize) {
  const [example, collection] = cases[type];
  const value = JSON.parse(fs.readFileSync(path.join(skillRoot, 'examples', example), 'utf8'));
  value[collection][0].brand = brand;
  customize?.(value, value[collection][0]);
  const file = path.join(tmp, `${name}.${type}.json`);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function renderSync(type, input, name, env = {}) {
  const output = path.join(tmp, `${name}.html`);
  const result = spawnSync(process.execPath, [
    path.join(skillRoot, `renderers/${type}/render-${type}.mjs`),
    input,
    output,
  ], {
    cwd: skillRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { result, output, html: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '' };
}

function nodeBlock(html, id) {
  const startToken = `<g id="node-${id}"`;
  const start = html.indexOf(startToken);
  if (start === -1) return '';
  const candidates = [
    html.indexOf('\n        <g id="node-', start + startToken.length),
    html.indexOf('\n        <!-- Connection labels', start + startToken.length),
    html.indexOf('\n        <!-- Transition labels', start + startToken.length),
    html.indexOf('\n        <!-- Message labels', start + startToken.length),
  ].filter((value) => value !== -1);
  return html.slice(start, candidates.length ? Math.min(...candidates) : html.length);
}

test('generated catalog exposes a substantial, unique, provenance-backed preset library', () => {
  assert.equal(BRAND_MARKS.length, 107);
  assert.equal(new Set(BRAND_MARKS.map((mark) => mark.id)).size, BRAND_MARKS.length);
  for (const mark of BRAND_MARKS) {
    assert.match(mark.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(mark.title);
    assert.ok(mark.category);
    assert.match(mark.hex, /^[0-9A-F]{6}$/i);
    assert.match(mark.path, /^[Mm]/);
    assert.ok(mark.provenance?.source);
  }
});

test('brand discovery resolves model names, aliases, domains, and Chinese channel aliases', () => {
  for (const [query, expected] of [
    ['GPT', 'openai'],
    ['Gemini', 'google-gemini'],
    ['github.com', 'github'],
    ['微信', 'wechat'],
  ]) {
    const result = spawnSync(process.execPath, [cli, 'brands', query, '--json'], {
      cwd: skillRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, true);
    assert.ok(receipt.marks.some((mark) => mark.id === expected), query);
  }
});

test('all five renderers keep the semantic sigil and add one export-safe brand badge', () => {
  for (const type of Object.keys(cases)) {
    const input = writeFixture(type, `preset-${type}`, 'openai', (_diagram, node) => {
      if (type === 'lifecycle') Object.assign(node, { step: node.step || '01', icon: 'start' });
    });
    const { result, html } = renderSync(type, input, `preset-${type}`);
    assert.equal(result.status, 0, `${type}: ${result.stderr || result.stdout}`);
    assert.match(html, /data-node-brand="OpenAI"/i, type);
    assert.match(html, /data-brand-mark="openai"[^>]+data-brand-status="preset"/i, type);
    assert.match(html, /class="semantic-sigil /, type);
    assert.match(html, /<title>[^<]*OpenAI<\/title>/i, type);

    const [, collection] = cases[type];
    const diagram = JSON.parse(fs.readFileSync(input, 'utf8'));
    const block = nodeBlock(html, diagram[collection][0].id);
    const frame = block.match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)" rx="[^"]+" class="c-mask"\/>/);
    const semantic = block.match(/data-semantic-sigil[^>]+translate\(([-\d.]+) ([-\d.]+)\)/);
    const brand = block.match(/data-brand-mark="openai"[^>]+translate\(([-\d.]+) ([-\d.]+)\)">\s*<rect width="([-\d.]+)" height="([-\d.]+)" rx="([-\d.]+)" class="brand-mark-badge"\/>/);
    assert.ok(frame && semantic && brand, `${type}: expected node frame, semantic sigil, and brand badge`);

    const [frameX, frameY, frameWidth] = frame.slice(1, 4).map(Number);
    const [, semanticY] = semantic.slice(1, 3).map(Number);
    const [brandX, brandY, brandWidth, brandHeight, brandRadius] = brand.slice(1, 6).map(Number);
    assert.equal(brandWidth, 16, `${type}: brand badge width`);
    assert.equal(brandHeight, 16, `${type}: brand badge height`);
    assert.equal(brandRadius, 4, `${type}: brand badge radius`);
    assert.equal(brandY - frameY, 6, `${type}: brand badge top inset`);
    assert.equal(frameX + frameWidth - (brandX + brandWidth), 6, `${type}: brand badge right inset`);
    assert.equal(brandY, semanticY, `${type}: brand and semantic marks share a top rail`);
  }
});

test('compact architecture centers the existing 16px badge without resizing the node', () => {
  for (const height of [23, 24, 28]) {
    const name = `centered-brand-${height}`;
    const input = writeFixture('architecture', name, 'openai', (_diagram, node) => {
      node.size = [120, height];
      delete node.sublabel;
      delete node.tag;
    });
    const { result, html } = renderSync('architecture', input, name);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const id = JSON.parse(fs.readFileSync(input, 'utf8')).components[0].id;
    const block = nodeBlock(html, id);
    const frame = block.match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)" rx="[^"]+" class="c-mask"\/>/);
    const brand = block.match(/data-brand-mark="openai"[^>]+translate\(([-\d.]+) ([-\d.]+)\)">\s*<rect width="([-\d.]+)" height="([-\d.]+)"/);
    assert.ok(frame && brand, block);
    const [x, y, width, actualHeight] = frame.slice(1, 5).map(Number);
    const [brandX, brandY, brandWidth, brandHeight] = brand.slice(1, 5).map(Number);
    assert.equal(width, 120);
    assert.equal(actualHeight, height);
    assert.equal(brandWidth, 16);
    assert.equal(brandHeight, 16);
    assert.equal(brandY - y, y + actualHeight - brandY - brandHeight, 'equal top and bottom space');
    assert.equal(x + width - brandX - brandWidth, 6, 'preserve horizontal placement');
  }
});

test('a branded node fails before its semantic sigil, label, and brand badge can overlap', () => {
  const input = writeFixture('workflow', 'narrow-brand-rail', 'openai', (_diagram, node) => {
    node.label = 'A';
    delete node.sublabel;
    node.width = 32;
  });
  const { result, html } = renderSync('workflow', input, 'narrow-brand-rail');

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /brand top rail/i);
  assert.equal(html, '');
});

test('every renderer enforces the same collision-free brand top rail', () => {
  // Lifecycle sizes states to their text, so it has no narrow-box case.
  for (const type of ['architecture', 'sequence', 'dataflow']) {
    const input = writeFixture(type, `narrow-brand-rail-${type}`, 'openai', (diagram, node) => {
      node.label = type === 'sequence' ? 'ABCDEFGHI' : 'A';
      delete node.sublabel;
      delete node.tag;
      if (type === 'architecture') node.size = [32, 60];
      if (type === 'sequence') diagram.meta.column_fit = 'fixed';
      if (type === 'dataflow') node.width = 48;
    });
    const { result, html } = renderSync(type, input, `narrow-brand-rail-${type}`);
    assert.equal(result.status, 1, `${type}: ${result.stderr || result.stdout}`);
    assert.match(result.stderr, /brand top rail/i, type);
    assert.equal(html, '', type);
  }
});

test('branded lifecycle states move the semantic stamp left and keep the brand at upper right', () => {
  const input = writeFixture('lifecycle', 'lifecycle-placement', 'openai', (_diagram, node) => {
    Object.assign(node, { step: '01', icon: 'start' });
  });
  const { result, html } = renderSync('lifecycle', input, 'lifecycle-placement');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const id = JSON.parse(fs.readFileSync(input, 'utf8')).states[0].id;
  const block = nodeBlock(html, id);
  const semanticX = Number(block.match(/data-semantic-sigil[^>]+translate\(([-\d.]+)/)?.[1]);
  const brandX = Number(block.match(/data-brand-mark[^>]+translate\(([-\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(semanticX) && Number.isFinite(brandX) && semanticX < brandX, block);
  assert.match(block, /data-detail="fine"[^>]+>01<\/text>/);
});

test('known-brand URLs use the bundled vector instead of the network', () => {
  const input = writeFixture('architecture', 'known-domain', 'https://github.com/tt-a1i/archify');
  const { result, html } = renderSync('architecture', input, 'known-domain');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(html, /data-brand-mark="github"[^>]+data-brand-status="preset"/);
  assert.doesNotMatch(html, /data-brand-status="captured"/);
});

test('unknown URL strings fail offline with a built-in brand suggestion', () => {
  const input = writeFixture('architecture', 'unpinned-link', 'https://brand.example.invalid/');
  const result = spawnSync(process.execPath, [cli, 'validate', 'architecture', input, '--json'], {
    cwd: skillRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.ok, false);
  assert.ok(receipt.diagnostics.some((entry) => entry.code === 'brand/unknown'));
  assert.ok(receipt.diagnostics.every((entry) => entry.supportedFixes.every((fix) => !fix.includes('capture'))));
});

test('unknown preset names fail with a repairable public CLI diagnostic', () => {
  const input = writeFixture('architecture', 'unknown-preset', 'open-aii');
  const result = spawnSync(process.execPath, [cli, 'validate', 'architecture', input, '--json'], {
    cwd: skillRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.ok, false);
  assert.ok(receipt.diagnostics.some((entry) => entry.code === 'brand/unknown'));
  assert.ok(receipt.diagnostics.some((entry) => entry.supportedFixes.some((fix) => fix.includes('archify brands'))));
});

test('viewer exposes brand identity to Passport and Finder with sources in the Focus card', () => {
  const template = fs.readFileSync(path.join(skillRoot, 'assets', 'template.html'), 'utf8');
  assert.match(template, /id="focus-brand" data-passport="brand" hidden/);
  assert.match(template, /node\.getAttribute\('data-node-brand'\)/);
  assert.doesNotMatch(template, /Archify\.sourceEvidence\.installBeacons\(\)|classList\.add\('source-evidence-beacon'\)/);
  assert.match(template, /sourceSearch \+ ' ' \+ text\)\.toLowerCase\(\) \+ ' ' \+ brand\.toLowerCase\(\)/);
});

process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
