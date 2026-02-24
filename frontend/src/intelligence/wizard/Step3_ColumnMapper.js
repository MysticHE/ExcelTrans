import React, { useEffect, useState } from 'react';
import { Key, GitCompare, Eye, EyeOff, AlertTriangle, ArrowRight } from 'lucide-react';
import { Alert, Button, Badge, cn } from '../ui';

const ROLE_LABELS = {
  unique_key: { label: 'Unique Key', color: 'blue', borderColor: 'border-l-blue-400', iconColor: 'text-blue-500', desc: 'Matches rows between files', Icon: Key },
  compare_fields: { label: 'Compare Fields', color: 'green', borderColor: 'border-l-green-400', iconColor: 'text-green-500', desc: 'Fields checked for changes', Icon: GitCompare },
  display_fields: { label: 'Display Only', color: 'purple', borderColor: 'border-l-purple-400', iconColor: 'text-purple-500', desc: 'Shown in output but not compared', Icon: Eye },
  ignored_fields: { label: 'Ignore', color: 'gray', borderColor: 'border-l-gray-400', iconColor: 'text-gray-400', desc: 'Excluded from output', Icon: EyeOff },
};

const TYPE_BADGE_VARIANT = {
  formula: 'orange',
  date: 'purple',
  numeric: 'blue',
  text: 'gray',
};

function ColumnChip({ col, role, onRoleChange }) {
  const typeVariant = TYPE_BADGE_VARIANT[col.detected_type] || 'gray';

  return (
    <div className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{col.name}</p>
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

function RoleSection({ roleKey, info, columns }) {
  const { Icon, label, color, borderColor, iconColor, desc } = info;
  const badgeVariant = { blue: 'blue', green: 'green', purple: 'purple', gray: 'gray' }[color] || 'gray';

  return (
    <div className={cn('bg-gray-50 rounded-xl p-3 border-l-4', borderColor)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-3.5 h-3.5', iconColor)} />
        <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
        <span className="text-xs text-gray-400 hidden sm:inline">— {desc}</span>
        <Badge variant={badgeVariant} className="ml-auto">{columns.length}</Badge>
      </div>
      {columns.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No columns assigned</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {columns.map(name => (
            <span key={name} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step3_ColumnMapper({ wizard }) {
  const { state, update } = wizard;
  const analysis = state.analysis || {};
  const sheetsA = analysis.file_a?.sheets || [];
  const selectedSheet = sheetsA.find(s => s.name === state.selectedSheets.file_a);
  const allColumns = selectedSheet?.columns || [];

  const [roleMap, setRoleMap] = useState(() => {
    const map = {};
    allColumns.forEach(col => { map[col.name] = 'display_fields'; });
    state.columnMapping.unique_key.forEach(n => { map[n] = 'unique_key'; });
    state.columnMapping.compare_fields.forEach(n => { map[n] = 'compare_fields'; });
    state.columnMapping.display_fields?.forEach(n => { map[n] = 'display_fields'; });
    state.columnMapping.ignored_fields?.forEach(n => { map[n] = 'ignored_fields'; });
    return map;
  });

  useEffect(() => {
    if (allColumns.length === 0) return;
    setRoleMap(prev => {
      const next = {};
      allColumns.forEach(col => { next[col.name] = prev[col.name] || 'display_fields'; });
      return next;
    });
  }, [selectedSheet?.name]);

  const handleRoleChange = (colName, newRole) => {
    setRoleMap(prev => ({ ...prev, [colName]: newRole }));
  };

  const getColumnsByRole = (role) =>
    Object.entries(roleMap).filter(([, r]) => r === role).map(([n]) => n);

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

  const canContinue = getColumnsByRole('unique_key').length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Map Columns</h2>
        <p className="text-sm text-gray-500">
          Assign a role to each column. The{' '}
          <span className="font-semibold text-blue-700">Unique Key</span> identifies matching rows between files.
        </p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([key, info]) => (
          <RoleSection key={key} roleKey={key} info={info} columns={getColumnsByRole(key)} />
        ))}
      </div>

      {/* Column list */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          All Columns — Assign Roles
        </h3>
        {allColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No columns detected. Go back and select a sheet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
            {allColumns.map(col => (
              <ColumnChip
                key={col.name}
                col={col}
                role={roleMap[col.name] || 'display_fields'}
                onRoleChange={handleRoleChange}
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

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => update({ step: 2 })}>← Back</Button>
        <Button variant="primary" onClick={handleContinue} disabled={!canContinue}>
          Build Rules <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
