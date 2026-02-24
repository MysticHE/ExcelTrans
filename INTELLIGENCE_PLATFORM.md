# Excel Intelligence Platform

A universal Excel comparison wizard with AI assistance, built as a modular layer on top of an existing Flask + React project.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Reference](#file-reference)
4. [Setup — Standalone Project](#setup--standalone-project)
5. [Setup — Add to Existing Project](#setup--add-to-existing-project)
6. [Dependencies](#dependencies)
7. [API Endpoints](#api-endpoints)
8. [How the Wizard Works](#how-the-wizard-works)
9. [Rule Types Reference](#rule-types-reference)
10. [AI Integration](#ai-integration)
11. [Built-in Templates](#built-in-templates)
12. [Session Management](#session-management)

---

## Overview

The Intelligence Platform lets users upload any two Excel files, auto-detect columns and data types, configure comparison rules visually or via AI natural language, and download a color-coded Excel diff report.

**Key capabilities:**
- Auto-detects column types (text / numeric / date / formula)
- Dual openpyxl pass captures both formula strings and computed values
- JSON rule engine — no eval/exec (security boundary)
- Multi-provider AI (Anthropic Claude, OpenAI, Google Gemini) with Bring-Your-Own-Key
- 4 built-in templates encoding existing specialized tools
- 5-step guided wizard with session recovery via sessionStorage
- Slide-in AI chat panel available throughout wizard

---

## Architecture

```
backend/intelligence/          Flask Blueprint (/api/intel/*)
├── excel_analyzer/            File analysis engine (dual openpyxl pass)
├── rule_engine/               Comparison rule schema + executor
├── output_builder/            Excel report generator (openpyxl)
├── ai_assistant/              Multi-provider AI abstraction
└── built_in_templates/        Pre-built JSON templates

frontend/src/intelligence/     React wizard platform
├── wizard/                    5-step wizard components
├── ai/                        AI chat panel + suggestion banner
├── templates/                 Template gallery modal
├── hooks/                     useWizardState (sessionStorage)
└── services/                  API client (intelApi.js)
```

### Data Flow

```
User uploads files
  → POST /api/intel/analyze
  → excel_analyzer: dual openpyxl pass → column type inference → header detection
  → returns ColumnAnalysis JSON + session_id

User configures via wizard (Steps 2-4)
  → column roles, rules stored in React state (sessionStorage)

User clicks Run
  → POST /api/intel/process (with template JSON)
  → rule_engine: row matching → change detection → rule evaluation
  → output_builder: generates Excel report
  → returns download_url

User downloads
  → GET /api/intel/download/{session_id}/{result_id}
```

---

## File Reference

### Backend

#### `backend/intelligence/__init__.py`
Exports the Flask Blueprint (`intel_bp`).

#### `backend/intelligence/routes.py`
Main Blueprint file. Registers all `/api/intel/*` endpoints. Contains:
- In-memory session store (thread-safe dict with 1hr TTL)
- Template registry (loads JSON files from `built_in_templates/`)
- Heuristic template suggestion (keyword-based, no AI needed)
- AI provider extraction from request headers (`X-AI-Provider`, `X-AI-Key`, `X-AI-Model`)

---

#### `backend/intelligence/excel_analyzer/sheet_reader.py`
**Purpose:** Dual openpyxl pass to capture formulas AND computed values.

```python
read_sheet_dual_pass(filepath: str) -> Dict[str, Any]
# Returns dict keyed by sheet name with per-cell data:
# { formula, value, is_formula, row, col, col_letter, data_type }

get_formula_cells(sheet_data) -> List[Dict]
# Returns flat list of all formula cells with location + formula string
```

**Why dual pass:** openpyxl limitation — `data_only=True` reads cached values but loses formula strings. `data_only=False` reads formulas but not computed values. Both passes are merged at cell level.

---

#### `backend/intelligence/excel_analyzer/column_classifier.py`
**Purpose:** Infers column types from cell values.

```python
classify_column(values, formula_count, total_cells) -> str
# Returns: 'text' | 'numeric' | 'date' | 'formula' | 'mixed' | 'empty'

analyze_columns(values_grid, formula_grid, header_row) -> List[Dict]
# Returns list of ColumnAnalysis dicts with:
# { index, name, detected_type, null_rate, formula_count, sample_values, formula_info }
```

---

#### `backend/intelligence/excel_analyzer/formula_classifier.py`
**Purpose:** Classifies formula strings into categories.

```python
classify_formula(formula: str) -> str
# Returns: 'arithmetic' | 'lookup' | 'IF' | 'concat' | 'date' | 'aggregate' | 'reference' | 'other'

classify_column_formulas(formula_list) -> str
# Returns dominant formula type for a column
```

**Detection logic:**
- Lookup: VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP
- Aggregate: SUM, AVERAGE, COUNT, SUMIF, COUNTIF, etc.
- Text/concat: CONCATENATE, TEXTJOIN, LEFT, RIGHT, MID, etc.
- Date: DATE, TODAY, NOW, DATEDIF, etc.
- Logic/IF: IF, IFS, AND, OR, IFERROR, SWITCH
- Arithmetic: operators (+, -, *, /) between cell refs

---

#### `backend/intelligence/excel_analyzer/header_detector.py`
**Purpose:** Auto-detects the header row in a sheet.

```python
detect_header_row(values_grid, max_scan_rows=30) -> int
# Scans first 30 rows, scores by text density + fill rate
# Returns 0-based row index of best header

extract_header_names(values_grid, header_row) -> List[str]
# Returns list of header cell values as strings
```

**Strategy:** Finds the row with highest text density (fraction of cells that are non-numeric strings). Stops early if density > 80% in first 5 rows.

---

#### `backend/intelligence/rule_engine/rule_schema.py`
**Purpose:** Dataclass models for all rule types and template structure.

```python
# Key classes:
ComparisonTemplate    # Full template (sheet config + column mapping + rules + output config)
Rule                  # { rule_type: str, config: Dict }
SheetConfig           # { file_a_sheet, file_b_sheet, header_row }
ColumnMapping         # { unique_key, compare_fields, display_fields, ignored_fields, formula_fields }
OutputConfig          # { add_remarks_column, include_summary_sheet, highlight_changed_cells, output_filename_template }
Condition             # { field, operator, value }
```

No external dependencies (uses Python dataclasses, not Pydantic).

---

#### `backend/intelligence/rule_engine/rule_validator.py`
**Purpose:** Validates rule and template dicts before execution.

```python
validate_rule(rule: Dict) -> Tuple[bool, List[str]]
validate_template(template: Dict) -> Tuple[bool, List[str]]
```

This is the security boundary — AI-generated rule JSON is always validated here before entering the executor. Invalid rules return plain-English error messages shown to the user.

---

#### `backend/intelligence/rule_engine/row_matcher.py`
**Purpose:** Matches rows between two files by composite key.

```python
exact_match(rows_a, rows_b, key_fields) -> (matched_pairs, only_a, only_b)
fuzzy_match(rows_a, rows_b, key_fields, threshold=0.8) -> (matched_pairs, only_a, only_b)
```

- `exact_match`: Fast dict lookup by composite key string
- `fuzzy_match`: Uses `difflib.SequenceMatcher` — tries exact first, falls back to fuzzy
- Returns: list of `(idx_a, idx_b)` matched pairs + unmatched indices from each side

---

#### `backend/intelligence/rule_engine/change_detector.py`
**Purpose:** Per-field diff and condition evaluation.

```python
fields_changed(row_a, row_b, fields) -> List[str]
# Returns list of field names where values differ (normalized comparison)

evaluate_condition(row_a, row_b, condition) -> bool
# Evaluates a single condition dict

evaluate_conditions(row_a, row_b, conditions, join='AND') -> bool
# Evaluates list of conditions with AND/OR joining

resolve_outcome_label(label_template, row) -> str
# Replaces {FieldName} placeholders with actual row values
```

**Normalization:** Floats are compared as int if whole number, dates normalized to YYYY-MM-DD string.

---

#### `backend/intelligence/rule_engine/rule_executor.py`
**Purpose:** Orchestrates all rules against two DataFrames.

```python
execute_template(template: ComparisonTemplate, df_a, df_b) -> Dict
# Returns:
# {
#   'rows': [{ ...fields, 'remarks': str, 'color': '#xxxxxx', 'changed_fields': [...] }],
#   'summary': { 'total', 'additions', 'deletions', 'changes', 'unchanged' }
# }
```

**Execution order:**
1. Match rows using ROW_MATCH config (exact or fuzzy)
2. For rows only in B → PRESENCE_RULE addition config
3. For rows only in A → PRESENCE_RULE deletion config
4. For matched rows → check CONDITION_RULEs first (higher priority), then CHANGE_RULEs

---

#### `backend/intelligence/output_builder/report_generator.py`
**Purpose:** Generates the Excel comparison report.

```python
build_comparison_report(result, template_name, compare_fields, key_fields,
                        display_fields, add_remarks, include_summary,
                        highlight_changed_cells) -> bytes
```

- Returns raw `.xlsx` bytes (no temp files)
- Row-level coloring from rule `color` field (hex string → PatternFill)
- Cell-level highlighting for individually changed fields
- Always creates new `PatternFill()` objects (openpyxl limitation — never copy fills)
- Auto-fits column widths (capped at 40 chars)
- Freezes first row
- Optional Summary sheet with addition/deletion/change counts

---

#### `backend/intelligence/ai_assistant/provider_factory.py`
**Purpose:** Multi-provider AI abstraction. Keys are never stored server-side.

```python
AIProviderFactory.get_provider(provider, api_key, model) -> BaseAIProvider
# provider: 'anthropic' | 'openai' | 'gemini'

provider.complete(system, user, max_tokens) -> str
provider.test_connection() -> bool
```

**Supported providers:**

| Provider | Models | SDK |
|----------|--------|-----|
| Anthropic | claude-haiku-4-5-20251001, claude-sonnet-4-6 | `anthropic` |
| OpenAI | gpt-4o-mini, gpt-4o | `openai` |
| Google | gemini-2.0-flash, gemini-2.5-pro-preview-03-25 | `google-genai` |

**Note:** Uses `google-genai` (new SDK), NOT the deprecated `google-generativeai`.

---

#### `backend/intelligence/ai_assistant/prompt_builder.py`
**Purpose:** Builds context-aware prompts for each AI use case.

```python
build_nl_to_rule_prompt(description, column_names) -> str
build_template_suggest_prompt(columns, sheet_name) -> str
build_chat_prompt(message, context) -> str
```

Contains three system prompts:
- `SYSTEM_PROMPT_NL_TO_RULE` — strict JSON-only output, schema injected verbatim, 3 examples
- `SYSTEM_PROMPT_TEMPLATE_SUGGEST` — returns template slug only (1 token)
- `SYSTEM_PROMPT_CHAT` — conversational assistant for wizard guidance

---

#### `backend/intelligence/ai_assistant/rule_extractor.py`
**Purpose:** Parses AI text response → validated rule dict.

```python
parse_rule_from_ai(ai_response: str) -> Tuple[Optional[Dict], Optional[str]]
# Returns (rule_dict, None) on success, (None, error_message) on failure

parse_template_slug(ai_response: str) -> str
# Extracts template slug from suggestion response
```

Handles: raw JSON, ```json blocks, JSON embedded in text. Always validates via `rule_validator.py` before returning. Invalid → plain-English error shown to user.

---

#### `backend/intelligence/built_in_templates/*.json`

| File | Template | Description |
|------|----------|-------------|
| `mediacorp_el.json` | Mediacorp Employee ADC | CONDITION_RULEs for LDS termination, FIN→NRIC detection |
| `gp_panel.json` | GP Panel Comparison | PRESENCE_RULE for panel additions/removals, CHANGE_RULE for info changes |
| `renewal_comparison.json` | Renewal Comparison | Plan/premium change detection, category changes |
| `clinic_matcher.json` | Clinic Matcher | Fuzzy ROW_MATCH (threshold 0.6), PRESENCE_RULE for panel gaps |

Each template JSON structure:
```json
{
  "template_name": "...",
  "slug": "unique_identifier",
  "description": "...",
  "sheet_config": { "file_a_sheet": "...", "file_b_sheet": "...", "header_row": 0 },
  "column_mapping": {
    "unique_key": ["Col1"],
    "compare_fields": ["Col2", "Col3"],
    "display_fields": ["Col1", "Col2"],
    "ignored_fields": [],
    "formula_fields": {}
  },
  "rules": [ ... ],
  "output_config": {
    "add_remarks_column": true,
    "include_summary_sheet": true,
    "highlight_changed_cells": true,
    "output_filename_template": "report_{date}"
  }
}
```

---

### Frontend

#### `frontend/src/intelligence/IntelligencePlatform.js`
**Purpose:** Root component. Contains AI settings modal + toolbar.

- Gear icon (⚙) opens AI Settings panel (provider/key/model selection)
- "✨ AI Chat" button toggles slide-in chat panel
- "📋 Templates" button opens Template Gallery modal
- Manages `aiConfig` state (provider, apiKey, model)
- API keys persisted to `sessionStorage` under key `intel_ai_key`
- Reset button clears wizard state

---

#### `frontend/src/intelligence/wizard/WizardContainer.js`
**Purpose:** Step orchestrator with progress indicator.

- Renders step indicator (1→2→3→4→5) with click-back for completed steps
- Mounts the correct Step component based on `wizard.state.step`
- Passes `wizard` object and `aiConfig` to all steps

---

#### `frontend/src/intelligence/wizard/Step1_Upload.js`
**Purpose:** Two file dropzones (File A + File B).

- Uses `react-dropzone` (already installed)
- Accepts `.xlsx` and `.xls`
- On "Analyze Files": POSTs to `/api/intel/analyze`, stores `session_id` + `analysis` in wizard state
- Advances to Step 2 on success

---

#### `frontend/src/intelligence/wizard/Step2_SheetSelector.js`
**Purpose:** Sheet selection + template suggestion banner.

- Shows all detected sheets with row counts and formula summaries
- Auto-selects first sheet as default
- Reads `suggested_template` from analysis response → shows `AISuggestionBanner`
- "Apply Template" loads full template from `/api/intel/templates/{slug}` and skips to Step 4
- Color-coded column type chips in preview panel

---

#### `frontend/src/intelligence/wizard/Step3_ColumnMapper.js`
**Purpose:** Assign roles to each detected column.

**Roles:**
| Role | Purpose |
|------|---------|
| Unique Key | Matches rows between files |
| Compare Fields | Checked for value changes |
| Display Only | Shown in output but not compared |
| Ignore | Excluded entirely |

- Dropdowns per column (no drag-and-drop dependency required)
- Live role summary sections update as user assigns
- Validation: must have at least 1 Unique Key to proceed

---

#### `frontend/src/intelligence/wizard/Step4_RuleBuilder.js`
**Purpose:** Visual rule card editor + AI natural language input.

- Add rule buttons for each rule type
- Per-type editors:
  - PRESENCE_RULE: label + color picker for each file-only case
  - CHANGE_RULE: multi-select fields + label + color
  - CONDITION_RULE: condition rows (field + operator + value) + AND/OR toggle + label + color
  - ROW_MATCH: exact/fuzzy toggle + threshold slider
- "Describe a rule in plain English" box → calls `/api/intel/ai/nl-to-rule` → inserts new rule card
- Delete button (✕) on each card

---

#### `frontend/src/intelligence/wizard/Step5_OutputConfig.js`
**Purpose:** Output settings + run comparison.

- Toggle switches: remarks column, summary sheet, highlight changed cells
- Filename template input (`{date}` placeholder)
- "Preview (20 rows)" → calls process with `dry_run: true` → shows inline table
- "Run Comparison" → full process → shows summary badges + download button
- Summary badges: Total / Additions / Deletions / Changes / Unchanged

---

#### `frontend/src/intelligence/ai/AIChatPanel.js`
**Purpose:** Slide-in AI assistant panel (320px wide, fixed right).

- Maintains message history in local state
- Sends current wizard context (step, sheets, column mapping, rules) with each message
- Renders ``` json ``` code blocks in assistant responses with syntax highlighting
- Keyboard: Enter sends, Shift+Enter newline

---

#### `frontend/src/intelligence/ai/AISuggestionBanner.js`
**Purpose:** Blue banner shown when a template match is detected.

- Shows template display name
- "Apply Template" and "Dismiss" buttons
- Renders null if slug is 'none' or empty

---

#### `frontend/src/intelligence/templates/TemplateGallery.js`
**Purpose:** Full-screen modal listing all available templates.

- Fetches from `/api/intel/templates` on mount
- Shows icon, name, description, built-in badge
- "Apply" button loads template JSON and calls parent `onApply` callback

---

#### `frontend/src/intelligence/hooks/useWizardState.js`
**Purpose:** Central wizard state management with sessionStorage persistence.

```js
const { state, update, reset, goToStep, buildTemplate } = useWizardState();

// state shape:
{
  step: 1,
  sessionId: null,
  fileA: null,           // File object (not persisted)
  fileB: null,           // File object (not persisted)
  analysis: null,        // Full /analyze response
  selectedSheets: { file_a: null, file_b: null },
  columnMapping: { unique_key: [], compare_fields: [], display_fields: [], ignored_fields: [], formula_fields: {} },
  rules: [],
  outputConfig: { add_remarks_column: true, include_summary_sheet: true, highlight_changed_cells: true, output_filename_template: 'comparison_{date}' },
  templateName: 'Custom Comparison',
  appliedTemplate: null,
  result: null,
}

buildTemplate()  // → valid template dict ready for POST /api/intel/process
```

File objects are excluded from sessionStorage (not serializable). Session recovery restores wizard config but not uploaded files — user must re-upload if page refreshes.

---

#### `frontend/src/intelligence/services/intelApi.js`
**Purpose:** All API calls for the intelligence platform.

```js
analyzeFiles(fileA, fileB)                           // POST /api/intel/analyze
processComparison(sessionId, template, dryRun)        // POST /api/intel/process
downloadResult(sessionId, resultId, filename)          // GET /api/intel/download/...
listTemplates()                                        // GET /api/intel/templates
getTemplate(slug)                                      // GET /api/intel/templates/{slug}
saveTemplate(template)                                 // POST /api/intel/templates
aiSuggestTemplate(columns, sheetName, aiConfig)        // POST /api/intel/ai/suggest
aiNlToRule(description, columns, aiConfig)             // POST /api/intel/ai/nl-to-rule
aiChat(message, context, aiConfig)                     // POST /api/intel/ai/chat
testAIKey(aiConfig)                                    // POST /api/intel/ai/test
listProviders()                                        // GET /api/intel/providers
```

AI config headers sent per-request: `X-AI-Provider`, `X-AI-Key`, `X-AI-Model`

---

## Setup — Standalone Project

### 1. Backend

```
new-project/
├── app.py
├── requirements.txt
└── intelligence/          ← copy entire folder from EL/backend/intelligence/
```

**`app.py`:**
```python
from flask import Flask
from flask_cors import CORS
from intelligence import intel_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(intel_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
```

**`requirements.txt`:**
```
Flask==3.0.0
flask-cors==4.0.0
pandas==2.3.2
openpyxl==3.1.5
xlrd==2.0.1
anthropic>=0.40.0
openai>=1.50.0
google-genai>=0.5.0
python-dotenv==1.0.0
gunicorn==21.2.0
```

**Install and run:**
```bash
pip install -r requirements.txt
python app.py
```

---

### 2. Frontend

```
new-project-frontend/
└── src/
    ├── App.js             ← your root (see below)
    ├── index.js
    ├── index.css          ← must include Tailwind
    └── intelligence/      ← copy entire folder from EL/frontend/src/intelligence/
```

**`src/App.js` (minimal):**
```jsx
import React from 'react';
import IntelligencePlatform from './intelligence/IntelligencePlatform';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <IntelligencePlatform />
      </div>
    </div>
  );
}

export default App;
```

**`package.json` dependencies needed:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "react-dropzone": "^14.2.3"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31"
  }
}
```

**Update API base URL in `intelligence/services/intelApi.js`:**
```js
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';
```

**Install and run:**
```bash
npm install
npm start
```

---

## Setup — Add to Existing Project

Only 3 file modifications needed in the existing project:

**`backend/app.py`** (add after `app = Flask(...)` and `CORS(app)`):
```python
from intelligence import intel_bp
app.register_blueprint(intel_bp)
```

**`backend/requirements.txt`** (add 3 lines):
```
anthropic>=0.40.0
openai>=1.50.0
google-genai>=0.5.0
```

**`frontend/src/App.js`** (add import + tab):
```jsx
import IntelligencePlatform from './intelligence/IntelligencePlatform';

// In tab navigation:
<button onClick={() => setActiveTab('intelligence')}>✨ Intelligence</button>

// In content area:
{activeTab === 'intelligence' && <IntelligencePlatform />}
```

---

## Dependencies

### Python (new)
| Package | Purpose |
|---------|---------|
| `anthropic>=0.40.0` | Claude API SDK |
| `openai>=1.50.0` | OpenAI API SDK |
| `google-genai>=0.5.0` | Google Gemini SDK (new, not deprecated google-generativeai) |

### Python (already required)
| Package | Purpose |
|---------|---------|
| Flask | Web framework |
| flask-cors | Cross-origin requests |
| pandas | DataFrame operations |
| openpyxl | Excel read/write |
| xlrd | Legacy .xls support |

### JavaScript (new — none required)
All functionality uses only packages already in the project (`react-dropzone` for file upload).

---

## API Endpoints

All endpoints are prefixed `/api/intel/`.

### File Analysis

**`POST /api/intel/analyze`**
- Body: `multipart/form-data` with `file_a` (required) and `file_b` (optional)
- Returns: `{ session_id, file_a: { sheets: [...] }, file_b: { sheets: [...] } }`
- Each sheet: `{ name, header_row, row_count, columns: [...], formula_summary, suggested_template }`
- Each column: `{ index, name, detected_type, null_rate, formula_count, formula_info }`

**`GET /api/intel/session/{session_id}`**
- Returns: `{ session_id, has_analysis, has_template, has_result }`
- 404 if session expired (1 hour TTL)

---

### Processing

**`POST /api/intel/process`**
```json
{
  "session_id": "...",
  "template": { ... },
  "dry_run": false
}
```
- `dry_run: true` → returns `{ preview: [...20 rows], summary: {...} }` (no file generated)
- `dry_run: false` → returns `{ download_id, download_url, filename, summary }`

**`GET /api/intel/download/{session_id}/{result_id}`**
- Returns `.xlsx` file as attachment

---

### Templates

**`GET /api/intel/templates`**
- Returns: `{ templates: [{ slug, name, description, is_builtin }] }`

**`GET /api/intel/templates/{slug}`**
- Returns full template JSON

**`POST /api/intel/templates`**
- Body: full template JSON
- Saves to session-scoped user templates
- Returns: `{ slug, message }`

---

### AI

All AI endpoints accept optional headers: `X-AI-Provider`, `X-AI-Key`, `X-AI-Model`.
Falls back to platform `ANTHROPIC_API_KEY` env var if no key provided.

**`POST /api/intel/ai/suggest`**
```json
{ "columns": ["Col1", "Col2"], "sheet_name": "Employee Listing" }
```
Returns: `{ suggested_template: "mediacorp_el", confidence: "heuristic|ai" }`

**`POST /api/intel/ai/nl-to-rule`**
```json
{ "description": "mark as terminated if Last Day of Service is filled", "columns": [...] }
```
Returns: `{ rule: { rule_type: "...", config: {...} } }` or `{ error: "..." }`

**`POST /api/intel/ai/chat`**
```json
{ "message": "...", "context": { "step": 4, "rules": [...] } }
```
Returns: `{ response: "..." }`

**`POST /api/intel/ai/test`**
- Tests the API key in the request headers
- Returns: `{ success: true }` or `{ success: false, error: "..." }`

**`GET /api/intel/providers`**
- Returns: `{ anthropic: { models: [...], default_model: "..." }, ... }`

---

## How the Wizard Works

### Step 1 — Upload
User drops File A (old) and optionally File B (new). On submit, files are POSTed to `/api/intel/analyze`. The backend runs a dual openpyxl pass and returns column analysis. A `session_id` is returned and stored — subsequent process calls reference this session.

### Step 2 — Sheet Selector
Detected sheets are shown as clickable cards with row counts and formula summaries. If analysis returns a `suggested_template`, the suggestion banner appears. User can apply a template to skip to Step 4 with all settings pre-filled.

### Step 3 — Column Mapper
Each detected column gets a role dropdown (Unique Key / Compare Fields / Display Only / Ignore). At least one Unique Key is required. The role assignments become the `column_mapping` in the template.

### Step 4 — Rule Builder
Visual cards for each rule. Rule types:
- **PRESENCE_RULE**: configure labels and colors for rows that only exist in one file
- **CHANGE_RULE**: select which fields to compare; outcome label shown when any field differs
- **CONDITION_RULE**: IF/THEN logic with multiple conditions joined by AND/OR
- **ROW_MATCH**: exact or fuzzy matching with threshold slider

AI text box at bottom: user types description → `/api/intel/ai/nl-to-rule` → new rule card inserted.

### Step 5 — Output Config
Toggles for report options, filename template. "Preview" runs a dry-run returning 20 rows as an inline table. "Run Comparison" generates the full Excel report and shows a download button with summary counts.

---

## Rule Types Reference

### PRESENCE_RULE
Handles rows that exist in only one file.
```json
{
  "rule_type": "PRESENCE_RULE",
  "config": {
    "only_in_file_b": { "outcome_label": "Addition", "color": "#C6EFCE" },
    "only_in_file_a": { "outcome_label": "Deletion", "color": "#FFC7CE" }
  }
}
```

### CHANGE_RULE
Detects value changes in specified fields between matched rows.
```json
{
  "rule_type": "CHANGE_RULE",
  "config": {
    "fields": ["Employee Name", "Department"],
    "outcome_label": "Changed",
    "color": "#FFEB9C"
  }
}
```

### CONDITION_RULE
IF/THEN logic. Evaluated before CHANGE_RULE (higher priority).
```json
{
  "rule_type": "CONDITION_RULE",
  "config": {
    "conditions": [
      { "field": "Last Day of Service", "operator": "is_not_empty" },
      { "field": "Category", "operator": "is_empty" }
    ],
    "condition_join": "AND",
    "outcome_label": "Deletion wef {Last Day of Service}",
    "color": "#FFC7CE"
  }
}
```

**`{FieldName}` placeholders** in `outcome_label` are replaced with actual row values at runtime.

### ROW_MATCH
Controls how rows are matched between files.
```json
{
  "rule_type": "ROW_MATCH",
  "config": { "method": "fuzzy", "fuzzy_threshold": 0.8 }
}
```
`method`: `"exact"` (default) or `"fuzzy"`. Fuzzy uses `difflib.SequenceMatcher`.

### FORMULA_RULE
Per-column handling of formula cells.
```json
{
  "rule_type": "FORMULA_RULE",
  "config": {
    "column_actions": {
      "Salary Calc": "compare_value",
      "Tax Formula": "skip"
    }
  }
}
```
Actions: `"compare_value"` | `"compare_expression"` | `"skip"`

---

### Valid Operators (CONDITION_RULE)

| Operator | Description |
|----------|-------------|
| `is_empty` | Field is null or blank |
| `is_not_empty` | Field has any value |
| `equals` | Exact match to `value` |
| `not_equals` | Does not match `value` |
| `contains` | String contains `value` (case-insensitive) |
| `starts_with` | String starts with `value` |
| `changed_from_empty` | Was blank in File A, has value in File B |
| `changed_to_empty` | Had value in File A, blank in File B |
| `date_is_before` | Date field is before `value` |
| `date_is_after` | Date field is after `value` |
| `changed_from_pattern` | File A value matches regex `value` |
| `changed_to_pattern` | File B value matches regex `value` |

---

## AI Integration

### Security Model
- AI **never produces executable Python code**
- AI output is always rule JSON, validated by `rule_validator.py` before use
- Invalid JSON → plain-English error shown to user, nothing inserted
- API keys passed per-request in headers, never written to disk or logs

### BYOK Flow
1. User enters API key in AI Settings panel (gear icon)
2. Key stored in browser `sessionStorage` only (cleared when browser closes)
3. Every AI request sends key in `X-AI-Key` header
4. Backend uses key for that request only, then discards

### Platform Key Fallback
If no BYOK key provided, backend falls back to `ANTHROPIC_API_KEY` environment variable. Set this for a shared platform deployment.

### AI Layers

| Layer | When | Model Tier | Output |
|-------|------|------------|--------|
| Template Suggestion | Auto, after file analysis | Fast (haiku/flash) | Template slug |
| NL → Rule | User types description | Fast (haiku/flash) | Validated rule JSON |
| Chat | On demand | Any | Plain text guidance |

---

## Session Management

### Backend Sessions
- In-memory dict with thread-safe lock
- 1-hour TTL, cleaned up by background thread every 5 minutes
- Stores: file analysis, temp file paths, processed result bytes
- `session_id` is a UUID returned by `/api/intel/analyze`

### Frontend State
- `useWizardState` hook stores all wizard config in `sessionStorage`
- File objects (File A, File B) are NOT persisted (browser limitation)
- If user refreshes: wizard config (sheets, columns, rules) is restored, but files must be re-uploaded
- `reset()` clears both React state and sessionStorage

---

## Environment Variables

```env
# Optional: platform-level AI key (fallback if user has no BYOK key)
ANTHROPIC_API_KEY=sk-ant-xxx

# Inherited from base project (not required for standalone intelligence use)
UPLOAD_FOLDER=uploads
PROCESSED_FOLDER=processed
```

---

## Common Issues

**`openpyxl PatternFill` error when generating report**
Always create new `PatternFill()` objects. Never copy or reuse fill objects:
```python
# Correct
cell.fill = PatternFill(start_color='C6EFCE', end_color='C6EFCE', fill_type='solid')

# Wrong — will raise AttributeError
cell.fill = some_other_cell.fill
```

**Session expired on process**
The backend session expires after 1 hour. User must re-upload files to start a new session. The frontend shows "Session expired. Please re-upload files."

**AI returns invalid rule JSON**
`rule_extractor.py` catches this and returns a plain-English error. The rule is not inserted into the wizard. User sees the error message below the NL input box.

**`google-generativeai` deprecation warning**
This project uses the new `google-genai` package (`google.genai`), not the deprecated `google.generativeai`. If you see import errors, ensure `google-genai` is installed, not `google-generativeai`.

**Dual openpyxl pass and computed values**
If formulas show as `None` in the value column, the Excel file was never opened/saved in Excel after the formulas were added. openpyxl's `data_only=True` reads the cached value written by Excel — if no cache exists, it returns `None`. This is an openpyxl limitation.
