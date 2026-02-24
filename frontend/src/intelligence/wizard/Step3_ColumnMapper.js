import React, { useEffect, useState, useMemo } from 'react';
import {
  Key, GitCompare, Eye, EyeOff, AlertTriangle, ArrowRight,
  Search, ChevronDown, ChevronRight, Sigma
} from 'lucide-react';
import { Alert, Button, Badge, cn } from '../ui';

const ROLE_LABELS = {
  unique_key:     { label: 'Unique Key',    color: 'blue',   borderColor: 'border-l-blue-400',   iconColor: 'text-blue-500',   dotColor: 'bg-blue-400',   desc: 'Matches rows between files', Icon: Key },
  compare_fields: { label: 'Compare Fields',color: 'green',  borderColor: 'border-l-green-400',  iconColor: 'text-green-500',  dotColor: 'bg-green-400',  desc: 'Fields checked for changes',  Icon: GitCompare },
  display_fields: { label: 'Display Only',  color: 'purple', borderColor: 'border-l-purple-400', iconColor: 'text-purple-500', dotColor: 'bg-purple-400', desc: 'Shown but not compared',       Icon: Eye },
  ignored_fields: { label: 'Ignore',        color: 'gray',   borderColor: 'border-l-gray-400',   iconColor: 'text-gray-400',   dotColor: 'bg-gray-300',   desc: 'Excluded from output',        Icon: EyeOff },
};

const TYPE_BADGE_VARIANT = {
  formula: 'orange',
  date:    'purple',
  numeric: 'blue',
  text:    'gray',
};

// Heuristics for smart role suggestions
const KEY_PATTERNS = /\b(id|nric|staff[_\s]?id|employee[_\s]?id|code|fin|ic|ref|no\.?)\b/i;
function getSmartDefault(col) {
  const n = col.name?.toLowerCase() || '';
  if (KEY_PATTERNS.test(n)) return 'unique_key';
  if (col.detected_type === 'date' || col.detected_type === 'numeric') return 'compare_fields';
  if (col.detected_type === 'formula') return 'display_fields';
  return 'display_fields';
}

function ColumnChip({ col, role, suggested, onRoleChange, filterRole }) {
  const { dotColor } = ROLE_LABELS[role] || ROLE_LABELS.display_fields;
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';
  const isHighlighted = filterRole && filterRole === role;

  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 border rounded-lg bg-white transition-shadow',
      isHighlighted ? 'border-indigo-300 shadow-md' : 'border-gray-200 hover:shadow-sm'
    )}>
      {/* Role color dot */}
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-gray-800 truncate">{col.name}</p>
          {suggested && (
            <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-1 py-0 rounded">suggested</span>
          )}
        </div>
        <Badge variant={typeVariant} className="mt-0.5">{col.detected_type}</Badge>
      </div>
      <select
        value={role}
        onChange={(e) => onRoleChange(col.name, e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shrink-0"
      >
        {Object.entries(ROLE_LABELS).map(([key, { label }]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
}

function RoleSection({ roleKey, info, columns, active, onClick }) {
  const { Icon, label, color, iconColor, desc } = info;
  const badgeVariant = { blue: 'blue', green: 'green', purple: 'purple', gray: 'gray' }[color] || 'gray';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left bg-gray-50 rounded-xl px-4 py-3 border flex items-center gap-4 transition-colors',
        active ? 'border-indigo-300 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-center gap-2 shrink-0 w-44">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', iconColor)} />
        <h4 className="text-sm font-semibold text-gray-700 whitespace-nowrap">{label}</h4>
        <span className="text-xs text-gray-400 hidden sm:inline">— {desc}</span>
      </div>
      <Badge variant={badgeVariant} className="shrink-0">{columns.length}</Badge>
      <div className="flex flex-wrap gap-1 flex-1">
        {columns.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No columns assigned</p>
        ) : columns.slice(0, 6).map(name => (
          <span key={name} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700">
            {name}
          </span>
        ))}
        {columns.length > 6 && (
          <span className="text-xs text-gray-400 self-center">+{columns.length - 6} more</span>
        )}
      </div>
    </button>
  );
}

function FileBDiffPanel({ sheetsA, sheetsB, selectedA, selectedB }) {
  const [open, setOpen] = useState(false);

  const sheetA = sheetsA.find(s => s.name === selectedA);
  const sheetB = sheetsB.find(s => s.name === selectedB);
  if (!sheetA || !sheetB) return null;

  const colsA = new Set((sheetA.columns || []).map(c => c.name));
  const colsB = new Set((sheetB.columns || []).map(c => c.name));
  const onlyInB = [...colsB].filter(n => !colsA.has(n));
  const onlyInA = [...colsA].filter(n => !colsB.has(n));
  if (onlyInA.length === 0 && onlyInB.length === 0) return null;

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span>File B has column differences</span>
        <span className="text-xs text-amber-600 ml-1">({onlyInA.length + onlyInB.length} mismatched)</span>
        {open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <div className="p-4 bg-white grid grid-cols-2 gap-4 border-t border-amber-100">
          {onlyInA.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-2">Only in File A — suggest Ignore</p>
              <div className="flex flex-wrap gap-1">
                {onlyInA.map(n => <Badge key={n} variant="red">{n}</Badge>)}
              </div>
            </div>
          )}
          {onlyInB.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Only in File B — will be missing in A</p>
              <div className="flex flex-wrap gap-1">
                {onlyInB.map(n => <Badge key={n} variant="green">{n}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Step3_ColumnMapper({ wizard }) {
  const { state, update } = wizard;
  const analysis = state.analysis || {};
  const sheetsA = analysis.file_a?.sheets || [];
  const sheetsB = analysis.file_b?.sheets || [];
  const selectedSheet = sheetsA.find(s => s.name === state.selectedSheets.file_a);
  const allColumns = selectedSheet?.columns || [];

  // Detect formula columns from backend analysis
  const formulaColNames = allColumns
    .filter(c => c.detected_type === 'formula')
    .map(c => c.name);

  // Build initial roleMap with smart defaults
  const [roleMap, setRoleMap] = useState(() => buildInitialRoleMap(allColumns, state.columnMapping));
  const [suggestedSet, setSuggestedSet] = useState(() => computeSuggested(allColumns, state.columnMapping));
  const [colSearch, setColSearch] = useState('');
  const [filterRole, setFilterRole] = useState(null);

  function buildInitialRoleMap(cols, mapping) {
    const map = {};
    // Start with smart defaults
    cols.forEach(col => { map[col.name] = getSmartDefault(col); });
    // Override with any existing mapping from state (applied template or previous step)
    mapping.unique_key.forEach(n => { if (map[n] !== undefined) map[n] = 'unique_key'; });
    mapping.compare_fields.forEach(n => { if (map[n] !== undefined) map[n] = 'compare_fields'; });
    mapping.display_fields?.forEach(n => { if (map[n] !== undefined) map[n] = 'display_fields'; });
    mapping.ignored_fields?.forEach(n => { if (map[n] !== undefined) map[n] = 'ignored_fields'; });
    return map;
  }

  function computeSuggested(cols, mapping) {
    // A column is "suggested" if it was auto-assigned (not in any explicit mapping list)
    const explicitCols = new Set([
      ...mapping.unique_key,
      ...mapping.compare_fields,
      ...(mapping.display_fields || []),
      ...(mapping.ignored_fields || []),
    ]);
    const suggested = new Set();
    cols.forEach(col => {
      if (!explicitCols.has(col.name)) {
        suggested.add(col.name);
      }
    });
    return suggested;
  }

  // Reset roleMap when sheet changes
  useEffect(() => {
    if (allColumns.length === 0) return;
    const newMap = buildInitialRoleMap(allColumns, state.columnMapping);
    setRoleMap(newMap);
    setSuggestedSet(computeSuggested(allColumns, state.columnMapping));
    setColSearch('');
    setFilterRole(null);
  }, [selectedSheet?.name]);

  const handleRoleChange = (colName, newRole) => {
    setRoleMap(prev => ({ ...prev, [colName]: newRole }));
    // Once user manually changes, no longer "suggested"
    setSuggestedSet(prev => { const s = new Set(prev); s.delete(colName); return s; });
  };

  const getColumnsByRole = (role) =>
    Object.entries(roleMap).filter(([, r]) => r === role).map(([n]) => n);

  // Filtered and optionally role-filtered column list
  const visibleColumns = useMemo(() => {
    let cols = allColumns;
    if (colSearch) cols = cols.filter(c => c.name.toLowerCase().includes(colSearch.toLowerCase()));
    if (filterRole) cols = cols.filter(c => roleMap[c.name] === filterRole);
    return cols;
  }, [allColumns, colSearch, filterRole, roleMap]);

  const handleContinue = () => {
    update({
      columnMapping: {
        unique_key: getColumnsByRole('unique_key'),
        compare_fields: getColumnsByRole('compare_fields'),
        display_fields: getColumnsByRole('display_fields'),
        ignored_fields: getColumnsByRole('ignored_fields'),
        formula_fields: state.columnMapping.formula_fields || {},
      },
      step: 4,
    });
  };

  const handleBulkSetCompare = () => {
    setRoleMap(prev => {
      const next = { ...prev };
      allColumns.forEach(col => {
        if (next[col.name] === 'display_fields') next[col.name] = 'compare_fields';
      });
      return next;
    });
  };

  const handleBulkResetDisplay = () => {
    setRoleMap(prev => {
      const next = { ...prev };
      allColumns.forEach(col => {
        if (next[col.name] !== 'unique_key') next[col.name] = 'display_fields';
      });
      return next;
    });
  };

  const canContinue = getColumnsByRole('unique_key').length > 0;
  const hasCompareFields = getColumnsByRole('compare_fields').length > 0;
  const totalCols = allColumns.length;
  const shownCols = visibleColumns.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Map Columns</h2>
        <p className="text-sm text-gray-500">
          Assign a role to each column. The{' '}
          <span className="font-semibold text-blue-700">Unique Key</span> identifies matching rows between files.
        </p>
      </div>

      {/* Role summary (clickable to filter) */}
      <div className="flex flex-col gap-2">
        {Object.entries(ROLE_LABELS).map(([key, info]) => (
          <RoleSection
            key={key}
            roleKey={key}
            info={info}
            columns={getColumnsByRole(key)}
            active={filterRole === key}
            onClick={() => setFilterRole(prev => prev === key ? null : key)}
          />
        ))}
      </div>

      {/* Formula columns info */}
      {formulaColNames.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Sigma className="w-3.5 h-3.5 text-orange-500" />
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Formula Columns (read-only)</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {formulaColNames.map(n => (
              <Badge key={n} variant="orange">{n}</Badge>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-1.5">
            These columns contain formulas. They're auto-assigned to Display Only.
          </p>
        </div>
      )}

      {/* File B diff panel */}
      {sheetsB.length > 0 && state.selectedSheets.file_a && state.selectedSheets.file_b && (
        <FileBDiffPanel
          sheetsA={sheetsA}
          sheetsB={sheetsB}
          selectedA={state.selectedSheets.file_a}
          selectedB={state.selectedSheets.file_b}
        />
      )}

      {/* Column list header with search + count + bulk actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              All Columns — Assign Roles
            </h3>
            <span className="text-xs text-gray-400">
              {colSearch || filterRole ? `${shownCols} / ${totalCols}` : `${totalCols} columns`}
              {filterRole ? ` (filtered: ${ROLE_LABELS[filterRole]?.label})` : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
              onClick={handleBulkSetCompare}
            >
              Set unassigned → Compare
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs border border-gray-200 hover:border-gray-300"
              onClick={handleBulkResetDisplay}
            >
              Reset all → Display
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Filter columns by name..."
            value={colSearch}
            onChange={e => setColSearch(e.target.value)}
          />
        </div>

        {allColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No columns detected. Go back and select a sheet.</p>
        ) : visibleColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">No columns match current filter.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
            {visibleColumns.map(col => (
              <ColumnChip
                key={col.name}
                col={col}
                role={roleMap[col.name] || 'display_fields'}
                suggested={suggestedSet.has(col.name)}
                onRoleChange={handleRoleChange}
                filterRole={filterRole}
              />
            ))}
          </div>
        )}
      </div>

      {!canContinue && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Assign at least one column as <strong>Unique Key</strong> to continue.
        </Alert>
      )}

      {canContinue && !hasCompareFields && (
        <Alert variant="info">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          No <strong>Compare Fields</strong> assigned — changes won't be detected. You can still continue.
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => update({ step: 2 })}>← Back</Button>
        <Button variant="primary" onClick={handleContinue} disabled={!canContinue}>
          Build Rules <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
