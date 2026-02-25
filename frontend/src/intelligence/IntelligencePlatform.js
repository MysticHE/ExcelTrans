import React, { useState } from 'react';
import { LayoutTemplate, MessageSquare, Settings, RotateCcw, CheckCircle2, AlertCircle, Zap, Trash2 } from 'lucide-react';
import WizardContainer from './wizard/WizardContainer';
import AIChatPanel from './ai/AIChatPanel';
import TemplateGallery from './templates/TemplateGallery';
import { useWizardState } from './hooks/useWizardState';
import { testAIKey } from './services/intelApi';
import { Button, Input, Modal, Alert, Badge, Tooltip, cn } from './ui';

const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
  openai:    { label: 'OpenAI',             models: ['gpt-4o-mini', 'gpt-4o'] },
  gemini:    { label: 'Google Gemini',      models: ['gemini-2.0-flash', 'gemini-2.5-pro-preview-03-25'] },
};

function AISettingsPanel({ aiConfig, onSave, onClose }) {
  const [local, setLocal] = useState({ ...aiConfig });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAIKey(local);
      setTestResult(result.success ? 'success' : result.error || 'Failed');
    } catch (e) {
      setTestResult(e.message || 'Connection failed');
    }
    setTesting(false);
  };

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">AI Provider Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Bring Your Own Key — stored in browser session only</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-white/80"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Provider selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider</label>
            <div className="grid gap-2">
              {Object.entries(PROVIDERS).map(([key, { label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLocal(p => ({ ...p, provider: key, model: PROVIDERS[key].models[0] }))}
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-xl transition-all text-left',
                    local.provider === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="text-sm font-semibold">{label}</span>
                  {local.provider === key && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">API Key</label>
            <Input
              type="password"
              placeholder={
                local.provider === 'anthropic' ? 'sk-ant-...' :
                local.provider === 'openai'    ? 'sk-...'     : 'AIza...'
              }
              value={local.apiKey || ''}
              onChange={(e) => setLocal(p => ({ ...p, apiKey: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Never sent to our servers — used client-side only
            </p>
          </div>

          {/* Model selector */}
          {local.provider && PROVIDERS[local.provider] && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Model</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition-all"
                value={local.model || PROVIDERS[local.provider].models[0]}
                onChange={(e) => setLocal(p => ({ ...p, model: e.target.value }))}
              >
                {PROVIDERS[local.provider].models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Test connection */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleTest} loading={testing} disabled={!local.apiKey}>
                {!testing && <Zap className="w-3.5 h-3.5" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <span className="text-xs text-gray-400">Verify your API key works</span>
            </div>
            {testResult && (
              <Alert variant={testResult === 'success' ? 'success' : 'error'}>
                {testResult === 'success' ? (
                  <><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> Connected successfully</>
                ) : (
                  <><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {testResult}</>
                )}
              </Alert>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            {local.apiKey && (
              <Button
                variant="secondary"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:border-red-300"
                onClick={() => { onSave({ ...local, apiKey: '' }); onClose(); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Key
              </Button>
            )}
            <Button variant="primary" className="flex-1" onClick={() => { onSave(local); onClose(); }}>
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const DEFAULT_AI_CONFIG = {
  provider: sessionStorage.getItem('intel_ai_provider') || 'anthropic',
  apiKey: sessionStorage.getItem('intel_ai_key') || '',
  model: sessionStorage.getItem('intel_ai_model') || 'claude-haiku-4-5-20251001',
};

export default function IntelligencePlatform() {
  const wizard = useWizardState();
  const [aiConfig, setAIConfig] = useState(DEFAULT_AI_CONFIG);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSaveAIConfig = (config) => {
    setAIConfig(config);
    if (config.apiKey) {
      sessionStorage.setItem('intel_ai_key', config.apiKey);
      sessionStorage.setItem('intel_ai_provider', config.provider);
      sessionStorage.setItem('intel_ai_model', config.model);
    } else {
      sessionStorage.removeItem('intel_ai_key');
      sessionStorage.removeItem('intel_ai_provider');
      sessionStorage.removeItem('intel_ai_model');
    }
  };

  const handleApplyTemplate = (tmpl) => {
    wizard.update({
      templateName: tmpl.template_name,
      appliedTemplate: tmpl.slug,
      columnMapping: tmpl.column_mapping,
      rules: tmpl.rules,
      outputConfig: tmpl.output_config,
      selectedSheets: {
        file_a: tmpl.sheet_config?.file_a_sheet,
        file_b: tmpl.sheet_config?.file_b_sheet || tmpl.sheet_config?.file_a_sheet,
      },
      step: wizard.state.sessionId ? 4 : 1,
    });
    setShowTemplates(false);
  };

  const wizardContext = {
    step: wizard.state.step,
    selectedSheets: wizard.state.selectedSheets,
    columnMapping: wizard.state.columnMapping,
    rules: wizard.state.rules,
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* Brand mark */}
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent tracking-tight">
              Excel Intelligence
            </h1>
          </div>
          <p className="text-sm text-gray-500 pl-10.5">
            Universal Excel comparison wizard with{' '}
            <span className="text-indigo-500 font-semibold">AI assistance</span>
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Tooltip content="Browse built-in templates">
            <Button variant="secondary" size="sm" onClick={() => setShowTemplates(true)}>
              <LayoutTemplate className="w-3.5 h-3.5" />
              Templates
            </Button>
          </Tooltip>
          <Tooltip content={showChat ? 'Close AI chat' : 'Open AI chat assistant'}>
            <Button
              variant={showChat ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              AI Chat
            </Button>
          </Tooltip>
          <Tooltip content="Configure AI provider & key">
            <button
              onClick={() => setShowAISettings(true)}
              className="p-2 text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Start over">
            <button
              onClick={wizard.reset}
              className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* AI status pill */}
      {aiConfig.apiKey ? (
        <div className="flex items-center gap-2 mb-5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700">AI active</span>
          <span className="text-emerald-300">·</span>
          <Badge variant="indigo" className="text-xs">{aiConfig.provider} / {aiConfig.model}</Badge>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full w-fit">
          <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
          <span className="text-xs text-gray-400">AI not configured —</span>
          <button
            onClick={() => setShowAISettings(true)}
            className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition-colors"
          >
            Add API key
          </button>
        </div>
      )}

      {/* Main wizard */}
      <div className={`transition-all duration-300 ${showChat ? 'pr-84' : ''}`}>
        <WizardContainer wizard={wizard} aiConfig={aiConfig} />
      </div>

      {/* Modals */}
      {showAISettings && (
        <AISettingsPanel aiConfig={aiConfig} onSave={handleSaveAIConfig} onClose={() => setShowAISettings(false)} />
      )}
      {showTemplates && (
        <TemplateGallery onApply={handleApplyTemplate} onClose={() => setShowTemplates(false)} />
      )}
      <AIChatPanel
        open={showChat}
        onClose={() => setShowChat(false)}
        context={wizardContext}
        aiConfig={aiConfig}
      />
    </div>
  );
}
