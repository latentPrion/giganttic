#!/usr/bin/env python3
"""Convert a Fireflies transcript JSON file into timestamped text with speaker names."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from fireflies_api_common import (
    ENVIRONMENT_TOKEN_KEY,
    fetch_transcript_payload,
    format_timestamp_label,
    require_token,
)


DEFAULT_OUTPUT_SUFFIX = ".timestamped.named.txt"
DEFAULT_SPEAKER_PREFIX = "Speaker"
JSON_INDENT = 2
UNKNOWN_VALUE_LABEL = "-"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a saved Fireflies transcript JSON file, resolve speaker names via the "
            "Fireflies API, and write a timestamped plain text transcript."
        ),
    )
    parser.add_argument(
        "input_path",
        help="Path to a saved Fireflies transcript JSON file.",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get(ENVIRONMENT_TOKEN_KEY),
        help=(
            "Fireflies bearer token. Defaults to the "
            f"{ENVIRONMENT_TOKEN_KEY} environment variable."
        ),
    )
    parser.add_argument(
        "-o",
        "--output-path",
        help="Optional output text file path. Defaults next to the input file.",
    )
    return parser.parse_args()


def load_transcript_file(input_path: Path) -> dict[str, Any]:
    try:
        return json.loads(input_path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SystemExit(f"Transcript JSON file not found: {input_path}") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"Transcript JSON file is not valid JSON: {error}") from error


def create_output_path(input_path: Path, explicit_output_path: str | None) -> Path:
    if explicit_output_path:
        return Path(explicit_output_path)
    return input_path.with_name(input_path.stem + DEFAULT_OUTPUT_SUFFIX)


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


def create_sentence_lines(
    transcript_payload: dict[str, Any],
    speaker_map: dict[int, str],
) -> list[str]:
    sentence_lines: list[str] = []
    for sentence in transcript_payload.get("sentences", []):
        sentence_lines.append(create_sentence_line(sentence, speaker_map))
    return sentence_lines


def create_sentence_line(sentence: dict[str, Any], speaker_map: dict[int, str]) -> str:
    timestamp_label = format_timestamp_label(float(sentence.get("start_time", 0.0)))
    speaker_label = create_speaker_label(sentence, speaker_map)
    sentence_text = normalize_optional_text(sentence.get("text")) or ""
    return f"[{timestamp_label}] {speaker_label}: {sentence_text}"


def create_speaker_label(sentence: dict[str, Any], speaker_map: dict[int, str]) -> str:
    api_sentence_name = normalize_optional_text(sentence.get("speaker_name"))
    if api_sentence_name:
        return api_sentence_name

    speaker_id = create_optional_int(sentence.get("speaker_id"))
    if speaker_id is None:
        return f"{DEFAULT_SPEAKER_PREFIX}?"
    return speaker_map.get(speaker_id, f"{DEFAULT_SPEAKER_PREFIX}{speaker_id}")


def render_timestamped_text(
    transcript_payload: dict[str, Any],
    speaker_map: dict[int, str],
) -> str:
    lines = create_header_lines(transcript_payload)
    lines.extend(create_sentence_lines(transcript_payload, speaker_map))
    return "\n".join(lines) + "\n"


def write_output_file(output_path: Path, content: str) -> None:
    output_path.write_text(content, encoding="utf-8")


def main() -> int:
    arguments = parse_arguments()
    token = require_token(arguments.token)
    input_path = Path(arguments.input_path)
    output_path = create_output_path(input_path, arguments.output_path)

    local_transcript_payload = load_transcript_file(input_path)
    transcript_identifier = extract_transcript_identifier(local_transcript_payload)
    api_transcript_payload = fetch_transcript_payload(token, transcript_identifier)
    speaker_map = create_speaker_map(api_transcript_payload)
    rendered_text = render_timestamped_text(api_transcript_payload, speaker_map)

    write_output_file(output_path, rendered_text)
    print(output_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
