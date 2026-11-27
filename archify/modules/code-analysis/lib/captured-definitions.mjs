// Captured function definitions of one file, read from saved facts.
import { createHash } from 'node:crypto';
import ts from '../vendor/typescript.cjs';
import { measureFunctions } from '../extract/ts/functions.mjs';
import { rangeText, validSourceRange } from '../core/index.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const point = (source, offset) => {
  const p = source.getLineAndCharacterOfPosition(offset);
  return { line: p.line + 1, column: p.character + 1 };
};

// Snapshot-only definition reader for the comparison impact view. It parses only this TS
// file, or reuses the other adapters' captured definition ranges. No extraction,
// compiler Program, filesystem traversal or symbol re-resolution is performed.
export function capturedDefinitions(facts, file) {
  const captured = facts.files.find(item => item.path === file);
  const status = (facts.parse_errors || []).some(error => error.path === file) ? 'parse-error' : 'valid';
  return definitions({ facts, files: new Map(captured ? [[file, { ...captured, status }]] : []) }, file);
}

function definitions(side, file) {
  const captured = side.files.get(file);
  if (!captured || captured.status !== 'valid') return { coverage: captured?.status || 'not-captured', records: [] };
  if (side.facts.repository.language !== 'ts') {
    const result = [], unavailable = [];
    const kinds = side.facts.repository.language === 'rust' ? ['RustItemFn'] : side.facts.repository.language === 'go' ? ['FuncDecl', 'InterfaceMethod'] : side.facts.repository.language === 'py' ? ['FunctionDef', 'AsyncFunctionDef'] : ['c', 'cpp'].includes(side.facts.repository.language) ? ['ClangFunction'] : ['methodDeclaration', 'interfaceMethodDeclaration', 'constructorDeclaration', 'compactConstructorDeclaration'];
    for (const fn of side.facts.functions.filter(fn => fn.file === file)) {
      const metadata = fn.definition;
      const slice = rangeText(captured.sourceText, metadata?.sourceRange, side.facts.repository.language);
      if (!metadata || !kinds.includes(metadata.kind) || slice === null || digest(slice) !== metadata.sourceRange.sha256) {
        unavailable.push({ file, name: fn.name, qualname: fn.qualname, reason: !metadata ? 'definition-metadata-unavailable' : 'definition-metadata-invalid' });
        continue;
      }
      // Identity remains the original def-start, independently of decorated headers.
      const identity = fn.sourceRange || metadata.sourceRange;
      result.push({ file, name: fn.name, qualname: fn.qualname, kind: metadata.kind,
        line: identity.line, column: identity.column || fn.column || 1,
        endLine: metadata.sourceRange.endLine, endColumn: metadata.sourceRange.endColumn,
        sourceRange: metadata.sourceRange, textSha256: metadata.sourceRange.sha256 });
    }
    return { coverage: unavailable.length ? 'definition-regions-unavailable' : 'available', records: result, unavailable };
  }
  if (/\.d\.(?:ts|mts|cts)$/.test(file)) return { coverage: 'declaration-file-unsupported', records: [] };
  if (side.facts.repository.adapterRevision >= 24 || side.facts.languageScope?.language === 'ts') {
    const result = [], unavailable = [];
    for (const fn of side.facts.functions.filter(item => item.file === file)) {
      if (!validSourceRange(captured.sourceText, fn, 'ts') || !fn.syntaxKind) {
        unavailable.push({ file, name: fn.name, qualname: fn.qualname, reason: 'definition-metadata-invalid' });
        continue;
      }
      const range = fn.sourceRange;
      result.push({ file, name: fn.name, qualname: fn.qualname, kind: fn.syntaxKind,
        line: range.line, column: range.column, endLine: range.endLine, endColumn: range.endColumn,
        sourceRange: range, textSha256: range.sha256 });
    }
    return { coverage: unavailable.length ? 'definition-regions-unavailable' : 'available', records: result, unavailable };
  }
  const source = ts.createSourceFile(file, captured.sourceText, ts.ScriptTarget.Latest, true);
  if (source.isDeclarationFile) return { coverage: 'declaration-file-unsupported', records: [] };
  const result = [];
  measureFunctions(source, file, (fn, node) => {
    const start = point(source, node.getStart(source));
    const finish = point(source, node.getEnd());
    result.push({ file, name: fn.name, qualname: fn.qualname, kind: ts.SyntaxKind[node.kind], ...start,
      endLine: finish.line, endColumn: finish.column, textSha256: digest(source.text.slice(node.getStart(source), node.getEnd())) });
  });
  return { coverage: 'available', records: result };
}
