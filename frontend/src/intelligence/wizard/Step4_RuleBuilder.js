import React, { useState } from 'react';
import { Users, Pencil, GitBranch, Link2, Plus, Trash2, Sparkles, GitMerge, AlertCircle, ArrowRight } from 'lucide-react';
import { aiNlToRule } from '../services/intelApi';
import { Button, Alert, cn } from '../ui';

const RULE_COLORS = ['#C6EFCE', '#FFC7CE', '#FFEB9C', '#FCE4D6', '#DDEBF7', '#E2EFDA'];

const RULE_TYPE_LABELS = {
  PRESENCE_RULE: { label: 'Presence Rule', Icon: Users, desc: 'Handle rows that only exist in one file', borderColor: 'border-l-emerald-400' },
  CHANGE_RULE: { label: 'Change Rule', Icon: Pencil, desc: 'Detect changed field values', borderColor: 'border-l-yellow-400' },
  CONDITION_RULE: { label: 'Condition Rule', Icon: GitBranch, desc: 'IF conditions → outcome label', borderColor: 'border-l-red-400' },
  ROW_MATCH: { label: 'Row Match', Icon: Link2, desc: 'How to match rows between files', borderColor: 'border-l-blue-400' },
};

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

function RuleCard({ rule, index, allColumns, onUpdate, onDelete }) {
  const rt = rule.rule_type;
  const typeInfo = RULE_TYPE_LABELS[rt] || { label: rt, Icon: GitMerge, desc: '', borderColor: 'border-l-gray-400' };
  const { Icon, label, desc, borderColor } = typeInfo;
  const cfg = rule.config || {};

  const updateConfig = (partial) => onUpdate(index, { ...rule, config: { ...cfg, ...partial } });

  return (
    <div className={cn('border border-gray-200 rounded-xl p-4 bg-white shadow-sm border-l-4', borderColor)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <div>
            <p className="font-medium text-gray-800 text-sm">{label}</p>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {rt === 'PRESENCE_RULE' && (
        <div className="grid grid-cols-2 gap-3">
          {[['only_in_file_b', 'Only in New File'], ['only_in_file_a', 'Only in Old File']].map(([key, lbl]) => (
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
                      cfg.condition_join === j
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  className="text-gray-400 hover:text-red-500 transition-colors"
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
                placeholder="e.g. Deletion wef {Last Day of Service}"
                value={cfg.outcome_label || ''}
                onChange={(e) => updateConfig({ outcome_label: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-0.5">Use {'{FieldName}'} to include field values</p>
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
                    cfg.method === m
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={cfg.fuzzy_threshold || 0.8}
                onChange={(e) => updateConfig({ fuzzy_threshold: parseFloat(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Step4_RuleBuilder({ wizard, aiConfig }) {
  const { state, update } = wizard;
  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState(null);

  const allColumns = [
    ...(state.columnMapping.unique_key || []),
    ...(state.columnMapping.compare_fields || []),
    ...(state.columnMapping.display_fields || []),
  ];

  const addRule = (ruleType) => {
    const defaults = {
      PRESENCE_RULE: { only_in_file_b: { outcome_label: 'Addition', color: '#C6EFCE' }, only_in_file_a: { outcome_label: 'Deletion', color: '#FFC7CE' } },
      CHANGE_RULE: { fields: [], outcome_label: 'Changed', color: '#FFEB9C' },
      CONDITION_RULE: { conditions: [], condition_join: 'AND', outcome_label: 'Flagged', color: '#FFC7CE' },
      ROW_MATCH: { method: 'exact', fuzzy_threshold: 0.8 },
    };
    update({ rules: [...state.rules, { rule_type: ruleType, config: defaults[ruleType] || {} }] });
  };

  const updateRule = (index, newRule) => {
    const next = [...state.rules];
    next[index] = newRule;
    update({ rules: next });
  };

  const deleteRule = (index) => {
    update({ rules: state.rules.filter((_, i) => i !== index) });
  };

  const handleNlToRule = async () => {
    if (!nlInput.trim()) return;
    setNlLoading(true);
    setNlError(null);
    try {
      const data = await aiNlToRule(nlInput, allColumns, aiConfig);
      if (data.error) { setNlError(data.error); return; }
      if (data.rule) {
        update({ rules: [...state.rules, data.rule] });
        setNlInput('');
      }
    } catch (e) {
      setNlError('Failed to contact AI. Check your API key in settings.');
    } finally {
      setNlLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Build Rules</h2>
        <p className="text-sm text-gray-500">Define comparison logic. Rules are evaluated in order.</p>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {state.rules.map((rule, i) => (
          <RuleCard key={i} rule={rule} index={i} allColumns={allColumns} onUpdate={updateRule} onDelete={deleteRule} />
        ))}
        {state.rules.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <GitMerge className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No rules yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add a rule below or describe one in plain English.</p>
          </div>
        )}
      </div>

      {/* Add rule buttons */}
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

      {/* AI natural language input */}
      <div className="p-px rounded-xl bg-gradient-to-r from-indigo-200 to-purple-200">
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-gray-800">Describe a rule in plain English</p>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder='e.g. "mark as terminated if Last Day of Service is filled and Category is empty"'
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleNlToRule(); }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleNlToRule}
              disabled={!nlInput.trim()}
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
          <p className="text-xs text-gray-400">Requires AI API key configured in settings</p>
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
