import React, { useState } from 'react';
import { LayoutTemplate, MessageSquare, Settings, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import WizardContainer from './wizard/WizardContainer';
import AIChatPanel from './ai/AIChatPanel';
import TemplateGallery from './templates/TemplateGallery';
import { useWizardState } from './hooks/useWizardState';
import { testAIKey } from './services/intelApi';
import { Button, Input, Modal, Alert, Badge, cn } from './ui';

const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
  openai: { label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  gemini: { label: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.5-pro-preview-03-25'] },
};

function AISettingsPanel({ aiConfig, onSave, onClose }) {
  const [local, setLocal] = useState({ ...aiConfig });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testAIKey(local);
    setTestResult(result.success ? 'success' : result.error || 'Failed');
    setTesting(false);
  };

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">AI Provider Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure your BYOK API key</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
            <div className="grid gap-2">
              {Object.entries(PROVIDERS).map(([key, { label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLocal(p => ({ ...p, provider: key, model: PROVIDERS[key].models[0] }))}
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-xl transition-all text-left',
                    local.provider === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="text-sm font-medium">{label}</span>
                  {local.provider === key && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key (BYOK)</label>
            <Input
              type="password"
              placeholder={
                local.provider === 'anthropic' ? 'sk-ant-...' :
                local.provider === 'openai' ? 'sk-...' : 'AIza...'
              }
              value={local.apiKey || ''}
              onChange={(e) => setLocal(p => ({ ...p, apiKey: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Stored in browser session only. Never sent to our servers.</p>
          </div>

          {/* Model selector */}
          {local.provider && PROVIDERS[local.provider] && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTest}
                loading={testing}
                disabled={!local.apiKey}
              >
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
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => { onSave(local); onClose(); }}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const DEFAULT_AI_CONFIG = {
  provider: 'anthropic',
  apiKey: sessionStorage.getItem('intel_ai_key') || '',
  model: 'claude-haiku-4-5-20251001',
};

export default function IntelligencePlatform() {
  const wizard = useWizardState();
  const [aiConfig, setAIConfig] = useState(DEFAULT_AI_CONFIG);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSaveAIConfig = (config) => {
    setAIConfig(config);
    if (config.apiKey) sessionStorage.setItem('intel_ai_key', config.apiKey);
    else sessionStorage.removeItem('intel_ai_key');
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
      {/* Header toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
            Excel Intelligence
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Universal Excel comparison wizard with{' '}
            <span className="text-indigo-500 font-medium">AI assistance</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTemplates(true)}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Templates
          </Button>
          <Button
            variant={showChat ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </Button>
          <button
            onClick={() => setShowAISettings(true)}
            className="p-2 text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={wizard.reset}
            className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            title="Start over"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI status indicator */}
      {aiConfig.apiKey && (
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-gray-500">AI enabled</span>
          <Badge variant="indigo">{aiConfig.provider} / {aiConfig.model}</Badge>
        </div>
      )}

      {/* Main wizard */}
      <div className={`transition-all duration-300 ${showChat ? 'pr-84' : ''}`}>
        <WizardContainer wizard={wizard} aiConfig={aiConfig} />
      </div>

      {/* Modals */}
      {showAISettings && (
        <AISettingsPanel
          aiConfig={aiConfig}
          onSave={handleSaveAIConfig}
          onClose={() => setShowAISettings(false)}
        />
      )}
      {showTemplates && (
        <TemplateGallery
          onApply={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
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
