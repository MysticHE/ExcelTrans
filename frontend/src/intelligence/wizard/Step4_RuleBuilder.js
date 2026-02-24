import React, { useState, useMemo } from 'react';
import {
  Users, Pencil, GitBranch, Link2, Plus, Trash2, Sparkles,
  GitMerge, AlertCircle, ArrowRight, ChevronUp, ChevronDown,
  Copy, Lock, Info
} from 'lucide-react';
import { aiNlToRule } from '../services/intelApi';
import { Button, Alert, Badge, cn } from '../ui';

const RULE_COLORS = ['#C6EFCE', '#FFC7CE', '#FFEB9C', '#FCE4D6', '#DDEBF7', '#E2EFDA'];

const RULE_TYPE_LABELS = {
  PRESENCE_RULE: { label: 'Presence Rule',  Icon: Users,      desc: 'Handle rows that only exist in one file', borderColor: 'border-l-emerald-400' },
  CHANGE_RULE:   { label: 'Change Rule',     Icon: Pencil,     desc: 'Detect changed field values',             borderColor: 'border-l-yellow-400'  },
  CONDITION_RULE:{ label: 'Condition Rule',  Icon: GitBranch,  desc: 'IF conditions → outcome label',           borderColor: 'border-l-red-400'     },
  ROW_MATCH:     { label: 'Row Match',       Icon: Link2,      desc: 'How to match rows between files',         borderColor: 'border-l-blue-400'    },
};

const EXAMPLE_RULES = [
  {
    label: 'Detect Additions',
    desc: 'Label new rows in File B',
    rule_type: 'PRESENCE_RULE',
    config: { only_in_file_b: { outcome_label: 'Addition', color: '#C6EFCE' }, only_in_file_a: { outcome_label: 'Deletion', color: '#FFC7CE' } },
    output_column: '',
  },
  {
    label: 'Detect Changes',
    desc: 'Label rows with modified fields',
    rule_type: 'CHANGE_RULE',
    config: { fields: [], outcome_label: 'Changed', color: '#FFEB9C' },
    output_column: '',
  },
  {
    label: 'Flag Condition',
    desc: 'Mark rows matching custom conditions',
    rule_type: 'CONDITION_RULE',
    config: { conditions: [{ field: '', operator: 'is_not_empty' }], condition_join: 'AND', outcome_label: 'Flagged', color: '#FFC7CE' },
    output_column: '',
  },
];

const OPERATORS = [
  'is_empty', 'is_not_empty', 'equals', 'not_equals', 'contains', 'starts_with',
  'changed_from_empty', 'changed_to_empty', 'date_is_before', 'date_is_after',
  'changed_from_pattern', 'changed_to_pattern',
];
const VALUE_OPERATORS = ['equals', 'not_equals', 'contains', 'starts_with', 'changed_from_pattern', 'changed_to_pattern', 'date_is_before', 'date_is_after'];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {RULE_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'w-7 h-7 rounded-lg border-2 transition-all relative',
            value === c ? 'border-gray-700 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
          )}
          style={{ backgroundColor: c }}
        >
          {value === c && (
            <span className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs font-bold">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

function RuleCard({ rule, index, priorityInCol, allColumns, onUpdate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const rt = rule.rule_type;
  const typeInfo = RULE_TYPE_LABELS[rt] || { label: rt, Icon: GitMerge, desc: '', borderColor: 'border-l-gray-400' };
  const { Icon, label, desc, borderColor } = typeInfo;
  const cfg = rule.config || {};
  const outputCol = rule.output_column || '';

  const updateConfig = (partial) => onUpdate(index, { ...rule, config: { ...cfg, ...partial } });
  const updateOutputCol = (val) => onUpdate(index, { ...rule, output_column: val });

  // Validation
  const validationErrors = [];
  if (rt === 'CHANGE_RULE' && (!cfg.fields || cfg.fields.length === 0)) {
    validationErrors.push('Select at least one field to compare');
  }
  if (rt === 'CONDITION_RULE' && (!cfg.conditions || cfg.conditions.length === 0)) {
    validationErrors.push('Add at least one condition');
  }

  const colLabel = outputCol || 'Remarks';

  return (
    <div className={cn('border border-gray-200 rounded-xl p-4 bg-white shadow-sm border-l-4', borderColor)}>
      {/* Card header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-gray-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-gray-800 text-sm">{label}</p>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                #{priorityInCol}
              </span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded border font-medium',
                outputCol ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              )}>
                → {colLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate(index + 0.5, { ...rule })}
            className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
            title="Duplicate rule"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Output column input */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Output Column</label>
        <input
          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder='Leave empty for "Remarks" (default)'
          value={outputCol}
          onChange={(e) => updateOutputCol(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-0.5">
          Empty = shared "Remarks" column. Custom name creates a separate output column.
        </p>
      </div>

      {/* Rule-type specific config */}
      {rt === 'PRESENCE_RULE' && (
        <div className="grid grid-cols-2 gap-3">
          {[['only_in_file_b', 'Only in New File (Addition)'], ['only_in_file_a', 'Only in Old File (Deletion)']].map(([key, lbl]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs text-gray-500 font-medium">{lbl}</label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Label"
                value={cfg[key]?.outcome_label || ''}
                onChange={(e) => updateConfig({ [key]: { ...cfg[key], outcome_label: e.target.value } })}
              />
              <ColorPicker
                value={cfg[key]?.color}
                onChange={(c) => updateConfig({ [key]: { ...cfg[key], color: c } })}
              />
            </div>
          ))}
        </div>
      )}

      {rt === 'CHANGE_RULE' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Fields to Compare</label>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allColumns.map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    const fields = cfg.fields || [];
                    const next = fields.includes(col) ? fields.filter(f => f !== col) : [...fields, col];
                    updateConfig({ fields: next });
                  }}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition-colors',
                    (cfg.fields || []).includes(col)
                      ? 'bg-green-100 border-green-400 text-green-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-300'
                  )}
                >
                  {col}
                </button>
              ))}
              {allColumns.length === 0 && (
                <p className="text-xs text-gray-400 italic">No compare fields configured in Step 3.</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium">Outcome Label</label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={cfg.outcome_label || 'Changed'}
                onChange={(e) => updateConfig({ outcome_label: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Color</label>
              <div className="mt-1"><ColorPicker value={cfg.color} onChange={(c) => updateConfig({ color: c })} /></div>
            </div>
          </div>
        </div>
      )}

      {rt === 'CONDITION_RULE' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Conditions</label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Join:</span>
                {['AND', 'OR'].map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => updateConfig({ condition_join: j })}
                    className={cn(
                      'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                      cfg.condition_join === j ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
            {(cfg.conditions || []).map((cond, ci) => (
              <div key={ci} className="flex gap-2 items-center mb-2">
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={cond.field || ''}
                  onChange={(e) => {
                    const conds = [...(cfg.conditions || [])];
                    conds[ci] = { ...conds[ci], field: e.target.value };
                    updateConfig({ conditions: conds });
                  }}
                >
                  <option value="">-- Select field --</option>
                  {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={cond.operator || ''}
                  onChange={(e) => {
                    const conds = [...(cfg.conditions || [])];
                    conds[ci] = { ...conds[ci], operator: e.target.value };
                    updateConfig({ conditions: conds });
                  }}
                >
                  <option value="">-- Operator --</option>
                  {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                {VALUE_OPERATORS.includes(cond.operator) && (
                  <input
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="value"
                    value={cond.value || ''}
                    onChange={(e) => {
                      const conds = [...(cfg.conditions || [])];
                      conds[ci] = { ...conds[ci], value: e.target.value };
                      updateConfig({ conditions: conds });
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    const conds = (cfg.conditions || []).filter((_, i) => i !== ci);
                    updateConfig({ conditions: conds });
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateConfig({ conditions: [...(cfg.conditions || []), { field: '', operator: 'is_not_empty' }] })}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add condition
            </button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium">Outcome Label</label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder='e.g. "Terminated wef {Last Day of Service}"'
                value={cfg.outcome_label || ''}
                onChange={(e) => updateConfig({ outcome_label: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-0.5">Use {'{FieldName}'} to embed field values</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Color</label>
              <div className="mt-1"><ColorPicker value={cfg.color} onChange={(c) => updateConfig({ color: c })} /></div>
            </div>
          </div>
        </div>
      )}

      {rt === 'ROW_MATCH' && (
        <div className="flex gap-4 items-start">
          <div>
            <label className="text-xs text-gray-500 font-medium">Match Method</label>
            <div className="flex gap-2 mt-1.5">
              {['exact', 'fuzzy'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateConfig({ method: m })}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize',
                    cfg.method === m ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {cfg.method === 'fuzzy' && (
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium">
                Threshold: <span className="text-indigo-600 font-semibold">{cfg.fuzzy_threshold || 0.8}</span>
              </label>
              <input
                type="range" min="0.4" max="1.0" step="0.05"
                value={cfg.fuzzy_threshold || 0.8}
                onChange={(e) => updateConfig({ fuzzy_threshold: parseFloat(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
          )}
        </div>
      )}

      {/* Inline validation alerts */}
      {validationErrors.map((err, i) => (
        <Alert key={i} variant="warning" className="mt-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {err}
        </Alert>
      ))}
    </div>
  );
}

function EmptyStateExamples({ onAdd }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6">
      <GitMerge className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500 text-center mb-4">No rules yet. Try one of these examples:</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {EXAMPLE_RULES.map((ex, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50 opacity-80 hover:opacity-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
            <p className="text-sm font-semibold text-gray-700 group-hover:text-indigo-700 mb-0.5">{ex.label}</p>
            <p className="text-xs text-gray-400 mb-3">{ex.desc}</p>
            <button
              type="button"
              onClick={() => onAdd({ rule_type: ex.rule_type, config: ex.config, output_column: ex.output_column })}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add this example
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Step4_RuleBuilder({ wizard, aiConfig }) {
  const { state, update } = wizard;
  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState(null);

  const hasApiKey = !!(aiConfig?.apiKey);

  const allColumns = [
    ...(state.columnMapping.unique_key || []),
    ...(state.columnMapping.compare_fields || []),
    ...(state.columnMapping.display_fields || []),
  ];

  const hasPresenceRule = state.rules.some(r => r.rule_type === 'PRESENCE_RULE');

  // Compute per-output-column priority for each rule
  const rulePriorities = useMemo(() => {
    const colCounts = {};
    return state.rules.map(rule => {
      const col = rule.output_column || 'Remarks';
      colCounts[col] = (colCounts[col] || 0) + 1;
      return colCounts[col];
    });
  }, [state.rules]);

  // Compute unique output column groups for dividers
  const ruleGroups = useMemo(() => {
    const result = [];
    let lastCol = null;
    state.rules.forEach((rule, i) => {
      const col = rule.output_column || 'Remarks';
      if (col !== lastCol) {
        result.push({ index: i, col });
        lastCol = col;
      }
    });
    return result;
  }, [state.rules]);

  const addRule = (ruleOrType) => {
    if (typeof ruleOrType === 'string') {
      const defaults = {
        PRESENCE_RULE: { only_in_file_b: { outcome_label: 'Addition', color: '#C6EFCE' }, only_in_file_a: { outcome_label: 'Deletion', color: '#FFC7CE' } },
        CHANGE_RULE:   { fields: [], outcome_label: 'Changed', color: '#FFEB9C' },
        CONDITION_RULE:{ conditions: [], condition_join: 'AND', outcome_label: 'Flagged', color: '#FFC7CE' },
        ROW_MATCH:     { method: 'exact', fuzzy_threshold: 0.8 },
      };
      update({ rules: [...state.rules, { rule_type: ruleOrType, config: defaults[ruleOrType] || {}, output_column: '' }] });
    } else {
      // Adding an example rule or a full rule object
      update({ rules: [...state.rules, ruleOrType] });
    }
  };

  const updateRule = (index, newRule) => {
    // Handle duplicate (fractional index)
    if (!Number.isInteger(index)) {
      const realIdx = Math.floor(index);
      const next = [...state.rules];
      next.splice(realIdx + 1, 0, { ...state.rules[realIdx], output_column: state.rules[realIdx].output_column || '' });
      update({ rules: next });
      return;
    }
    const next = [...state.rules];
    next[index] = newRule;
    update({ rules: next });
  };

  const deleteRule = (index) => {
    update({ rules: state.rules.filter((_, i) => i !== index) });
  };

  const moveRule = (index, direction) => {
    const next = [...state.rules];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ rules: next });
  };

  const handleNlToRule = async () => {
    if (!nlInput.trim()) return;
    if (!hasApiKey) return;
    setNlLoading(true);
    setNlError(null);
    try {
      const data = await aiNlToRule(nlInput, allColumns, aiConfig);
      if (data.error) { setNlError(data.error); return; }
      if (data.rule) {
        update({ rules: [...state.rules, { ...data.rule, output_column: data.rule.output_column || '' }] });
        setNlInput('');
      }
    } catch (e) {
      setNlError('Failed to contact AI. Check your API key in settings.');
    } finally {
      setNlLoading(false);
    }
  };

  // Determine divider groups for rendering
  const dividerIndices = new Set(ruleGroups.map(g => g.index));
  const groupColMap = ruleGroups.reduce((m, g) => { m[g.index] = g.col; return m; }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Build Rules</h2>
        <p className="text-sm text-gray-500">Define comparison logic. Rules are evaluated top-to-bottom per output column.</p>
      </div>

      {/* Priority legend */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong>How rules work:</strong> Each rule writes one label to either the shared "Remarks" column or a custom-named column.
          Multiple rules with <em>different</em> column names can all fire on the same row simultaneously.
          Within the same column, the first matching rule wins (priority = top to bottom).
        </div>
      </div>

      {/* No presence rule banner */}
      {!hasPresenceRule && state.rules.length > 0 && (
        <Alert variant="info">
          <Info className="w-4 h-4 shrink-0" />
          No Presence Rule — rows that only exist in one file will use default "Addition"/"Deletion" labels.
          <button
            type="button"
            onClick={() => addRule('PRESENCE_RULE')}
            className="ml-2 text-blue-700 underline hover:no-underline font-medium"
          >
            Add one
          </button>
        </Alert>
      )}

      {/* Rules list */}
      <div className="space-y-2">
        {state.rules.length === 0 ? (
          <EmptyStateExamples onAdd={addRule} />
        ) : (
          state.rules.map((rule, i) => (
            <React.Fragment key={i}>
              {/* Column group divider */}
              {dividerIndices.has(i) && state.rules.length > 1 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded border font-medium shrink-0',
                    groupColMap[i] === 'Remarks'
                      ? 'bg-gray-50 border-gray-200 text-gray-500'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  )}>
                    Column: {groupColMap[i] || 'Remarks'}
                  </span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              )}
              <RuleCard
                rule={rule}
                index={i}
                priorityInCol={rulePriorities[i]}
                allColumns={allColumns}
                onUpdate={updateRule}
                onDelete={deleteRule}
                onMoveUp={() => moveRule(i, -1)}
                onMoveDown={() => moveRule(i, 1)}
                canMoveUp={i > 0}
                canMoveDown={i < state.rules.length - 1}
              />
            </React.Fragment>
          ))
        )}
      </div>

      {/* Add rule buttons */}
      {state.rules.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Add Rule</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(RULE_TYPE_LABELS).map(([type, { label, Icon }]) => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                onClick={() => addRule(type)}
                className="border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* AI natural language input */}
      <div className={cn('p-px rounded-xl', hasApiKey ? 'bg-gradient-to-r from-indigo-200 to-purple-200' : 'bg-gray-200')}>
        <div className={cn('rounded-xl p-4 space-y-3', hasApiKey ? 'bg-white' : 'bg-gray-50')}>
          <div className="flex items-center gap-2">
            {hasApiKey ? (
              <Sparkles className="w-4 h-4 text-indigo-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <p className="text-sm font-semibold text-gray-800">Describe a rule in plain English</p>
            {!hasApiKey && (
              <span className="text-xs text-gray-400 ml-1">(Requires AI API key in settings)</span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1" title={!hasApiKey ? 'Configure an AI API key in settings to use this feature' : ''}>
              <input
                className={cn(
                  'w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400',
                  hasApiKey ? 'border-gray-200' : 'border-gray-200 opacity-50 cursor-not-allowed'
                )}
                placeholder='e.g. "mark as terminated if Last Day of Service is filled"'
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && hasApiKey) handleNlToRule(); }}
                disabled={!hasApiKey}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNlToRule}
              disabled={!nlInput.trim() || !hasApiKey}
              loading={nlLoading}
            >
              {!nlLoading && 'Generate'}
            </Button>
          </div>
          {nlError && (
            <Alert variant="error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {nlError}
            </Alert>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => update({ step: 3 })}>← Back</Button>
        <Button variant="primary" onClick={() => update({ step: 5 })}>
          Configure Output <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
