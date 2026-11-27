// Where a finding points, as line ranges in files. The finding detail view
// shows these locations, the comparison impact view follows them, and the
// review evidence check hashes their captured lines.
export const MAX_LOCATIONS = 12;

export function locationsOf(d) {
  const s = d.subject || {}, ev = d.evidence || {};
  if (d.external) {
    const reported = d.external.locations?.length ? d.external.locations : s.file ? [s] : [];
    return reported.filter((loc) => typeof loc.file === 'string' && loc.file).map((loc) => {
      const role = loc.role ? { role: loc.role } : {};
      if (!Number.isInteger(loc.line) || loc.line < 1) return { file: loc.file, kind: 'file', ...role };
      return {
        file: loc.file, startLine: loc.line, endLine: Number.isInteger(loc.endLine) ? loc.endLine : loc.line, kind: 'range',
        ...role,
        ...(Number.isInteger(loc.column) ? { startColumn: loc.column } : {}),
        ...(Number.isInteger(loc.endColumn) ? { endColumn: loc.endColumn } : {}),
      };
    });
  }
  if (d.code === 'redundancy/duplicate-block') return (s.locations || []).map((loc) => ({
    file: loc.file, startLine: loc.line, endLine: loc.endLine, kind: 'range',
    ...(Number.isInteger(loc.column) ? { startColumn: loc.column, endColumn: loc.endColumn, startOffset: loc.start, endOffset: loc.end } : {}),
  }));
  if (d.code === 'complexity/function' && s.file && Number.isInteger(s.line)) {
    return [{ file: s.file, startLine: s.line, endLine: Number.isInteger(s.endLine) ? s.endLine : s.line, kind: 'function', symbol: s.function, ...(Number.isInteger(ev.deepestLine) ? { focusLine: ev.deepestLine } : {}) }];
  }
  const importLoc = (i) => ({ file: i.file, startLine: i.line, endLine: i.line, kind: 'import', targets: [`${i.to}${i.deferred || i.lazy ? ' (deferred)' : ''}${i.typeOnly ? ' (type only)' : ''}`] });
  if (d.code === 'coupling/import-cycle') return uniqueLocations((ev.pathImports?.length ? ev.pathImports : ev.imports || []).filter((i) => i.file && Number.isInteger(i.line)).map(importLoc));
  if (d.code === 'architecture/boundary' || d.code === 'coupling/cycle' || d.code === 'coupling/internal-leak') return uniqueLocations((ev.imports || []).filter((i) => i.file && Number.isInteger(i.line)).map(importLoc));
  if (s.file && Number.isInteger(s.line)) return [{ file: s.file, startLine: s.line, endLine: Number.isInteger(s.endLine) ? s.endLine : s.line, kind: 'range' }];
  // Module-level findings without line evidence (coupling/hub): the files, no range.
  return (d.evidenceDigest?.files || []).slice(0, MAX_LOCATIONS).map((file) => ({ file, kind: 'file' }));
}

// One location per cited line; a line importing several resolved files
// (a package and its submodule) lists every target.
function uniqueLocations(list) {
  const byLine = new Map();
  for (const l of list) {
    const k = `${l.file}:${l.startLine}`;
    if (!byLine.has(k)) byLine.set(k, { ...l, targets: [...l.targets] });
    else for (const t of l.targets) if (!byLine.get(k).targets.includes(t)) byLine.get(k).targets.push(t);
  }
  return [...byLine.values()];
}
