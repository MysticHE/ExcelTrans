import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { analyzeFiles } from '../services/intelApi';
import { Button, Alert, cn } from '../ui';

function FileDropzone({ label, file, onFile, description }) {
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

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
        isDragActive
          ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
          : file
            ? 'border-emerald-400 bg-emerald-50/50'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        {file ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="font-medium text-emerald-700 text-sm">{file.name}</p>
            <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB — Click to replace</p>
          </>
        ) : (
          <>
            {isDragActive ? (
              <Upload className="w-8 h-8 text-indigo-500 animate-bounce" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-gray-400" />
            )}
            <p className="font-medium text-gray-700 text-sm">{label}</p>
            <p className="text-sm text-gray-500">{description}</p>
            <p className="text-xs text-gray-400">Drag & drop or click to browse (.xlsx, .xls)</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Step1_Upload({ wizard }) {
  const { state, update } = wizard;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!state.fileA) { setError('Please upload at least File A (old file).'); return; }
    setLoading(true);
    setError(null);

    try {
      const data = await analyzeFiles(state.fileA, state.fileB);
      if (data.error) { setError(data.error); return; }

      update({
        sessionId: data.session_id,
        analysis: data,
        step: 2,
      });
    } catch (e) {
      setError('Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Upload Your Files</h2>
        <p className="text-sm text-gray-500">
          Upload the old and new Excel files to compare.{' '}
          <span className="font-medium text-gray-700">File A</span> is your baseline (old),{' '}
          <span className="font-medium text-gray-700">File B</span> is the updated version.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FileDropzone
          label="File A — Old / Baseline"
          description="The original file to compare from"
          file={state.fileA}
          onFile={(f) => update({ fileA: f })}
        />
        <FileDropzone
          label="File B — New / Updated (optional)"
          description="Leave empty to analyze File A alone"
          file={state.fileB}
          onFile={(f) => update({ fileB: f })}
        />
      </div>

      {/* How it works hint */}
      <div className="flex items-center justify-center gap-3 text-xs text-gray-400 py-1">
        <div className="flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </div>
        <span className="text-gray-300">→</span>
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Configure</span>
        </div>
        <span className="text-gray-300">→</span>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Download</span>
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
          {loading && 'Analyzing...'}
        </Button>
      </div>
    </div>
  );
}
