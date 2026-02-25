import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  Key, GitCompare, Eye, EyeOff, AlertTriangle, ArrowRight,
  Search, ChevronDown, ChevronRight, Sigma, GripVertical,
  AlertCircle, ChevronUp, Pencil, Check, X,
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
  formula: 'orange', date: 'purple', numeric: 'blue', text: 'gray', empty: 'gray',
};

// 8 distinct color schemes for occurrence slots — avoids role colors (blue/green/purple/gray)
const OCCURRENCE_COLORS = [
  { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-300',  dot: 'bg-orange-400',  chipBg: 'bg-orange-50'  },
  { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300',    dot: 'bg-teal-500',    chipBg: 'bg-teal-50'    },
  { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300',    dot: 'bg-rose-400',    chipBg: 'bg-rose-50'    },
  { bg: 'bg-lime-100',    text: 'text-lime-800',    border: 'border-lime-300',    dot: 'bg-lime-500',    chipBg: 'bg-lime-50'    },
  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-300',  dot: 'bg-violet-400',  chipBg: 'bg-violet-50'  },
  { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   dot: 'bg-amber-500',   chipBg: 'bg-amber-50'   },
  { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-300',    dot: 'bg-cyan-500',    chipBg: 'bg-cyan-50'    },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300', dot: 'bg-fuchsia-400', chipBg: 'bg-fuchsia-50' },
];

const KEY_PATTERNS = /\b(id|nric|staff[_\s]?id|employee[_\s]?id|code|fin|ic|ref|no\.?)\b/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 0-based column index → Excel letter (A, B, …, Z, AA, AB, …) */
function indexToColLetter(idx) {
  let result = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function getSmartDefault(col) {
  if (col.detected_type === 'empty') return 'ignored_fields';
  const n = col.name?.toLowerCase() || '';
  if (KEY_PATTERNS.test(n)) return 'unique_key';
  if (col.detected_type === 'date' || col.detected_type === 'numeric') return 'compare_fields';
  if (col.detected_type === 'formula') return 'display_fields';
  return 'display_fields';
}

// Structural types always win — never overridden by saved state
const STRUCTURAL_ROLES = { empty: 'ignored_fields', formula: 'display_fields' };

/** Parse "ColName [GroupLabel]" → { baseName, groupLabel } or null */
function parseBracketName(savedName) {
  const m = savedName.match(/^(.+?)\s*\[(.+)\]$/);
  return m ? { baseName: m[1], groupLabel: m[2] } : null;
}

// Shared helper: for each duplicate baseName, collect saved bracket entries in
// role-processing order and match them to column indices — first by exact
// auto-label, then by position order as fallback (handles custom-renamed labels).
function _matchDupsByPosition(cols, mapping, groupMap, callback) {
  const nameCounts = {};
  cols.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
  const dupNameSet = new Set(Object.keys(nameCounts).filter(n => nameCounts[n] > 1));

  // Collect bracket entries per baseName in stable order (same order handleContinue writes them)
  const ROLE_ORDER = ['unique_key', 'compare_fields', 'display_fields', 'ignored_fields'];
  const dupByBase = {}; // baseName → [{role, groupLabel}]
  ROLE_ORDER.forEach(role => {
    (mapping[role] || []).forEach(savedName => {
      const parsed = parseBracketName(savedName);
      if (parsed && dupNameSet.has(parsed.baseName)) {
        (dupByBase[parsed.baseName] = dupByBase[parsed.baseName] || []).push({ role, groupLabel: parsed.groupLabel });
      }
    });
  });

  Object.entries(dupByBase).forEach(([baseName, assignments]) => {
    const dupCols = cols
      .filter(c => c.name === baseName && !STRUCTURAL_ROLES[c.detected_type])
      .sort((a, b) => a.index - b.index);

    // Pass 1: exact auto-label match
    const usedIdx = new Set();
    const unmatched = [];
    assignments.forEach(({ role, groupLabel }) => {
      const col = dupCols.find(c => !usedIdx.has(c.index) && String(groupMap[c.index] ?? c.index) === groupLabel);
      if (col) { usedIdx.add(col.index); callback(col, role, groupLabel, true); }
      else { unmatched.push({ role, groupLabel }); }
    });

    // Pass 2: positional fallback for unmatched (custom-renamed labels)
    const leftCols = dupCols.filter(c => !usedIdx.has(c.index));
    unmatched.forEach(({ role, groupLabel }, i) => {
      if (i < leftCols.length) callback(leftCols[i], role, groupLabel, false);
    });
  });
}

function buildInitialRoleMap(cols, mapping, groupMap = {}) {
  const map = {};
  cols.forEach(col => { map[col.index] = getSmartDefault(col); });

  // Plain (non-duplicate) names
  const ROLE_ORDER = ['unique_key', 'compare_fields', 'display_fields', 'ignored_fields'];
  const nameCounts = {};
  cols.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
  const dupNameSet = new Set(Object.keys(nameCounts).filter(n => nameCounts[n] > 1));
  ROLE_ORDER.forEach(role => {
    (mapping[role] || []).forEach(savedName => {
      if (parseBracketName(savedName)) return; // handled by _matchDupsByPosition
      cols.forEach(col => {
        if (!STRUCTURAL_ROLES[col.detected_type] && col.name === savedName && !dupNameSet.has(col.name)) {
          map[col.index] = role;
        }
      });
    });
  });

  // Duplicate bracket names — exact then positional fallback
  _matchDupsByPosition(cols, mapping, groupMap, (col, role) => { map[col.index] = role; });

  return map;
}

/** Restore user-customized group labels from saved bracket names */
function buildRestoredUserGroupMap(cols, mapping, groupMap = {}) {
  const restoredMap = {};
  _matchDupsByPosition(cols, mapping, groupMap, (col, _role, groupLabel, exactMatch) => {
    // Only store label if it differs from the auto-label (i.e., user customized it)
    const autoLabel = String(groupMap[col.index] ?? col.index);
    if (!exactMatch || groupLabel !== autoLabel) {
      restoredMap[col.index] = groupLabel;
    }
  });
  return restoredMap;
}

function computeSuggested(cols, mapping, groupMap = {}) {
  const assignedIndices = new Set();

  // Plain names
  const nameCounts = {};
  cols.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
  const dupNameSet = new Set(Object.keys(nameCounts).filter(n => nameCounts[n] > 1));
  ['unique_key', 'compare_fields', 'display_fields', 'ignored_fields'].forEach(role => {
    (mapping[role] || []).forEach(savedName => {
      if (parseBracketName(savedName)) return;
      cols.forEach(col => { if (col.name === savedName && !dupNameSet.has(col.name)) assignedIndices.add(col.index); });
    });
  });

  // Duplicate bracket names — exact then positional fallback
  _matchDupsByPosition(cols, mapping, groupMap, (col) => assignedIndices.add(col.index));

  const suggested = new Set();
  cols.forEach(col => { if (!assignedIndices.has(col.index)) suggested.add(col.index); });
  return suggested;
}

/** Detect duplicate column names; compute auto group labels from neighboring columns */
function detectDuplicateGroups(allColumns) {
  const nameCounts = {};
  allColumns.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
  const dupNames = new Set(Object.keys(nameCounts).filter(n => nameCounts[n] > 1));

  const groupMap = {};
  dupNames.forEach(name => {
    const dups = allColumns.filter(c => c.name === name).sort((a, b) => a.index - b.index);
    dups.forEach((col, i) => {
      if (i === 0) {
        const prevCols = allColumns.filter(c => c.index < col.index && !dupNames.has(c.name));
        const nearest = prevCols[prevCols.length - 1];
        groupMap[col.index] = nearest ? nearest.name : `Group ${i + 1}`;
      } else {
        const prev = dups[i - 1];
        const between = allColumns.filter(
          c => c.index > prev.index && c.index < col.index && !dupNames.has(c.name)
        );
        groupMap[col.index] = between.length > 0 ? between[0].name : `Group ${i + 1}`;
      }
    });
  });

  return { dupNames, groupMap };
}

// ─── GroupLabelEditor ─────────────────────────────────────────────────────────

function GroupLabelEditor({ label, color, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef(null);

  // Sync external label changes (e.g. auto-label update)
  useEffect(() => { if (!editing) setValue(label); }, [label, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    else setValue(label);
    setEditing(false);
  };

  const cancel = () => { setValue(label); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className={cn(
            'text-xs border rounded px-2 py-1 w-24 focus:outline-none focus:ring-1',
            color.border, 'focus:ring-current bg-white', color.text
          )}
          maxLength={20}
          placeholder="Short label…"
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold border transition-all',
        'hover:shadow-sm active:scale-95',
        color.bg, color.text, color.border
      )}
      title="Click to rename this group label"
    >
      {label.length > 18 ? label.slice(0, 18) + '…' : label}
      <Pencil className="w-2.5 h-2.5 opacity-50" />
    </button>
  );
}

// ─── DraggableChip ───────────────────────────────────────────────────────────

function DraggableChip({ col, role, suggested, groupLabel, groupColor, isFiltered }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: col.index });
  const { dotColor } = ROLE_LABELS[role] || ROLE_LABELS.display_fields;
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';
  const colLetter = indexToColLetter(col.index);

  if (isFiltered) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 border rounded-lg text-sm select-none transition-opacity',
        groupColor ? groupColor.chipBg : 'bg-white',
        isDragging ? 'opacity-40 shadow-none border-gray-200' : 'shadow-sm hover:shadow-md border-gray-200 hover:border-gray-300'
      )}
    >
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 shrink-0"
        tabIndex={-1}
        aria-label="drag handle"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {/* Role color dot */}
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      {/* Column name */}
      <span className="font-medium text-gray-800 truncate max-w-[100px]">{col.name}</span>
      {/* Column position tag */}
      <span className="text-[10px] font-mono text-gray-400 shrink-0">{colLetter}</span>
      {/* Group label badge (colored, matches panel) */}
      {groupLabel && groupColor && (
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded-full font-semibold border shrink-0',
          groupColor.bg, groupColor.text, groupColor.border
        )}>
          {groupLabel.length > 12 ? groupLabel.slice(0, 12) + '…' : groupLabel}
        </span>
      )}
      {suggested && (
        <span className="text-[10px] bg-indigo-50 text-indigo-500 border border-indigo-200 px-1 rounded shrink-0">auto</span>
      )}
      <Badge variant={typeVariant} className="shrink-0 !text-[10px] !px-1 !py-0">{col.detected_type}</Badge>
    </div>
  );
}

/** Floating chip rendered during drag via DragOverlay */
function DragChip({ col, groupLabel, groupColor }) {
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';
  const colLetter = indexToColLetter(col.index);
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1.5 border-2 border-indigo-400 rounded-lg shadow-2xl text-sm pointer-events-none',
      groupColor ? groupColor.chipBg : 'bg-white'
    )}>
      <GripVertical className="w-3.5 h-3.5 text-gray-300" />
      <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
      <span className="font-medium text-gray-800 truncate max-w-[100px]">{col.name}</span>
      <span className="text-[10px] font-mono text-gray-400 shrink-0">{colLetter}</span>
      {groupLabel && groupColor && (
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded-full font-semibold border shrink-0',
          groupColor.bg, groupColor.text, groupColor.border
        )}>
          {groupLabel.length > 12 ? groupLabel.slice(0, 12) + '…' : groupLabel}
        </span>
      )}
      <Badge variant={typeVariant} className="shrink-0 !text-[10px] !px-1 !py-0">{col.detected_type}</Badge>
    </div>
  );
}

// ─── DroppableZone ───────────────────────────────────────────────────────────

function DroppableZone({
  roleKey, info, columns, suggestedSet,
  dupNames, groupMap, userGroupMap, occurrenceColorMap, colSearch,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: roleKey });
  const [collapsed, setCollapsed] = useState(false);
  const [zoneSearch, setZoneSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { Icon, label, desc, color, border, ring, badgeVariant } = info;

  const borderColor = { blue: 'border-blue-200', green: 'border-green-200', purple: 'border-purple-200', gray: 'border-gray-200' }[color];
  const headerColor = { blue: 'text-blue-700',   green: 'text-green-700',   purple: 'text-purple-700',   gray: 'text-gray-600'  }[color];
  const overBorder  = { blue: 'border-blue-400', green: 'border-green-400', purple: 'border-purple-400', gray: 'border-gray-400' }[color];
  const overBg      = { blue: 'bg-blue-50/60',   green: 'bg-green-50/60',   purple: 'bg-purple-50/60',   gray: 'bg-gray-100/60' }[color];
  const focusRing   = { blue: 'focus:ring-blue-300', green: 'focus:ring-green-300', purple: 'focus:ring-purple-300', gray: 'focus:ring-gray-300' }[color];

  // combined: global search OR zone-local search
  const query = (zoneSearch || colSearch).toLowerCase();

  const openSearch = (e) => {
    e.stopPropagation();
    setSearchOpen(true);
    setCollapsed(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = (e) => {
    e?.stopPropagation();
    setSearchOpen(false);
    setZoneSearch('');
  };

  const visibleCount = columns.filter(col => {
    if (!query) return true;
    const isDup = dupNames.has(col.name);
    const gl = isDup ? (userGroupMap[col.index] || groupMap[col.index] || '') : '';
    return col.name.toLowerCase().includes(query) || gl.toLowerCase().includes(query);
  }).length;

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
        className={cn('flex items-center gap-2 px-3 py-2 select-none', isOver ? overBg : 'hover:bg-gray-50/50')}
      >
        {/* Left — click to collapse */}
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left"
          onClick={() => setCollapsed(c => !c)}
        >
          <Icon className={cn('w-4 h-4 shrink-0', headerColor)} />
          <span className={cn('text-sm font-semibold', headerColor)}>{label}</span>
          <span className="text-xs text-gray-400 hidden sm:inline truncate">— {desc}</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zone search input (inline, expands when open) */}
          {searchOpen ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <Search className={cn('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', headerColor)} />
                <input
                  ref={searchInputRef}
                  value={zoneSearch}
                  onChange={e => setZoneSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && closeSearch()}
                  placeholder="Filter…"
                  className={cn(
                    'w-32 pl-6 pr-2 py-1 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1',
                    borderColor, focusRing
                  )}
                />
              </div>
              {zoneSearch && (
                <span className="text-xs text-gray-400">{visibleCount}/{columns.length}</span>
              )}
              <button
                type="button"
                onClick={closeSearch}
                className="text-gray-400 hover:text-gray-600 p-0.5"
                title="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openSearch}
              className={cn('p-1 rounded-lg hover:bg-white/70 transition-colors', headerColor)}
              title={`Search within ${label}`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          <Badge variant={badgeVariant} className="shrink-0">{columns.length}</Badge>
          <button type="button" onClick={() => setCollapsed(c => !c)} className="text-gray-400">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chip area */}
      {!collapsed && (
        <div className={cn('min-h-[52px] px-3 pb-3 flex flex-wrap gap-2', isOver ? overBg : '')}>
          {columns.length === 0 ? (
            <div className={cn(
              'w-full flex items-center justify-center h-10 rounded-lg border-2 border-dashed text-xs text-gray-400',
              isOver ? 'border-current opacity-60' : 'border-gray-200'
            )}>
              Drop columns here
            </div>
          ) : (
            columns.map(col => {
              const isDup = dupNames.has(col.name);
              const gl = isDup ? (userGroupMap[col.index] || groupMap[col.index] || 'Group') : null;
              const gc = isDup ? occurrenceColorMap[col.index] : null;
              const isFiltered = query
                ? !col.name.toLowerCase().includes(query) && !(gl || '').toLowerCase().includes(query)
                : false;
              return (
                <DraggableChip
                  key={col.index}
                  col={col}
                  role={roleKey}
                  suggested={suggestedSet.has(col.index)}
                  groupLabel={gl}
                  groupColor={gc}
                  isFiltered={isFiltered}
                />
              );
            })
          )}
          {/* No-match state */}
          {query && visibleCount === 0 && columns.length > 0 && (
            <p className="text-xs text-gray-400 italic w-full text-center py-2">
              No columns match "{zoneSearch || colSearch}"
            </p>
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

// ─── DuplicatePanel ──────────────────────────────────────────────────────────

function DuplicatePanel({ dupGroups, groupMap, userGroupMap, occurrenceColorMap, onSaveLabel }) {
  return (
    <div className="border border-yellow-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border-b border-yellow-200">
        <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
        <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider">
          Duplicate Column Names Detected
        </p>
      </div>

      <div className="p-4 bg-white space-y-4">
        {/* Explanation */}
        <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-blue-800 space-y-1">
          <p><strong>What are these?</strong> Your spreadsheet has multiple columns sharing the same name (e.g. "Age" appears 6 times — once per product group).</p>
          <p><strong>What to do:</strong></p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Each colored row below = one occurrence. The <span className="font-mono font-semibold">Col B</span> tag shows its position in the spreadsheet.</li>
            <li>The label (e.g. <em>"GTL Category"</em>) is auto-suggested from the column next to it — click <Pencil className="inline w-2.5 h-2.5" /> to rename it to a short label like <strong>GTL</strong>, <strong>GHS</strong>, <strong>GMM</strong>.</li>
            <li>In the zones below, find the matching colored chips (e.g. <em>Age [GTL]</em>) and drag them to <strong className="text-green-700">Compare Fields</strong>.</li>
          </ol>
        </div>

        {/* One card per duplicate group */}
        {Object.entries(dupGroups).map(([name, cols]) => (
          <div key={name}>
            {/* Group name header */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-800 truncate">
                "{name.length > 40 ? name.slice(0, 40) + '…' : name}"
              </span>
              <span className="text-xs text-gray-400 shrink-0">appears {cols.length}× in the spreadsheet</span>
            </div>

            {/* Table of occurrences */}
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {/* Table header */}
              <div className="grid grid-cols-[20px_48px_1fr_160px] gap-3 items-center px-3 py-1.5 bg-gray-50">
                <span className="text-[10px] text-gray-400 font-semibold uppercase">#</span>
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Col</span>
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Auto-suggested from nearby column</span>
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Your label (click to rename)</span>
              </div>

              {cols.map((col, i) => {
                const color = occurrenceColorMap[col.index] || OCCURRENCE_COLORS[0];
                const autoLabel = groupMap[col.index] || '';
                const currentLabel = userGroupMap[col.index] || autoLabel || `Group ${i + 1}`;
                const colLetter = indexToColLetter(col.index);

                return (
                  <div
                    key={col.index}
                    className="grid grid-cols-[20px_48px_1fr_160px] gap-3 items-center px-3 py-2"
                  >
                    {/* Occurrence number with color dot */}
                    <div className="flex items-center gap-1">
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color.dot)} />
                    </div>

                    {/* Column letter badge */}
                    <span className={cn(
                      'text-xs font-mono font-bold px-1.5 py-0.5 rounded text-center border',
                      color.bg, color.text, color.border
                    )}>
                      {colLetter}
                    </span>

                    {/* Auto-suggested label (greyed out, shows origin) */}
                    <span
                      className="text-xs text-gray-500 truncate"
                      title={autoLabel ? `Neighboring column: "${autoLabel}"` : 'No neighbor detected'}
                    >
                      {autoLabel
                        ? <><span className="text-gray-400 mr-1">←</span>{autoLabel}</>
                        : <span className="text-gray-300 italic">—</span>
                      }
                    </span>

                    {/* Rename label */}
                    <div>
                      <GroupLabelEditor
                        label={currentLabel}
                        color={color}
                        onSave={lbl => onSaveLabel(col.index, lbl)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-gray-400">
          After labeling, each chip in the zones below will show the colored label — drag them to the correct role.
        </p>
      </div>
    </div>
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
  const emptyColNames   = allColumns.filter(c => c.detected_type === 'empty').map(c => c.name);

  const [roleMap, setRoleMap]         = useState(() => {
    const { groupMap: gm } = detectDuplicateGroups(allColumns);
    return buildInitialRoleMap(allColumns, state.columnMapping, gm);
  });
  const [suggestedSet, setSuggestedSet] = useState(() => {
    const { groupMap: gm } = detectDuplicateGroups(allColumns);
    return computeSuggested(allColumns, state.columnMapping, gm);
  });
  const [userGroupMap, setUserGroupMap] = useState(() => {
    const { groupMap: gm } = detectDuplicateGroups(allColumns);
    return buildRestoredUserGroupMap(allColumns, state.columnMapping, gm);
  });
  const [activeId, setActiveId]         = useState(null);
  const [colSearch, setColSearch]       = useState('');

  const { dupNames, groupMap } = useMemo(() => detectDuplicateGroups(allColumns), [allColumns]);

  /** color map: col.index → OCCURRENCE_COLORS[i] based on order within its dup group */
  const occurrenceColorMap = useMemo(() => {
    const map = {};
    dupNames.forEach(name => {
      const cols = allColumns.filter(c => c.name === name).sort((a, b) => a.index - b.index);
      cols.forEach((col, i) => { map[col.index] = OCCURRENCE_COLORS[i % OCCURRENCE_COLORS.length]; });
    });
    return map;
  }, [dupNames, allColumns]);

  const dupGroups = useMemo(() => {
    const groups = {};
    dupNames.forEach(name => {
      groups[name] = allColumns.filter(c => c.name === name).sort((a, b) => a.index - b.index);
    });
    return groups;
  }, [dupNames, allColumns]);

  // Reset when sheet changes (also restores saved roles and group labels)
  useEffect(() => {
    if (allColumns.length === 0) return;
    const { groupMap: gm } = detectDuplicateGroups(allColumns);
    setRoleMap(buildInitialRoleMap(allColumns, state.columnMapping, gm));
    setSuggestedSet(computeSuggested(allColumns, state.columnMapping, gm));
    setUserGroupMap(buildRestoredUserGroupMap(allColumns, state.columnMapping, gm));
    setColSearch('');
    setActiveId(null);
  }, [selectedSheet?.name]); // eslint-disable-line

  const handleRoleChange = (colIndex, newRole) => {
    setRoleMap(prev => ({ ...prev, [colIndex]: newRole }));
    setSuggestedSet(prev => { const s = new Set(prev); s.delete(colIndex); return s; });
  };

  const getColsByRole = role => allColumns.filter(col => roleMap[col.index] === role);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragStart = ({ active }) => setActiveId(active.id);
  const handleDragEnd   = ({ active, over }) => {
    setActiveId(null);
    if (!over || !ROLE_LABELS[over.id]) return;
    handleRoleChange(active.id, over.id);
  };

  const activeCol = activeId != null ? allColumns.find(c => c.index === activeId) : null;

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
    const buildNames = role =>
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
      maxStep: Math.max(state.maxStep || 1, 4),
    });
  };

  const canContinue    = getColsByRole('unique_key').length > 0;
  const hasCompareFields = getColsByRole('compare_fields').length > 0;
  const hasDuplicates  = dupNames.size > 0;

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
              placeholder="Filter columns by name or label…"
              value={colSearch}
              onChange={e => setColSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" className="text-xs border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700 whitespace-nowrap" onClick={handleBulkSetCompare}>
            Set unassigned → Compare
          </Button>
          <Button variant="ghost" size="sm" className="text-xs border border-gray-200 hover:border-gray-300 whitespace-nowrap" onClick={handleBulkResetDisplay}>
            Reset all → Display
          </Button>
        </div>

        {/* Duplicate panel */}
        {hasDuplicates && (
          <DuplicatePanel
            dupGroups={dupGroups}
            groupMap={groupMap}
            userGroupMap={userGroupMap}
            occurrenceColorMap={occurrenceColorMap}
            onSaveLabel={(idx, lbl) => setUserGroupMap(prev => ({ ...prev, [idx]: lbl }))}
          />
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
                suggestedSet={suggestedSet}
                dupNames={dupNames}
                groupMap={groupMap}
                userGroupMap={userGroupMap}
                occurrenceColorMap={occurrenceColorMap}
                colSearch={colSearch}
              />
            ))}
          </div>
        )}

        {/* Auto-excluded empty columns */}
        {emptyColNames.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Auto-excluded Empty Columns ({emptyColNames.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emptyColNames.map(n => <Badge key={n} variant="gray">{n}</Badge>)}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">These columns contain no data and are auto-assigned to Ignore.</p>
          </div>
        )}

        {/* Formula columns */}
        {formulaColNames.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Sigma className="w-3.5 h-3.5 text-orange-500" />
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Formula Columns (read-only)</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formulaColNames.map(n => <Badge key={n} variant="orange">{n}</Badge>)}
            </div>
            <p className="text-xs text-orange-600 mt-1.5">These columns contain formulas. They're auto-assigned to Display Only.</p>
          </div>
        )}

        {/* File B diff */}
        {sheetsB.length > 0 && state.selectedSheets.file_a && state.selectedSheets.file_b && (
          <FileBDiffPanel sheetsA={sheetsA} sheetsB={sheetsB} selectedA={state.selectedSheets.file_a} selectedB={state.selectedSheets.file_b} />
        )}

        {/* Alerts */}
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

      <DragOverlay dropAnimation={null}>
        {activeCol ? (
          <DragChip
            col={activeCol}
            groupLabel={
              dupNames.has(activeCol.name)
                ? (userGroupMap[activeCol.index] || groupMap[activeCol.index] || 'Group')
                : null
            }
            groupColor={occurrenceColorMap[activeCol.index] || null}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
