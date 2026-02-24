# Excel Intelligence Platform — Project Guide

## Project Overview
A two-file Excel comparison tool. Users upload old (File A) and new (File B) Excel files, configure comparison rules through a 5-step wizard, and download a color-coded Excel report.

## Stack
- **Backend**: Python Flask · port 5000 · `backend/`
- **Frontend**: React 18 + CRA · port 3000 · `frontend/`
- **No git worktrees** — single `master` branch on GitHub: `MysticHE/ExcelTrans`

## Start Commands
```bash
# Backend
cd backend && python app.py

# Frontend
cd frontend && npm start
```

## Key File Map
```
backend/
  app.py                                        — Flask entry point
  extensions.py                                 — Rate limiter setup
  intelligence/
    routes.py                                   — All /api/intel/* endpoints
    rule_engine/
      rule_schema.py                            — ComparisonTemplate, Rule, OutputConfig dataclasses
      rule_executor.py                          — Multi-column rule evaluation engine
      rule_validator.py                         — Template validation
      row_matcher.py                            — Exact / fuzzy row matching
      change_detector.py                        — Field diff + condition evaluation
    output_builder/
      report_generator.py                       — Excel report writer (openpyxl)
    excel_analyzer/                             — Sheet reading + column classification
    ai_assistant/                               — AI provider factory + prompt builders
    built_in_templates/                         — Pre-built JSON templates

frontend/src/intelligence/
  IntelligencePlatform.js                       — App shell, toolbar, AI settings modal
  ui/index.js                                   — Shared primitives: cn Button Card Badge Input Textarea Toggle Modal Spinner Alert
  hooks/useWizardState.js                       — All wizard state + buildTemplate()
  services/intelApi.js                          — Fetch wrappers for all API calls
  wizard/
    WizardContainer.js                          — Animated stepper
    Step1_Upload.js                             — File dropzone
    Step2_SheetSelector.js                      — Sheet picker + column preview + mismatch panel
    Step3_ColumnMapper.js                       — Column role assignment + smart defaults
    Step4_RuleBuilder.js                        — Rule cards + output column + reorder
    Step5_OutputConfig.js                       — Output settings + column manager + rich preview
  ai/
    AIChatPanel.js                              — Slide-in AI chat
    AISuggestionBanner.js                       — Template detection banner
  templates/
    TemplateGallery.js                          — Built-in template browser
```

## Wizard State Schema
```javascript
{
  step: 1-5,
  sessionId: string,            // from /api/intel/analyze
  fileA / fileB: File,
  analysis: { file_a: {...}, file_b: {...} },  // from backend
  selectedSheets: { file_a: string, file_b: string },
  columnMapping: {
    unique_key: string[],
    compare_fields: string[],
    display_fields: string[],
    ignored_fields: string[],
    formula_fields: {},
  },
  rules: [{
    rule_type: 'PRESENCE_RULE'|'CHANGE_RULE'|'CONDITION_RULE'|'ROW_MATCH',
    config: {...},
    output_column: string,       // '' = shared Remarks column
  }],
  outputConfig: {
    add_remarks_column: bool,
    include_summary_sheet: bool,
    highlight_changed_cells: bool,
    output_filename_template: string,  // supports {date} {file_a} {file_b}
    output_sheet_name: string,
    included_columns: string[]|null,   // null = all columns
    column_order: string[]|null,       // null = default order
  },
}
```

## Backend Row Result Schema
Each row in `result['rows']` has:
```python
{
  # data fields (key + display + compare)
  'source': 'B'|'A'|'matched',
  'output_columns': { 'Remarks': {'label': str, 'color': str}, 'CustomCol': {...} },
  'remarks': str,          # backward compat (= Remarks label)
  'color': str|None,       # row background (= Remarks color)
  'changed_fields': list,
  '_row_a': dict|None,     # matched pair only — for detail drawer
}
```

## Multi-Column Rule Logic
- Each rule has `output_column` ('' = "Remarks")
- Rules are evaluated top-to-bottom; **first match per output column wins**
- A row can have values in **multiple columns simultaneously**
- Row background color = first "Remarks"-column match
- `dry_run` returns 50 rows (includes `_row_a` for detail drawer)

## Design Tokens
| Token | Value |
|-------|-------|
| Primary | `#6366F1` indigo-500 |
| Primary hover | `#4F46E5` indigo-600 |
| Accent | `#10B981` emerald-500 |
| Background | `#F9FAFB` |
| Font | Inter (Google Fonts) |

## Frontend Libraries
- `lucide-react` v0.575 — all icons (no emoji)
- `framer-motion` v12 — step transitions, slide-in panels, result reveal
- `react-dropzone` v14
- Tailwind CSS 3 + PostCSS

## Known Icon Quirks
- `Function` → does NOT exist — use `Sigma`
- `GitCompare`, `Hospital`, `Rows` — all exist

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/intel/analyze` | Upload files, get analysis + session_id |
| POST | `/api/intel/process` | Run rules (dry_run=true for 50-row preview) |
| GET  | `/api/intel/download/:sid/:rid` | Download Excel report |
| GET  | `/api/intel/templates` | List built-in templates |
| GET  | `/api/intel/templates/:slug` | Get template by slug |
| POST | `/api/intel/ai/nl-to-rule` | NL → rule card |
| POST | `/api/intel/ai/chat` | Contextual AI chat |
| POST | `/api/intel/ai/test` | Validate API key |
