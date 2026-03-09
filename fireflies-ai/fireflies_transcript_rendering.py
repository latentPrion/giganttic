#!/usr/bin/env python3
"""Transcript rendering helpers shared by Fireflies tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fireflies_api_common import format_timestamp_label


DEFAULT_FINAL_SUBTITLE_DURATION_SECONDS = 2.0
DEFAULT_SPEAKER_PREFIX = "Speaker"
MINIMUM_SUBTITLE_DURATION_SECONDS = 0.25
SRT_MILLISECONDS_SEPARATOR = ","
UNKNOWN_VALUE_LABEL = "-"


def load_transcript_file(input_path: Path) -> dict[str, Any]:
    try:
        return json.loads(input_path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SystemExit(f"Transcript JSON file not found: {input_path}") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"Transcript JSON file is not valid JSON: {error}") from error


def extract_transcript_identifier(transcript_payload: dict[str, Any]) -> str:
    identifier = transcript_payload.get("id")
    if not identifier:
        raise SystemExit("Transcript JSON file does not contain an 'id' field.")
    return str(identifier)


def create_speaker_map(api_transcript_payload: dict[str, Any]) -> dict[int, str]:
    speaker_map: dict[int, str] = {}
    for speaker in api_transcript_payload.get("speakers", []):
        speaker_id = create_optional_int(speaker.get("id"))
        speaker_name = normalize_optional_text(speaker.get("name"))
        if speaker_id is None or not speaker_name:
            continue
        speaker_map[speaker_id] = speaker_name
    return speaker_map


def create_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def create_speaker_label(sentence: dict[str, Any], speaker_map: dict[int, str]) -> str:
    api_sentence_name = normalize_optional_text(sentence.get("speaker_name"))
    if api_sentence_name:
        return api_sentence_name

    speaker_id = create_optional_int(sentence.get("speaker_id"))
    if speaker_id is None:
        return f"{DEFAULT_SPEAKER_PREFIX}?"
    return speaker_map.get(speaker_id, f"{DEFAULT_SPEAKER_PREFIX}{speaker_id}")


def create_header_lines(transcript_payload: dict[str, Any]) -> list[str]:
    participants = transcript_payload.get("participants") or []
    return [
        f"Title: {transcript_payload.get('title', '(Untitled transcript)')}",
        f"Transcript ID: {transcript_payload.get('id', UNKNOWN_VALUE_LABEL)}",
        f"Date (epoch ms): {transcript_payload.get('date', UNKNOWN_VALUE_LABEL)}",
        f"Duration (minutes): {transcript_payload.get('duration', UNKNOWN_VALUE_LABEL)}",
        "Participants: "
        + (", ".join(str(participant) for participant in participants) if participants else UNKNOWN_VALUE_LABEL),
        "",
        "Transcript:",
        "",
    ]


def create_timestamped_text(transcript_payload: dict[str, Any], speaker_map: dict[int, str]) -> str:
    lines = create_header_lines(transcript_payload)
    for sentence in transcript_payload.get("sentences", []):
        lines.append(create_timestamped_sentence_line(sentence, speaker_map))
    return "\n".join(lines) + "\n"


def create_timestamped_sentence_line(
    sentence: dict[str, Any],
    speaker_map: dict[int, str],
) -> str:
    timestamp_label = format_timestamp_label(float(sentence.get("start_time", 0.0)))
    speaker_label = create_speaker_label(sentence, speaker_map)
    sentence_text = normalize_optional_text(sentence.get("text")) or ""
    return f"[{timestamp_label}] {speaker_label}: {sentence_text}"


def create_srt_content(transcript_payload: dict[str, Any], speaker_map: dict[int, str]) -> str:
    sentences = list(transcript_payload.get("sentences", []))
    blocks = [create_srt_block(index, sentence, sentences, speaker_map) for index, sentence in enumerate(sentences)]
    return "".join(blocks)


def create_srt_block(
    sentence_index: int,
    sentence: dict[str, Any],
    sentences: list[dict[str, Any]],
    speaker_map: dict[int, str],
) -> str:
    start_seconds = float(sentence.get("start_time", 0.0))
    end_seconds = create_subtitle_end_time(sentence_index, start_seconds, sentences)
    speaker_label = create_speaker_label(sentence, speaker_map)
    sentence_text = normalize_optional_text(sentence.get("text")) or ""
    return (
        f"{sentence_index + 1}\n"
        f"{format_srt_timestamp(start_seconds)} --> {format_srt_timestamp(end_seconds)}\n"
        f"{speaker_label}: {sentence_text}\n\n"
    )


def create_subtitle_end_time(
    sentence_index: int,
    start_seconds: float,
    sentences: list[dict[str, Any]],
) -> float:
    if sentence_index + 1 >= len(sentences):
        return start_seconds + DEFAULT_FINAL_SUBTITLE_DURATION_SECONDS

    next_start_seconds = float(sentences[sentence_index + 1].get("start_time", start_seconds))
    return max(next_start_seconds, start_seconds + MINIMUM_SUBTITLE_DURATION_SECONDS)


def format_srt_timestamp(seconds: float) -> str:
    base_label = format_timestamp_label(seconds)
    return base_label.replace(".", SRT_MILLISECONDS_SEPARATOR)
