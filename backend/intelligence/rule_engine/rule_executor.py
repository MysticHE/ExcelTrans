"""
Orchestrates rule execution against two DataFrames to produce a comparison result.
Supports multi-column output: each rule can target a named output column.
"""
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple

from .rule_schema import ComparisonTemplate
from .row_matcher import exact_match, fuzzy_match
from .change_detector import (
    fields_changed, evaluate_conditions, resolve_outcome_label, _is_empty
)


def dataframe_to_rows(df: pd.DataFrame) -> List[Dict]:
    """Convert DataFrame to list of dicts with string column names."""
    return df.where(pd.notnull(df), None).to_dict(orient='records')


def execute_template(template: ComparisonTemplate,
                     df_a: pd.DataFrame,
                     df_b: pd.DataFrame) -> Dict[str, Any]:
    """
    Run all rules from `template` against df_a (old) and df_b (new).

    Returns a result dict:
    {
        'rows': [{
            ...row data fields,
            'source': 'B' | 'A' | 'matched',
            'output_columns': {'Remarks': {'label': '...', 'color': '...'}, 'Custom Col': {...}},
            'remarks': '...',        # first Remarks column label (backward compat)
            'color': '#xxxxxx',      # row background from Remarks column
            'changed_fields': [...],
            '_row_a': {...},         # original row_a data for matched pairs (detail drawer)
        }],
        'summary': {'total': int, 'additions': int, 'deletions': int, 'changes': int, 'unchanged': int},
    }
    """
    rows_a = dataframe_to_rows(df_a)
    rows_b = dataframe_to_rows(df_b)

    key_fields = template.column_mapping.unique_key
    compare_fields = template.column_mapping.compare_fields
    display_fields = template.column_mapping.display_fields

    # Determine match method from ROW_MATCH rule if present
    match_method = 'exact'
    fuzzy_threshold = 0.8
    for rule in template.rules:
        if rule.rule_type == 'ROW_MATCH':
            match_method = rule.config.get('method', 'exact')
            fuzzy_threshold = float(rule.config.get('fuzzy_threshold', 0.8))
            break

    # Match rows
    if match_method == 'fuzzy':
        matched_pairs, only_a, only_b, match_warnings = fuzzy_match(rows_a, rows_b, key_fields, fuzzy_threshold)
    else:
        matched_pairs, only_a, only_b, match_warnings = exact_match(rows_a, rows_b, key_fields)

    result_rows = []

    include_unmatched = template.output_config.include_unmatched_rows

    # --- Process rows only in B (additions) ---
    for j in only_b:
        row_b = rows_b[j]
        output_cols = _compute_output_columns('addition', None, row_b, template.rules, compare_fields)
        # Skip if no rule fired and user opted out of unmatched rows
        if not output_cols and not include_unmatched:
            continue
        if 'Remarks' not in output_cols:
            output_cols['Remarks'] = {'label': 'Addition', 'color': '#C6EFCE'}
        rem = output_cols.get('Remarks', {})
        result_rows.append({
            **_build_output_row(row_b, key_fields, compare_fields, display_fields),
            'source': 'B',
            'output_columns': output_cols,
            'remarks': rem.get('label', 'Addition'),
            'color': rem.get('color', '#C6EFCE'),
            'changed_fields': [],
            '_row_a': None,
        })

    # --- Process rows only in A (deletions) ---
    for i in only_a:
        row_a = rows_a[i]
        output_cols = _compute_output_columns('deletion', row_a, None, template.rules, compare_fields)
        # Skip if no rule fired and user opted out of unmatched rows
        if not output_cols and not include_unmatched:
            continue
        if 'Remarks' not in output_cols:
            output_cols['Remarks'] = {'label': 'Deletion', 'color': '#FFC7CE'}
        rem = output_cols.get('Remarks', {})
        result_rows.append({
            **_build_output_row(row_a, key_fields, compare_fields, display_fields),
            'source': 'A',
            'output_columns': output_cols,
            'remarks': rem.get('label', 'Deletion'),
            'color': rem.get('color', '#FFC7CE'),
            'changed_fields': [],
            '_row_a': None,
        })

    # --- Process matched pairs ---
    for i, j in matched_pairs:
        row_a = rows_a[i]
        row_b = rows_b[j]
        all_changed = fields_changed(row_a, row_b, compare_fields)
        output_cols = _compute_output_columns(
            'matched', row_a, row_b, template.rules, compare_fields,
            all_changed_fields=all_changed
        )
        if 'Remarks' not in output_cols:
            if all_changed:
                output_cols['Remarks'] = {'label': 'Changed', 'color': '#FFEB9C'}
            else:
                output_cols['Remarks'] = {'label': '', 'color': None}
        rem = output_cols.get('Remarks', {})
        all_data_fields = list(dict.fromkeys(key_fields + display_fields + compare_fields))
        result_rows.append({
            **_build_output_row(row_b, key_fields, compare_fields, display_fields),
            'source': 'matched',
            'output_columns': output_cols,
            'remarks': rem.get('label', ''),
            'color': rem.get('color', None),
            'changed_fields': all_changed,
            '_row_a': {f: row_a.get(f) for f in all_data_fields},
        })

    summary = _build_summary(result_rows)
    result: Dict[str, Any] = {'rows': result_rows, 'summary': summary}
    if match_warnings:
        result['warnings'] = match_warnings
    return result


def _compute_output_columns(context: str,
                             row_a: Optional[Dict],
                             row_b: Optional[Dict],
                             rules: list,
                             compare_fields: List[str],
                             all_changed_fields: Optional[List[str]] = None) -> Dict:
    """
    Evaluate all rules for a row and return output_columns dict.

    context: 'addition' | 'deletion' | 'matched'
    Returns: {col_name: {'label': str, 'color': str}, ...}
    Priority: first matching rule per output column wins.
    """
    output_columns: Dict[str, Dict] = {}

    for rule in rules:
        if rule.rule_type in ('ROW_MATCH', 'FORMULA_RULE'):
            continue

        col_name = rule.output_column or 'Remarks'
        if col_name in output_columns:
            continue  # First match wins for this output column

        label, color = _evaluate_rule(rule, row_a, row_b, context, compare_fields, all_changed_fields)
        if label is not None:
            output_columns[col_name] = {'label': label, 'color': color}

    return output_columns


def _evaluate_rule(rule,
                   row_a: Optional[Dict],
                   row_b: Optional[Dict],
                   context: str,
                   compare_fields: List[str],
                   all_changed_fields: Optional[List[str]] = None) -> Tuple[Optional[str], Optional[str]]:
    """
    Evaluate a single rule against a row context.
    Returns (label, color) if the rule fires, or (None, None) if it doesn't apply.
    """
    rt = rule.rule_type
    cfg = rule.config

    if rt == 'PRESENCE_RULE':
        if context == 'addition':
            entry = cfg.get('only_in_file_b', {})
            label = entry.get('outcome_label', 'Addition')
            color = entry.get('color', '#C6EFCE')
            return resolve_outcome_label(label, row_b) if row_b else label, color
        elif context == 'deletion':
            entry = cfg.get('only_in_file_a', {})
            label = entry.get('outcome_label', 'Deletion')
            color = entry.get('color', '#FFC7CE')
            return resolve_outcome_label(label, row_a) if row_a else label, color
        return None, None

    elif rt == 'CHANGE_RULE':
        if context != 'matched':
            return None, None
        check_fields = cfg.get('fields', compare_fields) or compare_fields
        if all_changed_fields is not None:
            changed = [f for f in check_fields if f in set(all_changed_fields)]
        else:
            changed = fields_changed(row_a, row_b, check_fields) if row_a and row_b else []
        if changed:
            return cfg.get('outcome_label', 'Changed'), cfg.get('color', '#FFEB9C')
        return None, None

    elif rt == 'CONDITION_RULE':
        conditions = cfg.get('conditions', [])
        join = cfg.get('condition_join', 'AND')
        if evaluate_conditions(row_a, row_b, conditions, join):
            active_row = row_b if row_b is not None else row_a
            label = resolve_outcome_label(cfg.get('outcome_label', 'Flagged'), active_row)
            return label, cfg.get('color', '#FFC7CE')
        return None, None

    return None, None


def _build_output_row(row: Dict, key_fields: List[str],
                      compare_fields: List[str], display_fields: List[str]) -> Dict:
    """Build output row with all relevant fields."""
    output = {}
    all_fields = list(dict.fromkeys(key_fields + display_fields + compare_fields))
    for f in all_fields:
        output[f] = row.get(f)
    return output


def _build_summary(result_rows: List[Dict]) -> Dict:
    additions = sum(1 for r in result_rows if r.get('source') == 'B')
    deletions = sum(1 for r in result_rows if r.get('source') == 'A')
    changes = sum(1 for r in result_rows if r.get('source') == 'matched' and r.get('changed_fields'))
    unchanged = sum(1 for r in result_rows if r.get('source') == 'matched' and not r.get('changed_fields'))
    return {
        'total': len(result_rows),
        'additions': additions,
        'deletions': deletions,
        'changes': changes,
        'unchanged': unchanged,
    }
