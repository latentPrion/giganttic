#!/usr/bin/env python3
"""Parse user-supplied speaker label JSON for Fireflies CLI tools."""

from __future__ import annotations

import json
from typing import Any

SPEAKER_KEY_CANDIDATES = frozenset({"speaker", "speaker_id", "id", "index"})
NAME_KEY_CANDIDATES = frozenset({"name", "displayName", "display_name", "label"})


def parse_speaker_map_json(raw: str) -> dict[int, str]:
    """Parse JSON mapping diarization speaker indices to display names.

    Accepted shapes:
    - [{"speaker": 0, "name": "Alice"}, ...]
    - {"0": "Alice", "1": "Bob"}
    """
    if not raw.strip():
        return {}
    try:
        parsed: Any = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Speaker map JSON is not valid JSON: {error}") from error

    if isinstance(parsed, list):
        return _parse_speaker_map_list(parsed)
    if isinstance(parsed, dict):
        return _parse_speaker_map_dict(parsed)

    raise SystemExit("Speaker map JSON must be an array of objects or an object.")


def _parse_speaker_map_list(items: list[Any]) -> dict[int, str]:
    result: dict[int, str] = {}
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise SystemExit(f"Speaker map entry {index} must be an object.")
        speaker_id = _extract_speaker_id(item)
        name = _extract_display_name(item)
        if speaker_id is None or not name:
            raise SystemExit(
                f"Speaker map entry {index} needs a speaker id field "
                f"({', '.join(sorted(SPEAKER_KEY_CANDIDATES))}) and a name."
            )
        result[speaker_id] = name
    return result


def _parse_speaker_map_dict(mapping: dict[Any, Any]) -> dict[int, str]:
    result: dict[int, str] = {}
    for raw_key, raw_value in mapping.items():
        speaker_id = _coerce_int_key(raw_key)
        if speaker_id is None:
            raise SystemExit(f"Invalid speaker key in speaker map object: {raw_key!r}.")
        if not isinstance(raw_value, str) or not raw_value.strip():
            raise SystemExit(f"Speaker {speaker_id} must map to a non-empty string name.")
        result[speaker_id] = raw_value.strip()
    return result


def _extract_speaker_id(item: dict[str, Any]) -> int | None:
    for candidate in SPEAKER_KEY_CANDIDATES:
        if candidate in item:
            return _coerce_int_key(item[candidate])
    return None


def _extract_display_name(item: dict[str, Any]) -> str | None:
    for candidate in NAME_KEY_CANDIDATES:
        if candidate not in item:
            continue
        value = item[candidate]
        if value is None:
            return None
        text = str(value).strip()
        return text or None
    return None


def _coerce_int_key(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip(), 10)
        except ValueError:
            return None
    return None
