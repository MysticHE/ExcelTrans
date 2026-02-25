import { useState, useCallback } from 'react';

const STORAGE_KEY = 'intel_wizard_state';

const INITIAL_STATE = {
  step: 1,
  maxStep: 1,
  sessionId: null,
  fileA: null,
  fileB: null,
  analysis: null,
  selectedSheets: { file_a: null, file_b: null },
  columnMapping: { unique_key: [], compare_fields: [], display_fields: [], ignored_fields: [], formula_fields: {} },
  rules: [],
  outputConfig: {
    add_remarks_column: true,
    include_summary_sheet: true,
    highlight_changed_cells: true,
    include_unmatched_rows: true,
    output_filename_template: 'comparison_{date}',
    output_sheet_name: 'Comparison',
    included_columns: null,
    column_order: null,
  },
  templateName: 'Custom Comparison',
  appliedTemplate: null,
  result: null,
};

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export function useWizardState() {
  const [state, setState] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const parsed = saved ? safeParse(saved) : null;
    // Don't restore file objects (not serializable), just wizard config
    if (parsed) {
      return { ...INITIAL_STATE, ...parsed, fileA: null, fileB: null };
    }
    return INITIAL_STATE;
  });

  const update = useCallback((partial) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      // Persist to sessionStorage (skip File objects)
      const { fileA, fileB, ...persistable } = next;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_STATE);
  }, []);

  const goToStep = useCallback((step) => {
    update({ step, maxStep: Math.max(state.maxStep || 1, step) });
  }, [update, state.maxStep]);

  const buildTemplate = useCallback(() => {
    const { templateName, selectedSheets, columnMapping, rules, outputConfig, analysis } = state;
    const sheetA = selectedSheets.file_a || 'Sheet1';
    const sheetB = selectedSheets.file_b || sheetA;
    // Use the header row detected during analysis — NOT hardcoded 0
    const sheetInfoA = analysis?.file_a?.sheets?.find(s => s.name === sheetA);
    const headerRow = sheetInfoA?.header_row ?? 0;
    return {
      template_name: templateName,
      sheet_config: {
        file_a_sheet: sheetA,
        file_b_sheet: sheetB,
        header_row: headerRow,
      },
      column_mapping: columnMapping,
      rules,
      output_config: outputConfig,
    };
  }, [state]);

  return { state, update, reset, goToStep, buildTemplate };
}
