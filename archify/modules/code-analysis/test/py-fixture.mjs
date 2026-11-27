// The py-tasks fixture repository, copied to a temporary non-Git directory so
// an analysis of it does not depend on the checkout's HEAD.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, evaluateGraph, extractFacts, loadConfig } from '../lib/analysis.mjs';

export const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'py-tasks');

export function copySource() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-py-fixture-'));
  fs.cpSync(SOURCE, dir, { recursive: true, filter: (src) => !src.includes('__pycache__') });
  return dir;
}

export function analyzeFixture(dir) {
  const config = loadConfig(path.join(SOURCE, 'analysis.config.json'));
  const { facts } = extractFacts(dir, { language: 'py', config });
  const graph = buildGraph(facts, config);
  const findings = evaluateGraph(graph, config, facts);
  return { facts, graph, findings, config };
}

export function prepend(dir, rel, text) { const f = path.join(dir, rel); fs.writeFileSync(f, text + fs.readFileSync(f, 'utf8')); }
export function replace(dir, rel, from, to) { const f = path.join(dir, rel); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(from, to)); }
