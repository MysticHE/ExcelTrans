"""
Row matching: exact key matching and fuzzy matching via difflib.
"""
import difflib
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Fuzzy match is O(n²) — cap to avoid hanging on large datasets
FUZZY_ROW_LIMIT = 2000


def make_key(row: Dict, key_fields: List[str]) -> str:
    """Build a composite key string from a row dict."""
    parts = []
    for field in key_fields:
        val = row.get(field, '')
        parts.append(str(val).strip().lower() if val is not None else '')
    return '|'.join(parts)


def build_key_index(rows: List[Dict], key_fields: List[str]) -> Tuple[Dict[str, int], int]:
    """
    Return (index, duplicate_count) where index maps composite key → first row index.
    Duplicate keys are counted and logged; subsequent occurrences are silently skipped.
    """
    index = {}
    duplicates = 0
    for i, row in enumerate(rows):
        key = make_key(row, key_fields)
        if key in index:
            duplicates += 1
        else:
            index[key] = i
    if duplicates:
        logger.warning(f"Detected {duplicates} duplicate key(s) — only first occurrence per key is matched")
    return index, duplicates


def exact_match(rows_a: List[Dict], rows_b: List[Dict],
                key_fields: List[str]) -> Tuple[List[Tuple], List[int], List[int], Dict]:
    """
    Exact key match between two row lists.

    Returns:
        matched_pairs: List of (idx_a, idx_b) tuples
        only_in_a: List of row indices from rows_a with no match in rows_b
        only_in_b: List of row indices from rows_b with no match in rows_a
        warnings: Dict with optional duplicate_keys_a / duplicate_keys_b counts
    """
    index_b, dups_b = build_key_index(rows_b, key_fields)
    index_a, dups_a = build_key_index(rows_a, key_fields)

    warnings = {}
    if dups_a:
        warnings['duplicate_keys_a'] = dups_a
    if dups_b:
        warnings['duplicate_keys_b'] = dups_b

    matched_pairs = []
    matched_b_indices = set()
    matched_a_indices = set()

    for i, row in enumerate(rows_a):
        key = make_key(row, key_fields)
        if key in index_b:
            j = index_b[key]
            matched_pairs.append((i, j))
            matched_b_indices.add(j)
            matched_a_indices.add(i)

    only_in_a = [i for i in range(len(rows_a)) if i not in matched_a_indices]
    only_in_b = [j for j in range(len(rows_b))
                 if j not in matched_b_indices]

    return matched_pairs, only_in_a, only_in_b, warnings


def fuzzy_match(rows_a: List[Dict], rows_b: List[Dict],
                key_fields: List[str],
                threshold: float = 0.8) -> Tuple[List[Tuple], List[int], List[int], Dict]:
    """
    Fuzzy key match using difflib.SequenceMatcher.

    For each row in A, finds the best match in B above `threshold`.
    Uses greedy matching (first-best, no global optimization).

    Raises ValueError if either dataset exceeds FUZZY_ROW_LIMIT to prevent O(n²) hangs.

    Returns same structure as exact_match (with warnings dict).
    """
    warnings = {}

    if len(rows_a) > FUZZY_ROW_LIMIT or len(rows_b) > FUZZY_ROW_LIMIT:
        raise ValueError(
            f"Fuzzy matching is limited to {FUZZY_ROW_LIMIT} rows per file to prevent timeout "
            f"(File A: {len(rows_a)} rows, File B: {len(rows_b)} rows). "
            f"Use exact matching for larger datasets."
        )

    keys_a = [make_key(row, key_fields) for row in rows_a]
    keys_b = [make_key(row, key_fields) for row in rows_b]
    keys_b_index = {key: j for j, key in enumerate(keys_b)}

    matched_pairs = []
    used_b = set()

    for i, key_a in enumerate(keys_a):
        # Try exact first via O(1) lookup
        j = keys_b_index.get(key_a)
        if j is not None and j not in used_b:
            matched_pairs.append((i, j))
            used_b.add(j)
            continue

        # Fuzzy fallback
        best_score = threshold
        best_j = None
        for j, key_b in enumerate(keys_b):
            if j in used_b:
                continue
            score = difflib.SequenceMatcher(None, key_a, key_b).ratio()
            if score > best_score:
                best_score = score
                best_j = j

        if best_j is not None:
            matched_pairs.append((i, best_j))
            used_b.add(best_j)

    matched_a = {p[0] for p in matched_pairs}
    matched_b = {p[1] for p in matched_pairs}

    only_in_a = [i for i in range(len(rows_a)) if i not in matched_a]
    only_in_b = [j for j in range(len(rows_b)) if j not in matched_b]

    return matched_pairs, only_in_a, only_in_b, warnings
