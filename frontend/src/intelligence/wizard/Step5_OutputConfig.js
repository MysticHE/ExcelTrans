import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileOutput, Settings2, Download, Play, Eye, CheckCircle2,
  AlertCircle, AlertTriangle, ChevronUp, ChevronDown, ChevronRight, X, RefreshCw,
  Key, GitCompare, EyeOff, Columns, ArrowRight, Search
} from 'lucide-react';
import { processComparison, downloadResult } from '../services/intelApi';
import { Button, Toggle, Alert, Input, Badge, cn } from '../ui';

// ── Source label helpers ────────────────────────────────────────────────────
const SOURCE_STYLES = {
  Key:     { color: 'blue',   icon: Key },
  Compare: { color: 'green',  icon: GitCompare },
  Display: { color: 'purple', icon: Eye },
  Remarks: { color: 'gray',   icon: FileOutput },
  Rule:    { color: 'indigo', icon: Columns },
};

function getColSource(name, colMapping, rules) {
  if (colMapping.unique_key?.includes(name))     return 'Key';
  if (colMapping.compare_fields?.includes(name)) return 'Compare';
  if (colMapping.display_fields?.includes(name)) return 'Display';
  if (name === 'Remarks')                        return 'Remarks';
  const r = rules.find(r => r.output_column === name);
  return r ? `Rule` : 'Unknown';
}

// ── Build full column list from wizard state ─────────────────────────────────
function buildColumnList(state) {
  const { columnMapping, rules, outputConfig } = state;
  const items = [];
  const seen = new Set();

  const push = (name, source) => {
    if (!seen.has(name)) { items.push({ name, source }); seen.add(name); }
  };

  columnMapping.unique_key?.forEach(n => push(n, 'Key'));
  columnMapping.display_fields?.forEach(n => push(n, 'Display'));
  columnMapping.compare_fields?.forEach(n => push(n, 'Compare'));
  if (outputConfig.add_remarks_column) push('Remarks', 'Remarks');
  (rules || []).forEach(r => {
    if (r.output_column && r.output_column !== 'Remarks') push(r.output_column, 'Rule');
  });

  // Apply saved column_order if present
  if (outputConfig.column_order?.length) {
    const orderMap = new Map(outputConfig.column_order.map((n, i) => [n, i]));
    items.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
  }

  // Apply saved included_columns if present
  const includedSet = outputConfig.included_columns ? new Set(outputConfig.included_columns) : null;
  return items.map(item => ({ ...item, included: includedSet ? includedSet.has(item.name) : true }));
}

// ── Summary Badge ────────────────────────────────────────────────────────────
function SummaryBadge({ label, value, color }) {
  const styles = {
    green:  'bg-green-50 border-green-200 text-green-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-600',
  };
  const icons = {
    green:  <span className="text-green-500 font-bold">+</span>,
    red:    <span className="text-red-500 font-bold">−</span>,
    yellow: <span className="text-yellow-600 font-bold">~</span>,
    gray:   <span className="text-gray-400 font-bold">=</span>,
  };
  return (
    <div className={cn('rounded-xl border p-3 text-center', styles[color] || styles.gray)}>
      <div className="flex items-center justify-center gap-1 mb-1">
        {icons[color]}
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </div>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

// ── Column Row (shared by ColumnManager grouped + search views) ───────────────
function ColRow({ col, idx, colList, onMove, onToggle }) {
  const srcStyle = SOURCE_STYLES[col.source] || SOURCE_STYLES.Rule;
  const SrcIcon = srcStyle.icon;
  return (
    <div className={cn('flex items-center gap-2 px-4 py-1.5 transition-colors', col.included ? 'bg-white' : 'bg-gray-50 opacity-50')}>
      <input
        type="checkbox"
        checked={col.included}
        onChange={() => onToggle(idx)}
        className="w-4 h-4 rounded accent-indigo-500 shrink-0 cursor-pointer"
      />
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <SrcIcon className="w-3 h-3 text-gray-400 shrink-0" />
        <p className="text-xs font-medium text-gray-800 truncate">{col.name}</p>
      </div>
      <div className="flex gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onMove(idx, -1)}
          disabled={idx === 0}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(idx, 1)}
          disabled={idx === colList.length - 1}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Column Manager ───────────────────────────────────────────────────────────
function ColumnManager({ colList, onColListChange }) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const moveCol = (idx, dir) => {
    const next = [...colList];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onColListChange(next);
  };

  const toggleInclude = (idx) => {
    const next = colList.map((c, i) => i === idx ? { ...c, included: !c.included } : c);
    onColListChange(next);
  };

  const selectAll = () => onColListChange(colList.map(c => ({ ...c, included: true })));
  const deselectAll = () => onColListChange(colList.map(c => ({ ...c, included: false })));
  const toggleGroup = (group) => setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));

  const filteredFlat = search.trim()
    ? colList.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const grouped = useMemo(() => {
    const order = ['Key', 'Compare', 'Display', 'Remarks', 'Rule'];
    const map = {};
    order.forEach(g => {
      const cols = colList.filter(c => c.source === g);
      if (cols.length) map[g] = cols;
    });
    return map;
  }, [colList]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Output Columns</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">{colList.filter(c => c.included).length}/{colList.length}</p>
          <button type="button" onClick={selectAll} className="text-xs text-indigo-500 hover:underline">All</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={deselectAll} className="text-xs text-gray-400 hover:underline">None</button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search columns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300 bg-white"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {filteredFlat ? (
          filteredFlat.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-4">No columns match "{search}".</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFlat.map(col => (
                <ColRow key={col.name} col={col} idx={colList.indexOf(col)} colList={colList} onMove={moveCol} onToggle={toggleInclude} />
              ))}
            </div>
          )
        ) : (
          <div>
            {Object.entries(grouped).map(([group, cols]) => (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                >
                  <span className="text-xs font-semibold text-gray-500">{group}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">{cols.length}</span>
                    {collapsedGroups[group]
                      ? <ChevronDown className="w-3 h-3 text-gray-400" />
                      : <ChevronUp className="w-3 h-3 text-gray-400" />}
                  </div>
                </button>
                {!collapsedGroups[group] && (
                  <div className="divide-y divide-gray-100">
                    {cols.map(col => (
                      <ColRow key={col.name} col={col} idx={colList.indexOf(col)} colList={colList} onMove={moveCol} onToggle={toggleInclude} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {colList.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">
                No columns — configure column mapping in Step 3.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Config Summary ───────────────────────────────────────────────────────────
function ConfigSummary({ state, onEdit }) {
  const [collapsed, setCollapsed] = useState(false);
  const { columnMapping, rules, fileA, fileB, selectedSheets } = state;
  const hasNoKey = !columnMapping.unique_key?.length;

  const ruleCounts = useMemo(() => {
    const counts = {};
    (rules || []).forEach(r => {
      const type = r.rule_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [rules]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Configuration Summary</span>
          {hasNoKey && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              No key columns
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* Files */}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Files</p>
                  <button type="button" onClick={() => onEdit(1)} className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                    <ChevronRight className="w-3 h-3" />Edit
                  </button>
                </div>
                <p className="text-xs text-gray-700 truncate" title={fileA?.name}>A: {fileA?.name || '—'}</p>
                <p className="text-xs text-gray-700 truncate" title={fileB?.name}>B: {fileB?.name || '—'}</p>
              </div>

              {/* Sheets */}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sheets</p>
                  <button type="button" onClick={() => onEdit(2)} className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                    <ChevronRight className="w-3 h-3" />Edit
                  </button>
                </div>
                <p className="text-xs text-gray-700 truncate">A: {selectedSheets?.file_a || '—'}</p>
                <p className="text-xs text-gray-700 truncate">B: {selectedSheets?.file_b || '—'}</p>
              </div>

              {/* Columns */}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Columns</p>
                  <button type="button" onClick={() => onEdit(3)} className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                    <ChevronRight className="w-3 h-3" />Edit
                  </button>
                </div>
                <p className={cn('text-xs', hasNoKey ? 'text-amber-600 font-medium' : 'text-gray-700')}>
                  {columnMapping.unique_key?.length || 0} Key
                </p>
                <p className="text-xs text-gray-700">{columnMapping.compare_fields?.length || 0} Compare</p>
                <p className="text-xs text-gray-700">{columnMapping.display_fields?.length || 0} Display</p>
                <p className="text-xs text-gray-700">{columnMapping.ignored_fields?.length || 0} Ignored</p>
              </div>

              {/* Rules */}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rules</p>
                  <button type="button" onClick={() => onEdit(4)} className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                    <ChevronRight className="w-3 h-3" />Edit
                  </button>
                </div>
                <p className="text-xs text-gray-700">{rules?.length || 0} total</p>
                {Object.entries(ruleCounts).map(([type, count]) => (
                  <p key={type} className="text-xs text-gray-500 truncate">
                    {type.replace(/_RULE$/, '')} ×{count}
                  </p>
                ))}
              </div>
            </div>

            {hasNoKey && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  No key columns set — all rows will appear as Additions or Deletions without row matching.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Row Detail Drawer ────────────────────────────────────────────────────────
function RowDetailDrawer({ row, onClose }) {
  if (!row) return null;
  const rowA = row._row_a;
  const isMatched = row.source === 'matched';
  const dataKeys = Object.keys(row).filter(k => !['source', 'color', 'changed_fields', 'output_columns', 'remarks', '_row_a'].includes(k));
  const changedSet = new Set(row.changed_fields || []);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 250 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Row Detail</p>
          <p className="text-xs text-gray-400 capitalize">
            {row.source === 'B' ? 'Addition (only in File B)' : row.source === 'A' ? 'Deletion (only in File A)' : 'Matched pair'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Output columns */}
      {Object.keys(row.output_columns || {}).length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-1.5">
          {Object.entries(row.output_columns || {}).map(([col, { label, color }]) => (
            <span
              key={col}
              className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={color ? { backgroundColor: color + '33', borderColor: color + '66', color: '#374151' } : {}}
            >
              {col}: {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isMatched && rowA ? (
          dataKeys.map(k => {
            const changed = changedSet.has(k);
            return (
              <div key={k} className={cn('rounded-lg p-2.5 border text-xs', changed ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-gray-50')}>
                <p className="font-semibold text-gray-500 mb-1">{k}{changed && <span className="ml-1 text-yellow-600">(changed)</span>}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-400 mb-0.5">Before (A)</p>
                    <p className="text-gray-800 break-words">{String(rowA[k] ?? '—')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">After (B)</p>
                    <p className={cn('break-words', changed ? 'text-yellow-800 font-medium' : 'text-gray-800')}>
                      {String(row[k] ?? '—')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          dataKeys.map(k => (
            <div key={k} className="rounded-lg p-2.5 border border-gray-100 bg-gray-50 text-xs">
              <p className="font-semibold text-gray-500 mb-0.5">{k}</p>
              <p className="text-gray-800 break-words">{String(row[k] ?? '—')}</p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── Rich Preview ─────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all',       label: 'All' },
  { key: 'B',         label: 'Additions' },
  { key: 'A',         label: 'Deletions' },
  { key: 'changed',   label: 'Changes' },
  { key: 'unchanged', label: 'Unchanged' },
];

function RichPreview({ previewData, oc, colList, onClose }) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [detailRow, setDetailRow] = useState(null);
  const PAGE_SIZE = 20;

  const rows = previewData?.preview || [];
  const summary = previewData?.summary || {};

  const filterCounts = useMemo(() => ({
    all: rows.length,
    B: rows.filter(r => r.source === 'B').length,
    A: rows.filter(r => r.source === 'A').length,
    changed: rows.filter(r => r.source === 'matched' && r.changed_fields?.length > 0).length,
    unchanged: rows.filter(r => r.source === 'matched' && !r.changed_fields?.length).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'B':         return rows.filter(r => r.source === 'B');
      case 'A':         return rows.filter(r => r.source === 'A');
      case 'changed':   return rows.filter(r => r.source === 'matched' && r.changed_fields?.length > 0);
      case 'unchanged': return rows.filter(r => r.source === 'matched' && !r.changed_fields?.length);
      default:          return rows;
    }
  }, [rows, filter]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Determine visible columns based on colList (included + ordered)
  const includedCols = colList.filter(c => c.included).map(c => c.name);

  // Collect all rule output column names from preview data
  const extraColNames = useMemo(() => {
    const seen = new Set(['Remarks']);
    const extra = [];
    rows.forEach(r => {
      Object.keys(r.output_columns || {}).forEach(cn => {
        if (!seen.has(cn)) { extra.push(cn); seen.add(cn); }
      });
    });
    return extra;
  }, [rows]);

  // All possible column headers in the table
  const allPossibleCols = useMemo(() => {
    if (rows.length === 0) return [];
    const dataKeys = Object.keys(rows[0]).filter(k =>
      !['source', 'color', 'changed_fields', 'output_columns', 'remarks', '_row_a'].includes(k)
    );
    const result = [...dataKeys];
    if (oc.add_remarks_column) result.push('Remarks');
    extraColNames.forEach(n => result.push(n));
    return result;
  }, [rows, oc.add_remarks_column, extraColNames]);

  // Follow user's colList order, only show cols that actually exist in preview data
  const visibleHeaders = includedCols.length > 0
    ? includedCols.filter(h => allPossibleCols.includes(h))
    : allPossibleCols;

  const getCellValue = (row, header) => {
    if (header === 'Remarks') return row.output_columns?.Remarks?.label ?? row.remarks ?? '';
    if (extraColNames.includes(header)) return row.output_columns?.[header]?.label ?? '';
    return row[header];
  };

  const isRuleCol = (header) => header === 'Remarks' || extraColNames.includes(header);

  useEffect(() => { setPage(0); }, [filter]);

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFilter(opt.key)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
              filter === opt.key
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
            )}
          >
            {opt.label}
            <span className={cn('ml-1 px-1.5 py-0.5 rounded-full text-xs', filter === opt.key ? 'bg-white/20' : 'bg-gray-100')}>
              {filterCounts[opt.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50">
              {visibleHeaders.map(h => (
                <th key={h} className={cn(
                  'px-2 py-2 text-left font-medium border-b border-gray-200 whitespace-nowrap',
                  isRuleCol(h) ? 'text-indigo-600' : 'text-gray-600'
                )}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleHeaders.length || 1} className="text-center py-6 text-gray-400">
                  No rows match this filter.
                </td>
              </tr>
            ) : pageRows.map((row, i) => {
              const changedSet = new Set(row.changed_fields || []);
              return (
                <tr
                  key={i}
                  style={{ backgroundColor: row.color || 'transparent' }}
                  className="cursor-pointer hover:brightness-95 transition-all"
                  onClick={() => setDetailRow(row)}
                >
                  {visibleHeaders.map(h => {
                    const val = getCellValue(row, h);
                    const isChanged = changedSet.has(h);
                    const isRule = isRuleCol(h);
                    return (
                      <td
                        key={h}
                        className={cn(
                          'px-2 py-1.5 border-b border-gray-100 max-w-xs truncate',
                          isChanged && oc.highlight_changed_cells && !row.color ? 'bg-yellow-100' : ''
                        )}
                      >
                        {isRule && val ? (
                          <span
                            className="inline-block text-xs px-1.5 py-0.5 rounded border font-medium"
                            style={
                              row.output_columns?.[h]?.color
                                ? { backgroundColor: row.output_columns[h].color + '44', borderColor: row.output_columns[h].color + '88' }
                                : { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }
                            }
                          >
                            {String(val)}
                          </span>
                        ) : (
                          <span className="text-gray-700">{String(val ?? '')}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} rows
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</Button>
            <span className="self-center">Page {page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</Button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400">Click any row to see before/after detail.</p>

      {/* Detail drawer */}
      <AnimatePresence>
        {detailRow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setDetailRow(null)}
            />
            <RowDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Step5_OutputConfig({ wizard }) {
  const { state, update, buildTemplate } = wizard;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const oc = state.outputConfig;
  const updateOC = (partial) => update({ outputConfig: { ...oc, ...partial } });

  // Build column list from wizard state; re-compute when returning to this step
  const [colList, setColList] = useState(() => buildColumnList(state));

  // Rebuild if state changes (e.g., navigating back/forward); also sync outputConfig
  useEffect(() => {
    const newList = buildColumnList(state);
    setColList(newList);
    const allCols = newList.map(c => c.name);
    const included = newList.filter(c => c.included).map(c => c.name);
    updateOC({
      included_columns: included.length === allCols.length ? null : included,
      column_order: allCols,
    });
  }, [state.columnMapping, state.rules, state.outputConfig.add_remarks_column]); // eslint-disable-line

  // Sync colList changes back into outputConfig
  const handleColListChange = (newList) => {
    setColList(newList);
    const includedCols = newList.filter(c => c.included).map(c => c.name);
    const allIncluded = newList.every(c => c.included);
    updateOC({
      included_columns: allIncluded ? null : includedCols,
      column_order: newList.map(c => c.name),
    });
  };

  const handleDryRun = async () => {
    setRunning(true);
    setError(null);
    const template = buildTemplate();
    try {
      const data = await processComparison(state.sessionId, template, true);
      if (data.error) { setError(data.error); return; }
      setPreviewData(data);
      setShowPreview(true);
    } catch (e) {
      setError('Processing failed. Check that the server is running.');
    } finally {
      setRunning(false);
    }
  };

  const handleRefreshPreview = async () => {
    setRunning(true);
    setError(null);
    const template = buildTemplate();
    try {
      const data = await processComparison(state.sessionId, template, true);
      if (data.error) { setError(data.error); return; }
      setPreviewData(data);
    } catch (e) {
      setError('Refresh failed. Check that the server is running.');
    } finally {
      setRunning(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    const template = buildTemplate();
    try {
      const data = await processComparison(state.sessionId, template, false);
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch (e) {
      setError('Processing failed. Check that the server is running.');
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    await downloadResult(state.sessionId, result.download_id, result.filename);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Output Configuration</h2>
        <p className="text-sm text-gray-500">Configure report settings, column selection, and preview results.</p>
      </div>

      {/* ── Config Summary ── */}
      <ConfigSummary state={state} onEdit={(step) => update({ step })} />

      {/* ── Section 1: Output Settings ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
          Output Settings
        </h3>

        {/* Report name */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <FileOutput className="w-4 h-4 text-gray-400" />
            Template / Report Name
          </label>
          <Input
            value={state.templateName}
            onChange={(e) => update({ templateName: e.target.value })}
          />
        </div>

        {/* Filename template */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Settings2 className="w-4 h-4 text-gray-400" />
            Output Filename Template
          </label>
          <Input
            value={oc.output_filename_template || 'comparison_{date}'}
            onChange={(e) => updateOC({ output_filename_template: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Variables: <code>{'{date}'}</code> <code>{'{file_a}'}</code> <code>{'{file_b}'}</code></p>
        </div>

        {/* Output sheet name */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Columns className="w-4 h-4 text-gray-400" />
            Output Sheet Name
          </label>
          <Input
            value={oc.output_sheet_name || 'Comparison'}
            onChange={(e) => updateOC({ output_sheet_name: e.target.value })}
            placeholder="Comparison"
          />
          <p className="text-xs text-gray-400 mt-1">Name of the main tab in the Excel workbook.</p>
        </div>

        {/* Toggles */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <Toggle
            label="Add Remarks Column"
            desc="Append outcome labels as a column in the report"
            value={oc.add_remarks_column}
            onChange={(v) => updateOC({ add_remarks_column: v })}
          />
          <Toggle
            label="Include Summary Sheet"
            desc="Add a Summary tab with counts of additions, deletions, changes"
            value={oc.include_summary_sheet}
            onChange={(v) => updateOC({ include_summary_sheet: v })}
          />
          <Toggle
            label="Highlight Changed Cells"
            desc="Color individual cells that changed (in addition to row-level color)"
            value={oc.highlight_changed_cells}
            onChange={(v) => updateOC({ highlight_changed_cells: v })}
          />
        </div>
      </section>

      {/* ── Section 2: Column Manager ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Column Manager</h3>
          <p className="text-xs text-gray-400">Check to include · arrows to reorder</p>
        </div>
        <ColumnManager colList={colList} onColListChange={handleColListChange} />
      </section>

      {/* ── Section 3: Rich Preview ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Preview</h3>
          {showPreview && previewData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshPreview}
              disabled={running || !state.sessionId}
              loading={running}
            >
              {!running && <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          )}
        </div>

        {!showPreview ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center">
            <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400 mb-3">Run a preview to see up to 50 rows with colors and labels.</p>
            <Button
              variant="secondary"
              onClick={handleDryRun}
              disabled={running || !state.sessionId}
              loading={running}
            >
              {!running && <Eye className="w-4 h-4" />}
              {running ? 'Running preview...' : 'Preview (50 rows)'}
            </Button>
            {!state.sessionId && (
              <p className="text-xs text-amber-600 mt-2">Upload files in Step 1 to enable preview.</p>
            )}
          </div>
        ) : (
          <RichPreview
            previewData={previewData}
            oc={oc}
            colList={colList}
          />
        )}
      </section>

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-semibold">Comparison complete!</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <SummaryBadge label="Total"     value={result.summary?.total     || 0} color="gray"   />
              <SummaryBadge label="Additions" value={result.summary?.additions || 0} color="green"  />
              <SummaryBadge label="Deletions" value={result.summary?.deletions || 0} color="red"    />
              <SummaryBadge label="Changes"   value={result.summary?.changes   || 0} color="yellow" />
              <SummaryBadge label="Unchanged" value={result.summary?.unchanged || 0} color="gray"   />
            </div>
            <Button variant="primary" className="bg-emerald-500 hover:bg-emerald-600" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Download {result.filename}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <Alert variant="error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={() => update({ step: 4 })}>← Back</Button>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleDryRun}
            disabled={running || !state.sessionId}
            loading={running}
          >
            {!running && <Eye className="w-4 h-4" />}
            {running ? 'Running...' : 'Preview (50 rows)'}
          </Button>
          <Button
            variant="primary"
            onClick={handleRun}
            disabled={running || !state.sessionId}
            loading={running}
          >
            {!running && <Play className="w-4 h-4" />}
            {running ? 'Processing...' : 'Run Comparison'}
          </Button>
        </div>
      </div>
    </div>
  );
}
