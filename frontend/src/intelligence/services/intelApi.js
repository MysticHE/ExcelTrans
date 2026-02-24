const BASE = (() => {
  const url = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
})();

function getAIHeaders(aiConfig) {
  if (!aiConfig) return {};
  return {
    'X-AI-Provider': aiConfig.provider || 'anthropic',
    'X-AI-Key': aiConfig.apiKey || '',
    'X-AI-Model': aiConfig.model || '',
  };
}

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server error (${res.status}): unexpected response format`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function analyzeFiles(fileA, fileB) {
  const form = new FormData();
  form.append('file_a', fileA);
  if (fileB) form.append('file_b', fileB);

  const res = await fetch(`${BASE}/api/intel/analyze`, { method: 'POST', body: form });
  return parseResponse(res);
}

export async function processComparison(sessionId, template, dryRun = false) {
  const res = await fetch(`${BASE}/api/intel/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, template, dry_run: dryRun }),
  });
  return parseResponse(res);
}

export async function downloadResult(sessionId, resultId, filename) {
  const res = await fetch(`${BASE}/api/intel/download/${sessionId}/${resultId}`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'comparison.xlsx';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function listTemplates() {
  const res = await fetch(`${BASE}/api/intel/templates`);
  return parseResponse(res);
}

export async function getTemplate(slug) {
  const res = await fetch(`${BASE}/api/intel/templates/${slug}`);
  return parseResponse(res);
}

export async function saveTemplate(template) {
  const res = await fetch(`${BASE}/api/intel/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  return parseResponse(res);
}

export async function aiSuggestTemplate(columns, sheetName, aiConfig) {
  const res = await fetch(`${BASE}/api/intel/ai/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAIHeaders(aiConfig) },
    body: JSON.stringify({ columns, sheet_name: sheetName }),
  });
  return parseResponse(res);
}

export async function aiNlToRule(description, columns, aiConfig) {
  const res = await fetch(`${BASE}/api/intel/ai/nl-to-rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAIHeaders(aiConfig) },
    body: JSON.stringify({ description, columns }),
  });
  return parseResponse(res);
}

export async function aiChat(message, context, aiConfig) {
  const res = await fetch(`${BASE}/api/intel/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAIHeaders(aiConfig) },
    body: JSON.stringify({ message, context }),
  });
  return parseResponse(res);
}

export async function testAIKey(aiConfig) {
  const res = await fetch(`${BASE}/api/intel/ai/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAIHeaders(aiConfig) },
    body: JSON.stringify({}),
  });
  return parseResponse(res);
}

export async function listProviders() {
  const res = await fetch(`${BASE}/api/intel/providers`);
  return parseResponse(res);
}

export async function getAIStatus() {
  const res = await fetch(`${BASE}/api/intel/ai/status`);
  return parseResponse(res);
}
