import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText, FileCheck, Sigma, Hash, ArrowRight, Search,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Sparkles, X, Layers
} from 'lucide-react';
import { getTemplate } from '../services/intelApi';
import { Card, Badge, Button, Alert, ProgressBar, EmptyState, cn } from '../ui';

const TYPE_BADGE_VARIANT = {
  formula: 'orange',
  date:    'purple',
  numeric: 'blue',
  text:    'gray',
};

const TYPE_GROUP_COLORS = {
  formula: 'text-orange-700 bg-orange-50 border-orange-200',
  date:    'text-purple-700 bg-purple-50 border-purple-200',
  numeric: 'text-blue-700 bg-blue-50 border-blue-200',
  text:    'text-gray-700 bg-gray-50 border-gray-200',
};

const TEMPLATE_LABELS = {
  mediacorp_el:       'Mediacorp Employee ADC',
  gp_panel:           'GP Panel Comparison',
  renewal_comparison: 'Renewal Comparison',
  clinic_matcher:     'Clinic Matcher',
};

function getSheetQuality(sheet) {
  if (!sheet.row_count || sheet.row_count === 0) return { label: 'No rows', variant: 'red' };
  const formulaPct = sheet.formula_summary?.total_formula_cells
    ? sheet.formula_summary.total_formula_cells / Math.max(1, sheet.row_count * (sheet.columns?.length || 1))
    : 0;
  if (formulaPct > 0.5) return { label: 'Formula-heavy', variant: 'orange' };
  return { label: 'Ready', variant: 'green' };
}

function SheetCard({ sheet, selected, onSelect, maxRows }) {
  const formulaCols  = sheet.formula_summary?.formula_columns || [];
  const formulaCount = sheet.formula_summary?.total_formula_cells || 0;
  const isEmpty      = !sheet.row_count || sheet.row_count === 0;
  const quality      = getSheetQuality(sheet);
  const rowPct       = maxRows > 0 ? Math.round((sheet.row_count / maxRows) * 100) : 0;

  return (
    <Card
      hover={!isEmpty}
      selected={selected}
      onClick={() => !isEmpty && onSelect(sheet.name)}
      className={cn(
        'p-4',
        isEmpty ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        selected ? 'border-l-4 border-l-indigo-500' : ''
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 text-sm truncate mr-2">{sheet.name}</h4>
        <div className="flex gap-1.5 shrink-0">
          <Badge variant={quality.variant}>{quality.label}</Badge>
          {selected && <Badge variant="indigo">Selected</Badge>}
        </div>
      </div>

      {/* Row count with visual bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {sheet.row_count?.toLocaleString() || 0} rows
          </span>
          <span className="text-xs text-gray-300">{sheet.columns?.length || 0} cols</span>
        </div>
        <ProgressBar value={sheet.row_count || 0} max={maxRows || 1} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {formulaCount > 0 && (
          <Badge variant="orange">
            <Sigma className="w-3 h-3" />
            {formulaCount} formulas
          </Badge>
        )}
        {formulaCols.slice(0, 2).map(col => (
          <Badge key={col} variant="gray" className="max-w-[120px] truncate">{col}</Badge>
        ))}
        {formulaCols.length > 2 && (
          <Badge variant="gray">+{formulaCols.length - 2} more</Badge>
        )}
      </div>
    </Card>
  );
}

function ColumnPreviewPanel({ sheet }) {
  const [colSearch, setColSearch] = useState('');
  const columns = sheet?.columns || [];

  const grouped = useMemo(() => {
    const filtered = colSearch
      ? columns.filter(c => c.name?.toLowerCase().includes(colSearch.toLowerCase()))
      : columns;
    return filtered.reduce((acc, col) => {
      const type = col.detected_type || 'text';
      if (!acc[type]) acc[type] = [];
      acc[type].push(col);
      return acc;
    }, {});
  }, [columns, colSearch]);

  const total = columns.length;
  const shown = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Columns in "{sheet.name}"
        </h4>
        <span className="text-xs text-gray-400">
          {colSearch ? `${shown} / ${total}` : `${total} columns`}
        </span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition-all"
          placeholder="Filter columns…"
          value={colSearch}
          onChange={e => setColSearch(e.target.value)}
        />
      </div>

      <div className="max-h-52 overflow-y-auto space-y-3 pr-1">
        {Object.entries(grouped).map(([type, cols]) => (
          <div key={type}>
            <p className={cn('text-xs font-semibold px-2 py-0.5 rounded border inline-block mb-1.5', TYPE_GROUP_COLORS[type] || TYPE_GROUP_COLORS.text)}>
              {type} ({cols.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cols.map(col => (
                <Badge key={col.index} variant={TYPE_BADGE_VARIANT[col.detected_type] || 'gray'}>
                  {col.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {shown === 0 && (
          <p className="text-xs text-gray-400 italic py-2">No columns match filter.</p>
        )}
      </div>
    </div>
  );
}

function MismatchPanel({ sheetsA, sheetsB, selectedA, selectedB }) {
  const [open, setOpen] = useState(false);

  const sheetA = sheetsA.find(s => s.name === selectedA);
  const sheetB = sheetsB.find(s => s.name === selectedB);
  if (!sheetA || !sheetB) return null;

  const colsA  = new Set((sheetA.columns || []).map(c => c.name));
  const colsB  = new Set((sheetB.columns || []).map(c => c.name));
  const onlyInB = [...colsB].filter(n => !colsA.has(n));
  const onlyInA = [...colsA].filter(n => !colsB.has(n));

  if (onlyInA.length === 0 && onlyInB.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        All columns match between selected sheets.
      </div>
    );
  }

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Column mismatch between selected sheets</span>
        <Badge variant="yellow" className="ml-1">{onlyInA.length + onlyInB.length} diff</Badge>
        {open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <div className="p-4 bg-white grid grid-cols-2 gap-4 border-t border-amber-100">
          {onlyInA.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 mb-2">Only in File A ({onlyInA.length})</p>
              <div className="flex flex-wrap gap-1">
                {onlyInA.map(n => <Badge key={n} variant="red">{n}</Badge>)}
              </div>
            </div>
          )}
          {onlyInB.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 mb-2">Only in File B ({onlyInB.length})</p>
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

export default function Step2_SheetSelector({ wizard, aiConfig }) {
  const { state, update } = wizard;
  const analysis  = state.analysis || {};
  const sheetsA   = analysis.file_a?.sheets || [];
  const sheetsB   = analysis.file_b?.sheets || [];
  const hasBothFiles = sheetsB.length > 0;

  const [suggestion,      setSuggestion]      = useState(null);
  const [sheetSearchA,    setSheetSearchA]    = useState('');
  const [sheetSearchB,    setSheetSearchB]    = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);

  const maxRowsA = useMemo(() => Math.max(...sheetsA.map(s => s.row_count || 0), 1), [sheetsA]);
  const maxRowsB = useMemo(() => Math.max(...sheetsB.map(s => s.row_count || 0), 1), [sheetsB]);

  useEffect(() => {
    const firstSheet = sheetsA[0];
    if (!firstSheet) return;
    if (firstSheet.suggested_template) {
      setSuggestion({ slug: firstSheet.suggested_template, sheet: firstSheet.name });
    }
  }, [sheetsA]);

  useEffect(() => {
    if (sheetsA.length > 0 && !state.selectedSheets.file_a) {
      update({ selectedSheets: { file_a: sheetsA[0].name, file_b: sheetsB[0]?.name || sheetsA[0].name } });
    }
  }, [sheetsA, sheetsB]);

  const applyTemplate = async (slug, targetStep) => {
    setTemplateLoading(true);
    try {
      const tmpl = await getTemplate(slug);
      if (tmpl.error) return;
      update({
        templateName:    tmpl.template_name,
        appliedTemplate: slug,
        columnMapping:   tmpl.column_mapping,
        rules:           tmpl.rules,
        outputConfig:    { ...state.outputConfig, ...tmpl.output_config },
        selectedSheets: {
          file_a: tmpl.sheet_config?.file_a_sheet || state.selectedSheets.file_a,
          file_b: tmpl.sheet_config?.file_b_sheet || state.selectedSheets.file_b,
        },
        step: targetStep,
      });
    } catch (e) {
      // template load failed silently — user continues manually
    } finally {
      setTemplateLoading(false);
      setSuggestion(null);
    }
  };

  const filteredSheetsA = sheetSearchA
    ? sheetsA.filter(s => s.name.toLowerCase().includes(sheetSearchA.toLowerCase()))
    : sheetsA;
  const filteredSheetsB = sheetSearchB
    ? sheetsB.filter(s => s.name.toLowerCase().includes(sheetSearchB.toLowerCase()))
    : sheetsB;

  const selectedSheetA = sheetsA.find(s => s.name === state.selectedSheets.file_a);
  const canContinue    = !!state.selectedSheets.file_a;
  const showSearchA    = sheetsA.length > 4;
  const showSearchB    = sheetsB.length > 4;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Select Sheets</h2>
        <p className="text-sm text-gray-500">Choose which sheet to compare from each file.</p>
      </div>

      {/* Template suggestion banner */}
      {suggestion && (
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Template Detected</p>
              <p className="text-xs text-indigo-600">
                Looks like a <span className="font-bold">{TEMPLATE_LABELS[suggestion.slug] || suggestion.slug}</span> file
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-4 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => applyTemplate(suggestion.slug, 3)} disabled={templateLoading}>
              Apply & Review
            </Button>
            <Button variant="primary" size="sm" onClick={() => applyTemplate(suggestion.slug, 4)} disabled={templateLoading} loading={templateLoading}>
              {!templateLoading && 'Apply & Run'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Sheet pickers */}
      <div className={`grid gap-6 ${hasBothFiles ? 'md:grid-cols-2' : ''}`}>
        {/* File A */}
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            File A — {state.fileA?.name || 'Old File'}
          </h3>
          {showSearchA && (
            <div className="relative mb-2.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/60 transition-all"
                placeholder={`Search ${sheetsA.length} sheets…`}
                value={sheetSearchA}
                onChange={e => setSheetSearchA(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredSheetsA.length > 0 ? filteredSheetsA.map(sheet => (
              <SheetCard
                key={sheet.name}
                sheet={sheet}
                maxRows={maxRowsA}
                selected={state.selectedSheets.file_a === sheet.name}
                onSelect={(name) => update({ selectedSheets: { ...state.selectedSheets, file_a: name } })}
              />
            )) : (
              <EmptyState
                icon={Layers}
                title="No sheets found"
                description="Try a different search term"
              />
            )}
          </div>
        </div>

        {/* File B */}
        {hasBothFiles && (
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              File B — {state.fileB?.name || 'New File'}
            </h3>
            {showSearchB && (
              <div className="relative mb-2.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/60 transition-all"
                  placeholder={`Search ${sheetsB.length} sheets…`}
                  value={sheetSearchB}
                  onChange={e => setSheetSearchB(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredSheetsB.length > 0 ? filteredSheetsB.map(sheet => (
                <SheetCard
                  key={sheet.name}
                  sheet={sheet}
                  maxRows={maxRowsB}
                  selected={state.selectedSheets.file_b === sheet.name}
                  onSelect={(name) => update({ selectedSheets: { ...state.selectedSheets, file_b: name } })}
                />
              )) : (
                <EmptyState
                  icon={Layers}
                  title="No sheets found"
                  description="Try a different search term"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mismatch panel */}
      {hasBothFiles && state.selectedSheets.file_a && state.selectedSheets.file_b && (
        <MismatchPanel
          sheetsA={sheetsA}
          sheetsB={sheetsB}
          selectedA={state.selectedSheets.file_a}
          selectedB={state.selectedSheets.file_b}
        />
      )}

      {/* Column preview */}
      {selectedSheetA && <ColumnPreviewPanel sheet={selectedSheetA} />}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => update({ step: 1 })}>← Back</Button>
        <Button variant="primary" onClick={() => update({ step: 3 })} disabled={!canContinue}>
          Configure Columns <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
