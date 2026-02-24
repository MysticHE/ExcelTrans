import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight, AlertCircle, X, Settings2, Download } from 'lucide-react';
import { analyzeFiles } from '../services/intelApi';
import { Button, Alert, Badge, cn } from '../ui';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileDropzone({ label, sublabel, file, onFile, onClear, accent }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const accentRing  = accent === 'emerald' ? 'border-emerald-400 bg-emerald-50/60' : 'border-indigo-400 bg-indigo-50/60';
  const accentIcon  = accent === 'emerald' ? 'text-emerald-500' : 'text-indigo-500';
  const accentText  = accent === 'emerald' ? 'text-emerald-700' : 'text-indigo-700';
  const accentBadge = accent === 'emerald' ? 'green' : 'indigo';

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
        {file && (
          <Badge variant={accentBadge}>
            <CheckCircle2 className="w-3 h-3" />
            Ready
          </Badge>
        )}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group',
          isDragActive
            ? `${accentRing} scale-[1.01]`
            : file
              ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400'
              : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/20'
        )}
      >
        <input {...getInputProps()} />

        {file ? (
          /* File loaded state */
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(file.size)} · Click to replace</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            {isDragActive ? (
              <>
                <Upload className={cn('w-8 h-8 animate-bounce', accentIcon)} />
                <p className={cn('text-sm font-semibold', accentText)}>Drop to upload</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <FileSpreadsheet className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Drag & drop or <span className="text-indigo-500">browse</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">.xlsx or .xls · max 50 MB</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── How it works flow ─────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { icon: Upload,        label: 'Upload',    desc: 'Drop your Excel files' },
  { icon: Settings2,     label: 'Configure', desc: 'Map columns & set rules' },
  { icon: Download,      label: 'Download',  desc: 'Get color-coded report' },
];

export default function Step1_Upload({ wizard }) {
  const { state, update } = wizard;
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleAnalyze = async () => {
    if (!state.fileA) { setError('Please upload at least File A (the baseline file).'); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeFiles(state.fileA, state.fileB);
      update({ sessionId: data.session_id, analysis: data, step: 2 });
    } catch (e) {
      setError(e.message || 'Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* Step header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Upload Your Files</h2>
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">File A</span> is your baseline (old version) ·{' '}
          <span className="font-semibold text-gray-700">File B</span> is the updated version to compare against.
        </p>
      </div>

      {/* Dropzones */}
      <div className="grid md:grid-cols-2 gap-5">
        <FileDropzone
          label="File A — Baseline"
          sublabel="The original / old file"
          accent="indigo"
          file={state.fileA}
          onFile={(f) => update({ fileA: f })}
          onClear={() => update({ fileA: null })}
        />
        <FileDropzone
          label="File B — Updated (optional)"
          sublabel="Leave empty to analyze File A alone"
          accent="emerald"
          file={state.fileB}
          onFile={(f) => update({ fileB: f })}
          onClear={() => update({ fileB: null })}
        />
      </div>

      {/* How it works */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">How it works</p>
        <div className="flex items-center gap-3">
          {FLOW_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.label}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={handleAnalyze}
          disabled={!state.fileA}
          loading={loading}
        >
          {!loading && <>Analyze Files <ArrowRight className="w-4 h-4" /></>}
          {loading && 'Analyzing…'}
        </Button>
      </div>
    </div>
  );
}
