import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileOutput, Settings2, Download, Play, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { processComparison, downloadResult } from '../services/intelApi';
import { Button, Toggle, Alert, Input, cn } from '../ui';

function SummaryBadge({ label, value, color }) {
  const styles = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  const icons = {
    green: <span className="text-green-500 font-bold">+</span>,
    red: <span className="text-red-500 font-bold">−</span>,
    yellow: <span className="text-yellow-600 font-bold">~</span>,
    gray: <span className="text-gray-400 font-bold">=</span>,
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

export default function Step5_OutputConfig({ wizard }) {
  const { state, update, buildTemplate } = wizard;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewRows, setPreviewRows] = useState(null);

  const oc = state.outputConfig;
  const updateOC = (partial) => update({ outputConfig: { ...oc, ...partial } });

  const handleDryRun = async () => {
    setRunning(true);
    setError(null);
    const template = buildTemplate();
    try {
      const data = await processComparison(state.sessionId, template, true);
      if (data.error) { setError(data.error); return; }
      setPreviewRows(data.preview);
    } catch (e) {
      setError('Processing failed. Check that the server is running.');
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Output Configuration</h2>
        <p className="text-sm text-gray-500">Configure what to include in the comparison report.</p>
      </div>

      {/* Template / report name */}
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

      {/* Output filename */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
          <Settings2 className="w-4 h-4 text-gray-400" />
          Output Filename Template
        </label>
        <Input
          value={oc.output_filename_template || 'comparison_{date}'}
          onChange={(e) => updateOC({ output_filename_template: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">Use {'{date}'} for today's date</p>
      </div>

      {/* Toggles */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 overflow-hidden">
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

      {/* Preview table */}
      {previewRows && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (first 20 rows)</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50">
                  {previewRows.length > 0 &&
                    Object.keys(previewRows[0])
                      .filter(k => !['source', 'color', 'changed_fields'].includes(k))
                      .map(k => (
                        <th key={k} className="px-2 py-2 text-left text-gray-600 font-medium border-b border-gray-200">
                          {k}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ backgroundColor: row.color || 'transparent' }}>
                    {Object.entries(row)
                      .filter(([k]) => !['source', 'color', 'changed_fields'].includes(k))
                      .map(([k, v]) => (
                        <td key={k} className="px-2 py-1.5 border-b border-gray-100 text-gray-700">
                          {String(v ?? '')}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result card with animated reveal */}
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
              <SummaryBadge label="Total" value={result.summary?.total || 0} color="gray" />
              <SummaryBadge label="Additions" value={result.summary?.additions || 0} color="green" />
              <SummaryBadge label="Deletions" value={result.summary?.deletions || 0} color="red" />
              <SummaryBadge label="Changes" value={result.summary?.changes || 0} color="yellow" />
              <SummaryBadge label="Unchanged" value={result.summary?.unchanged || 0} color="gray" />
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
            {running ? 'Running...' : 'Preview (20 rows)'}
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
