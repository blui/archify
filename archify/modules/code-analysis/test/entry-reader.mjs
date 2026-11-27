// Test helper: read one captured entry file through the shared call and
// incoming readers, as the comparison impact view does. Not product code.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { readInside } from '../lib/evidence.mjs';
import { readCalls } from '../lib/call-reader.mjs';
import { readIncoming } from '../lib/incoming-reader.mjs';
import { fail } from '../core/index.mjs';

const hash = (text) => createHash('sha256').update(text).digest('hex');

export function readEntry({ entry, symbol, context = null, root, facts = null, factsPath = null }) {
  const jsEntry = /\.(?:[mc]?[jt]s|[jt]sx)$/.test(entry || '') && !/\.d\.(?:ts|mts|cts)$/.test(entry);
  const language = facts?.repository?.language;
  const adapter = facts?.repository?.adapter || '';
  const savedEntry = !jsEntry && Array.isArray(facts?.files) && facts.files.some(f => f.path === entry)
    && ((language === 'py' && /^(?:python|pyright-parser)@\d/.test(adapter) && /\.py$/.test(entry || ''))
      || (language === 'java' && /^java-parser@\d/.test(adapter) && /\.java$/.test(entry || ''))
      || (language === 'go' && /^go-parser@\d/.test(adapter) && /\.go$/.test(entry || ''))
      || (language === 'rust' && /^rust-syn@\d/.test(adapter) && /\.rs$/.test(entry || ''))
      || (['c', 'cpp'].includes(language) && /^libclang@/.test(adapter)));
  if (!jsEntry && !savedEntry) fail('reader/entry-invalid', 'Expected a supported implementation file captured by matching raw facts.', { subject: { entry } });
  const cppContext = ['c', 'cpp'].includes(language) ? (context || (/\.(?:c|cc|cpp|cxx|C)$/.test(entry) ? entry : null)) : null;
  if (['c', 'cpp'].includes(language) && !cppContext) fail('reader/context-required', 'A C/C++ header entry needs a translation unit.', { subject: { entry } });
  if (cppContext && !facts.languageScope?.fileContexts?.[entry]?.includes(cppContext)) fail('reader/context-invalid', 'The selected translation unit did not capture this C/C++ entry.', { subject: { entry, context: cppContext } });
  const captured = new Map((facts?.files || []).map((f) => [f.path, f]));
  for (const input of facts?.languageScope?.metadata || []) if (!captured.has(input.file)) captured.set(input.file, { path: input.file, sourceText: input.sourceText });
  const cache = new Map();
  const sources = new Map();
  const inspect = (file) => {
    if (cache.has(file)) return cache.get(file);
    if (file !== entry && !captured.has(file)) {
      const result = { file, currentStatus: 'not-checked', factsStatus: 'unverifiable', parseErrors: [], reason: 'target-not-captured' };
      cache.set(file, result); return result;
    }
    const current = readInside(root, file);
    if (current.status === 'ok') sources.set(file, current.text);
    const old = captured.get(file);
    const result = {
      file, currentStatus: current.status,
      parseErrors: (facts?.parse_errors || []).filter((e) => e.path === file),
      ...(current.reason ? { reason: current.reason } : {}),
      factsStatus: current.status !== 'ok' ? current.status
        : typeof old?.sourceText !== 'string' ? 'unverifiable'
          : old.sourceText === current.text ? 'valid' : 'changed',
      ...(current.status === 'ok' ? { currentSha256: hash(current.text) } : {}),
    };
    cache.set(file, result);
    return result;
  };
  const selected = inspect(entry);
  const languageInputs = facts?.languageScope?.metadata?.map(input => {
    const current = readInside(root, input.file);
    return { file: input.file, status: current.status === 'ok' && current.text === input.sourceText ? 'valid' : 'changed-or-unreadable' };
  });
  if (cppContext) {
    const build = facts.languageScope.build;
    let status = 'changed-or-unreadable';
    try { if (hash(fs.readFileSync(build.databasePath)) === build.databaseSha256) status = 'valid'; } catch { /* missing database */ }
    languageInputs.push({ file: build.databasePath, status });
  }
  if (languageInputs?.some(input => input.status !== 'valid')) selected.factsStatus = 'resolution-input-changed';
  if (selected.currentStatus !== 'ok') fail('reader/entry-unreadable', `Cannot read entry: ${entry}`, { subject: { entry }, evidence: selected });
  const matches = (facts?.functions || []).filter((f) => f.file === entry && (f.qualname === symbol || f.name === symbol) && (!cppContext || f.contexts?.includes(cppContext)));
  let location = null;
  if (symbol && selected.factsStatus === 'valid' && !selected.parseErrors.length) {
    if (matches.length !== 1) fail('reader/function-unresolved', `Expected one captured function named ${symbol}; found ${matches.length}.`, { subject: { entry, symbol } });
    const f = matches[0];
    location = { file: entry, symbol: f.qualname, startLine: f.line, endLine: f.endLine };
  }
  const imports = (facts?.imports || []).filter((i) => i.from === entry && (!cppContext || i.contexts?.includes(cppContext))).map((i) => ({
    ...i, originStatus: selected.factsStatus,
    ...(i.to ? { target: inspect(i.to) } : {}),
  }));
  const selectedFunction = matches.length === 1 ? matches[0] : null;
  const calls = readCalls({ facts, factsPath, inspect, entry: selected, location, symbol, text: sources.get(entry), selectedFunction, context: cppContext });
  return {
    entry: { ...selected, ...(symbol ? { requestedFunction: symbol } : {}), location },
    imports,
    calls,
    ...readIncoming({ facts, inspect, entry: selected, symbol, selectedFunction, calls, context: cppContext }),
    scope: { ...(cppContext ? { translationUnit: cppContext } : {}), ...(facts?.languageScope ? { languageScope: facts.languageScope, languageInputs } : {}) },
  };
}
