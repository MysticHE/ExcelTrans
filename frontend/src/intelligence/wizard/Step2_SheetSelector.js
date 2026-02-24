import React, { useEffect, useState } from 'react';
import { FileText, FileCheck, Sigma, Hash, ArrowRight } from 'lucide-react';
import { getTemplate } from '../services/intelApi';
import AISuggestionBanner from '../ai/AISuggestionBanner';
import { Card, Badge, Button, cn } from '../ui';

function SheetCard({ sheet, selected, onSelect }) {
  const formulaCols = sheet.formula_summary?.formula_columns || [];
  const formulaCount = sheet.formula_summary?.total_formula_cells || 0;

  return (
    <Card
      hover
      selected={selected}
      onClick={() => onSelect(sheet.name)}
      className={cn(
        'p-4 cursor-pointer',
        selected ? 'border-l-4 border-l-indigo-500' : ''
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm">{sheet.name}</h4>
        {selected && <Badge variant="indigo">Selected</Badge>}
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        <Badge variant="gray">
          <Hash className="w-3 h-3" />
          {sheet.row_count} rows
        </Badge>
        <Badge variant="blue">
          {sheet.columns?.length || 0} cols
        </Badge>
        {formulaCount > 0 && (
          <Badge variant="orange">
            <Sigma className="w-3 h-3" />
            {formulaCount} formulas
          </Badge>
        )}
      </div>

      {formulaCols.length > 0 && (
        <p className="mt-2 text-xs text-orange-600 truncate">
          {formulaCols.slice(0, 3).join(', ')}
          {formulaCols.length > 3 ? ` +${formulaCols.length - 3} more` : ''}
        </p>
      )}
    </Card>
  );
}

const TYPE_BADGE_VARIANT = {
  formula: 'orange',
  date: 'purple',
  numeric: 'blue',
  text: 'gray',
};

export default function Step2_SheetSelector({ wizard, aiConfig }) {
  const { state, update } = wizard;
  const analysis = state.analysis || {};
  const sheetsA = analysis.file_a?.sheets || [];
  const sheetsB = analysis.file_b?.sheets || [];
  const hasBothFiles = sheetsB.length > 0;

  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    const firstSheet = sheetsA[0];
    if (!firstSheet) return;
    const suggestedSlug = firstSheet.suggested_template;
    if (suggestedSlug) {
      setSuggestion({ slug: suggestedSlug, sheet: firstSheet.name });
    }
  }, [sheetsA]);

  useEffect(() => {
    if (sheetsA.length > 0 && !state.selectedSheets.file_a) {
      update({ selectedSheets: { file_a: sheetsA[0].name, file_b: sheetsB[0]?.name || sheetsA[0].name } });
    }
  }, [sheetsA, sheetsB]);

  const handleApplyTemplate = async (slug) => {
    try {
      const tmpl = await getTemplate(slug);
      if (tmpl.error) return;
      update({
        templateName: tmpl.template_name,
        appliedTemplate: slug,
        columnMapping: tmpl.column_mapping,
        rules: tmpl.rules,
        outputConfig: tmpl.output_config,
        selectedSheets: {
          file_a: tmpl.sheet_config?.file_a_sheet || state.selectedSheets.file_a,
          file_b: tmpl.sheet_config?.file_b_sheet || state.selectedSheets.file_b,
        },
        step: 4,
      });
    } catch (e) {
      console.error('Failed to load template', e);
    }
  };

  const selectedSheetA = sheetsA.find(s => s.name === state.selectedSheets.file_a);
  const canContinue = state.selectedSheets.file_a;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Select Sheets</h2>
        <p className="text-sm text-gray-500">Choose which sheet to compare from each file.</p>
      </div>

      {suggestion && (
        <AISuggestionBanner
          slug={suggestion.slug}
          onApply={() => handleApplyTemplate(suggestion.slug)}
          onDismiss={() => setSuggestion(null)}
        />
      )}

      <div className={`grid gap-6 ${hasBothFiles ? 'md:grid-cols-2' : ''}`}>
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            File A — {state.fileA?.name || 'Old File'}
          </h3>
          <div className="space-y-2">
            {sheetsA.map(sheet => (
              <SheetCard
                key={sheet.name}
                sheet={sheet}
                selected={state.selectedSheets.file_a === sheet.name}
                onSelect={(name) => update({ selectedSheets: { ...state.selectedSheets, file_a: name } })}
              />
            ))}
          </div>
        </div>

        {hasBothFiles && (
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
              <FileCheck className="w-3.5 h-3.5" />
              File B — {state.fileB?.name || 'New File'}
            </h3>
            <div className="space-y-2">
              {sheetsB.map(sheet => (
                <SheetCard
                  key={sheet.name}
                  sheet={sheet}
                  selected={state.selectedSheets.file_b === sheet.name}
                  onSelect={(name) => update({ selectedSheets: { ...state.selectedSheets, file_b: name } })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Column preview */}
      {selectedSheetA && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">
            Detected Columns in "{selectedSheetA.name}"
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {selectedSheetA.columns?.slice(0, 20).map(col => (
              <Badge
                key={col.index}
                variant={TYPE_BADGE_VARIANT[col.detected_type] || 'gray'}
              >
                {col.name}
                <span className="opacity-60">({col.detected_type})</span>
              </Badge>
            ))}
            {selectedSheetA.columns?.length > 20 && (
              <span className="text-xs text-gray-400 self-center">+{selectedSheetA.columns.length - 20} more</span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => update({ step: 1 })}>← Back</Button>
        <Button
          variant="primary"
          onClick={() => update({ step: 3 })}
          disabled={!canContinue}
        >
          Configure Columns <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
