import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  Key, GitCompare, Eye, EyeOff, AlertTriangle, ArrowRight,
  Search, ChevronDown, ChevronRight, Sigma, GripVertical,
  AlertCircle, ChevronUp,
} from 'lucide-react';
import { Alert, Button, Badge, cn } from '../ui';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  unique_key:     { label: 'Unique Key',    color: 'blue',   Icon: Key,        desc: 'Matches rows between files',  border: 'border-blue-300',   bg: 'bg-blue-50',   ring: 'ring-blue-400',   dotColor: 'bg-blue-400',   badgeVariant: 'blue'   },
  compare_fields: { label: 'Compare Fields',color: 'green',  Icon: GitCompare, desc: 'Fields checked for changes',  border: 'border-green-300',  bg: 'bg-green-50',  ring: 'ring-green-400',  dotColor: 'bg-green-400',  badgeVariant: 'green'  },
  display_fields: { label: 'Display Only',  color: 'purple', Icon: Eye,        desc: 'Shown but not compared',      border: 'border-purple-300', bg: 'bg-purple-50', ring: 'ring-purple-400', dotColor: 'bg-purple-400', badgeVariant: 'purple' },
  ignored_fields: { label: 'Ignore',        color: 'gray',   Icon: EyeOff,     desc: 'Excluded from output',        border: 'border-gray-300',   bg: 'bg-gray-50',   ring: 'ring-gray-400',   dotColor: 'bg-gray-300',   badgeVariant: 'gray'   },
};

const TYPE_BADGE_VARIANT = {
  formula: 'orange',
  date:    'purple',
  numeric: 'blue',
  text:    'gray',
  empty:   'gray',
};

const KEY_PATTERNS = /\b(id|nric|staff[_\s]?id|employee[_\s]?id|code|fin|ic|ref|no\.?)\b/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSmartDefault(col) {
  // Empty columns always go to Ignore
  if (col.detected_type === 'empty') return 'ignored_fields';
  const n = col.name?.toLowerCase() || '';
  if (KEY_PATTERNS.test(n)) return 'unique_key';
  if (col.detected_type === 'date' || col.detected_type === 'numeric') return 'compare_fields';
  if (col.detected_type === 'formula') return 'display_fields';
  return 'display_fields';
}

// Structural types that always win regardless of saved state
const STRUCTURAL_ROLES = { empty: 'ignored_fields', formula: 'display_fields' };

function buildInitialRoleMap(cols, mapping) {
  const map = {};
  cols.forEach(col => { map[col.index] = getSmartDefault(col); });
  // Apply explicit mapping — but structural types (empty/formula) always keep their smart default
  const applyMapping = (names, role) => {
    if (!names?.length) return;
    const nameSet = new Set(names);
    cols.forEach(col => {
      if (STRUCTURAL_ROLES[col.detected_type]) return; // never override structural
      if (nameSet.has(col.name)) map[col.index] = role;
    });
  };
  applyMapping(mapping.unique_key, 'unique_key');
  applyMapping(mapping.compare_fields, 'compare_fields');
  applyMapping(mapping.display_fields, 'display_fields');
  applyMapping(mapping.ignored_fields, 'ignored_fields');
  return map;
}

function computeSuggested(cols, mapping) {
  const explicitCols = new Set([
    ...(mapping.unique_key || []),
    ...(mapping.compare_fields || []),
    ...(mapping.display_fields || []),
    ...(mapping.ignored_fields || []),
  ]);
  const suggested = new Set();
  cols.forEach(col => { if (!explicitCols.has(col.name)) suggested.add(col.index); });
  return suggested;
}

/** Detect duplicate column names and compute auto group labels by proximity */
function detectDuplicateGroups(allColumns) {
  const nameCounts = {};
  allColumns.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
  const dupNames = new Set(Object.keys(nameCounts).filter(n => nameCounts[n] > 1));

  const groupMap = {}; // col.index → auto groupLabel

  dupNames.forEach(name => {
    const dups = allColumns.filter(c => c.name === name).sort((a, b) => a.index - b.index);
    dups.forEach((col, i) => {
      if (i === 0) {
        // Look backward for nearest non-duplicate column
        const prevCols = allColumns.filter(c => c.index < col.index && !dupNames.has(c.name));
        const nearest = prevCols[prevCols.length - 1];
        groupMap[col.index] = nearest ? nearest.name.slice(0, 20) : `Group ${i + 1}`;
      } else {
        // Look for separator columns between previous occurrence and this one
        const prev = dups[i - 1];
        const between = allColumns.filter(
          c => c.index > prev.index && c.index < col.index && !dupNames.has(c.name)
        );
        groupMap[col.index] = between.length > 0 ? between[0].name.slice(0, 20) : `Group ${i + 1}`;
      }
    });
  });

  return { dupNames, groupMap };
}

// ─── DraggableChip ───────────────────────────────────────────────────────────

function DraggableChip({ col, role, suggested, displayName, groupLabel, isFiltered }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: col.index });
  const { dotColor } = ROLE_LABELS[role] || ROLE_LABELS.display_fields;
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';

  if (isFiltered) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-sm select-none',
        'transition-opacity',
        isDragging ? 'opacity-40 shadow-none' : 'shadow-sm hover:shadow-md border-gray-200 hover:border-gray-300'
      )}
    >
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 text-gray-300 hover:text-gray-500 shrink-0"
        tabIndex={-1}
        aria-label="drag handle"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      <span className="font-medium text-gray-800 truncate max-w-[120px]">{displayName}</span>
      {groupLabel && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold shrink-0">
          {groupLabel}
        </span>
      )}
      {suggested && (
        <span className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-200 px-1 rounded shrink-0">
          auto
        </span>
      )}
      <Badge variant={typeVariant} className="shrink-0 !text-[10px] !px-1 !py-0">{col.detected_type}</Badge>
    </div>
  );
}

/** Floating chip shown during drag */
function DragChip({ col, displayName, groupLabel }) {
  const { dotColor } = ROLE_LABELS.display_fields;
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-indigo-400 rounded-lg shadow-xl text-sm pointer-events-none opacity-95">
      <GripVertical className="w-3.5 h-3.5 text-gray-300" />
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      <span className="font-medium text-gray-800 truncate max-w-[120px]">{displayName}</span>
      {groupLabel && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold shrink-0">
          {groupLabel}
        </span>
      )}
      <Badge variant={typeVariant} className="shrink-0 !text-[10px] !px-1 !py-0">{col.detected_type}</Badge>
    </div>
  );
}

// ─── DroppableZone ───────────────────────────────────────────────────────────

function DroppableZone({ roleKey, info, columns, allColumns, roleMap, suggestedSet, displayNameMap, dupNames, groupMap, userGroupMap, colSearch, onEditGroup }) {
  const { isOver, setNodeRef } = useDroppable({ id: roleKey });
  const [collapsed, setCollapsed] = useState(false);
  const { Icon, label, desc, color, border, bg, ring, badgeVariant } = info;

  const borderColor = {
    blue:   'border-blue-200',
    green:  'border-green-200',
    purple: 'border-purple-200',
    gray:   'border-gray-200',
  }[color];

  const headerColor = {
    blue:   'text-blue-700',
    green:  'text-green-700',
    purple: 'text-purple-700',
    gray:   'text-gray-600',
  }[color];

  const overBorder = {
    blue:   'border-blue-400',
    green:  'border-green-400',
    purple: 'border-purple-400',
    gray:   'border-gray-400',
  }[color];

  const overBg = {
    blue:   'bg-blue-50/60',
    green:  'bg-green-50/60',
    purple: 'bg-purple-50/60',
    gray:   'bg-gray-100/60',
  }[color];

  const chipCount = columns.length;
  const query = colSearch.toLowerCase();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl border-2 transition-all duration-150',
        isOver ? `${overBorder} ${overBg} ring-2 ${ring}` : `${borderColor} bg-white`
      )}
    >
      {/* Zone header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer select-none',
          isOver ? overBg : 'hover:bg-gray-50/50'
        )}
        onClick={() => setCollapsed(c => !c)}
      >
        <Icon className={cn('w-4 h-4 shrink-0', headerColor)} />
        <span className={cn('text-sm font-semibold', headerColor)}>{label}</span>
        <span className="text-xs text-gray-400 hidden sm:inline">— {desc}</span>
        <Badge variant={badgeVariant} className="ml-auto shrink-0">{chipCount}</Badge>
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {/* Chip area */}
      {!collapsed && (
        <div className={cn(
          'min-h-[52px] px-3 pb-3 flex flex-wrap gap-2 transition-colors',
          isOver ? overBg : ''
        )}>
          {columns.length === 0 ? (
            <div className={cn(
              'w-full flex items-center justify-center h-10 rounded-lg border-2 border-dashed text-xs text-gray-400',
              isOver ? 'border-current opacity-70' : 'border-gray-200'
            )}>
              Drop columns here
            </div>
          ) : (
            columns.map(col => {
              const dn = displayNameMap[col.index] || col.name;
              const gl = dupNames.has(col.name)
                ? (userGroupMap[col.index] || groupMap[col.index] || `#${col.index}`)
                : null;
              const isFiltered = query ? !dn.toLowerCase().includes(query) && !col.name.toLowerCase().includes(query) : false;
              return (
                <DraggableChip
                  key={col.index}
                  col={col}
                  role={roleKey}
                  suggested={suggestedSet.has(col.index)}
                  displayName={dn}
                  groupLabel={gl}
                  isFiltered={isFiltered}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── FileBDiffPanel ──────────────────────────────────────────────────────────

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
              <div className="flex flex-wrap gap-1">{onlyInA.map(n => <Badge key={n} variant="red">{n}</Badge>)}</div>
            </div>
          )}
          {onlyInB.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Only in File B — will be missing in A</p>
              <div className="flex flex-wrap gap-1">{onlyInB.map(n => <Badge key={n} variant="green">{n}</Badge>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GroupBadgeEditor ────────────────────────────────────────────────────────

function GroupBadgeEditor({ label, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    else setValue(label);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(label); setEditing(false); } }}
        className="text-xs border border-indigo-300 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
        maxLength={20}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition-colors cursor-pointer"
      title="Click to rename group"
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Step3_ColumnMapper({ wizard }) {
  const { state, update } = wizard;
  const analysis = state.analysis || {};
  const sheetsA = analysis.file_a?.sheets || [];
  const sheetsB = analysis.file_b?.sheets || [];
  const selectedSheet = sheetsA.find(s => s.name === state.selectedSheets.file_a);
  const allColumns = selectedSheet?.columns || [];

  const formulaColNames = allColumns.filter(c => c.detected_type === 'formula').map(c => c.name);
  const emptyColNames  = allColumns.filter(c => c.detected_type === 'empty').map(c => c.name);

  // roleMap: { [col.index]: role }
  const [roleMap, setRoleMap] = useState(() => buildInitialRoleMap(allColumns, state.columnMapping));
  const [suggestedSet, setSuggestedSet] = useState(() => computeSuggested(allColumns, state.columnMapping));
  const [userGroupMap, setUserGroupMap] = useState({}); // { [col.index]: userLabel }
  const [activeId, setActiveId] = useState(null);       // col.index of dragged chip
  const [colSearch, setColSearch] = useState('');

  // Duplicate detection
  const { dupNames, groupMap } = useMemo(() => detectDuplicateGroups(allColumns), [allColumns]);

  // Display name map: col.index → display name (raw col.name for unique, same for dups — group badge handles disambiguation visually)
  const displayNameMap = useMemo(() => {
    const map = {};
    allColumns.forEach(col => { map[col.index] = col.name; });
    return map;
  }, [allColumns]);

  // Reset when sheet changes
  useEffect(() => {
    if (allColumns.length === 0) return;
    setRoleMap(buildInitialRoleMap(allColumns, state.columnMapping));
    setSuggestedSet(computeSuggested(allColumns, state.columnMapping));
    setUserGroupMap({});
    setColSearch('');
    setActiveId(null);
  }, [selectedSheet?.name]);

  const handleRoleChange = (colIndex, newRole) => {
    setRoleMap(prev => ({ ...prev, [colIndex]: newRole }));
    setSuggestedSet(prev => { const s = new Set(prev); s.delete(colIndex); return s; });
  };

  const getColsByRole = (role) =>
    allColumns.filter(col => roleMap[col.index] === role);

  // DnD sensors — 8px threshold prevents accidental drags
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || !ROLE_LABELS[over.id]) return;
    handleRoleChange(active.id, over.id);
  };

  const activeCol = activeId != null ? allColumns.find(c => c.index === activeId) : null;

  // Bulk actions (operate on col.index keys)
  const handleBulkSetCompare = () => {
    setRoleMap(prev => {
      const next = { ...prev };
      allColumns.forEach(col => { if (next[col.index] === 'display_fields') next[col.index] = 'compare_fields'; });
      return next;
    });
  };

  const handleBulkResetDisplay = () => {
    setRoleMap(prev => {
      const next = { ...prev };
      allColumns.forEach(col => { if (next[col.index] !== 'unique_key') next[col.index] = 'display_fields'; });
      return next;
    });
  };

  const handleContinue = () => {
    // Build output: disambiguated names for duplicates
    const buildNames = (role) =>
      getColsByRole(role).map(col => {
        if (dupNames.has(col.name)) {
          const gl = userGroupMap[col.index] || groupMap[col.index] || col.index;
          return `${col.name} [${gl}]`;
        }
        return col.name;
      });

    update({
      columnMapping: {
        unique_key:     buildNames('unique_key'),
        compare_fields: buildNames('compare_fields'),
        display_fields: buildNames('display_fields'),
        ignored_fields: buildNames('ignored_fields'),
        formula_fields: state.columnMapping.formula_fields || {},
      },
      step: 4,
    });
  };

  const canContinue = getColsByRole('unique_key').length > 0;
  const hasCompareFields = getColsByRole('compare_fields').length > 0;
  const hasDuplicates = dupNames.size > 0;

  // Group duplicate columns by name for the panel
  const dupGroups = useMemo(() => {
    const groups = {};
    dupNames.forEach(name => {
      groups[name] = allColumns.filter(c => c.name === name).sort((a, b) => a.index - b.index);
    });
    return groups;
  }, [dupNames, allColumns]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Map Columns</h2>
          <p className="text-sm text-gray-500">
            Drag columns into the appropriate role zone. The{' '}
            <span className="font-semibold text-blue-700">Unique Key</span> identifies matching rows between files.
          </p>
        </div>

        {/* Search + bulk actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Filter columns by name..."
              value={colSearch}
              onChange={e => setColSearch(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700 whitespace-nowrap"
            onClick={handleBulkSetCompare}
          >
            Set unassigned → Compare
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs border border-gray-200 hover:border-gray-300 whitespace-nowrap"
            onClick={handleBulkResetDisplay}
          >
            Reset all → Display
          </Button>
        </div>

        {/* Duplicate column detection panel */}
        {hasDuplicates && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-100/60 border-b border-yellow-200">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
              <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider">
                Duplicate Column Names — Label &amp; Assign
              </p>
            </div>

            {/* How-to banner */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-start gap-2 text-xs text-yellow-800 bg-yellow-100/70 rounded-lg px-3 py-2 mb-3">
                <span className="font-bold shrink-0">How to use:</span>
                <span>
                  Your file has columns with the same name (e.g. <em>Age</em> appears for each product group).
                  {' '}<strong>Step 1</strong> — Click each badge below to rename it to a short label like <em>GTL</em>, <em>GHS</em>, <em>GMM</em>.
                  {' '}<strong>Step 2</strong> — In the zones below, drag the labeled chips (e.g. <em>Age [GTL]</em>, <em>Age [GHS]</em>) to the correct role.
                </span>
              </div>

              {/* Duplicate groups */}
              <div className="space-y-2.5">
                {Object.entries(dupGroups).map(([name, cols]) => (
                  <div key={name} className="flex items-start flex-wrap gap-1.5">
                    <span className="text-xs font-semibold text-gray-700 mt-0.5 min-w-[120px]">
                      {name.length > 28 ? name.slice(0, 28) + '…' : name}
                      <span className="ml-1 text-yellow-600 font-normal">(×{cols.length})</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cols.map(col => (
                        <GroupBadgeEditor
                          key={col.index}
                          label={userGroupMap[col.index] || groupMap[col.index] || `#${col.index}`}
                          onSave={label => setUserGroupMap(prev => ({ ...prev, [col.index]: label }))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-600 mt-2.5">
                💡 After renaming, find the labeled chips in the zones below and drag them to <strong>Compare Fields</strong> to track changes.
              </p>
            </div>
          </div>
        )}

        {/* 4 role drop zones */}
        {allColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No columns detected. Go back and select a sheet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(ROLE_LABELS).map(([roleKey, info]) => (
              <DroppableZone
                key={roleKey}
                roleKey={roleKey}
                info={info}
                columns={getColsByRole(roleKey)}
                allColumns={allColumns}
                roleMap={roleMap}
                suggestedSet={suggestedSet}
                displayNameMap={displayNameMap}
                dupNames={dupNames}
                groupMap={groupMap}
                userGroupMap={userGroupMap}
                colSearch={colSearch}
              />
            ))}
          </div>
        )}

        {/* Auto-excluded empty columns panel */}
        {emptyColNames.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Auto-excluded Empty Columns ({emptyColNames.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emptyColNames.map(n => <Badge key={n} variant="gray">{n}</Badge>)}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              These columns contain no data and are auto-assigned to Ignore.
            </p>
          </div>
        )}

        {/* Formula columns panel */}
        {formulaColNames.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Sigma className="w-3.5 h-3.5 text-orange-500" />
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Formula Columns (read-only)</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formulaColNames.map(n => <Badge key={n} variant="orange">{n}</Badge>)}
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

        {/* Validation alerts */}
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

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => update({ step: 2 })}>← Back</Button>
          <Button variant="primary" onClick={handleContinue} disabled={!canContinue}>
            Build Rules <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeCol ? (
          <DragChip
            col={activeCol}
            displayName={displayNameMap[activeCol.index] || activeCol.name}
            groupLabel={
              dupNames.has(activeCol.name)
                ? (userGroupMap[activeCol.index] || groupMap[activeCol.index] || `#${activeCol.index}`)
                : null
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
