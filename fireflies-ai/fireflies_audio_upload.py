#!/usr/bin/env python3
"""Upload audio from a public HTTPS URL via Fireflies uploadAudio and poll for completion."""

from __future__ import annotations

import hashlib
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fireflies_api_common import (
    create_iso_utc_timestamp,
    create_transcripts_payload,
    execute_graphql_query,
    fetch_transcript_payload,
    upload_audio,
)
from fireflies_speaker_map_json import parse_speaker_map_json
from fireflies_transcript_rendering import create_speaker_map, merge_speaker_name_overrides
from fireflies_transcript_to_text import create_output_path, render_transcript_payload_to_file

DEFAULT_UPLOAD_TITLE = "Uploaded audio"
DEFAULT_POLL_INTERVAL_SECONDS = 15.0
DEFAULT_POLL_TIMEOUT_SECONDS = 3600.0
DEFAULT_EXISTING_LOOKBACK_DAYS = 2
MARKER_PREFIX = "ffcli:"
PLACEHOLDER_ATTENDEE_EMAIL_DOMAIN = "ff-cli.invalid"
PLACEHOLDER_PHONE_NUMBER = "0000000000"
TITLE_MAX_LENGTH = 256
CLIENT_REFERENCE_ID_MAX_LENGTH = 32
REQUIRED_AUDIO_URL_SCHEME = "https"


def validate_public_https_url(audio_url: str) -> None:
    parsed = urlparse(audio_url)
    if parsed.scheme != REQUIRED_AUDIO_URL_SCHEME or not parsed.netloc:
        raise SystemExit(
            "uploadAudio requires a direct https:// URL with a host (see Fireflies uploadAudio docs)."
        )


def create_upload_started_from_date() -> str:
    margin = timedelta(minutes=2)
    started_at = datetime.now(timezone.utc) - margin
    return create_iso_utc_timestamp(started_at)


def create_existing_search_from_date(existing_lookback_days: int) -> str:
    lookback = max(0, int(existing_lookback_days))
    started_at = datetime.now(timezone.utc) - timedelta(days=lookback)
    return create_iso_utc_timestamp(started_at)


def create_title_marker_token(audio_url: str, title: str, idempotency_key: str | None) -> str:
    """Create deterministic marker token to make upload retries idempotent."""
    marker_basis = (idempotency_key or "").strip() or f"{audio_url}\n{title.strip()}"
    return hashlib.sha256(marker_basis.encode("utf-8")).hexdigest()[:8]


def create_client_reference_id() -> str:
    raw = secrets.token_hex(16)
    return raw[:CLIENT_REFERENCE_ID_MAX_LENGTH]


def embed_title_marker(base_title: str, marker_token: str) -> str:
    suffix = f"[{MARKER_PREFIX}{marker_token}]"
    trimmed_base = base_title.strip()
    max_base_length = max(0, TITLE_MAX_LENGTH - len(suffix))
    if len(trimmed_base) > max_base_length:
        trimmed_base = trimmed_base[:max_base_length].rstrip()
    return f"{trimmed_base}{suffix}"


def build_attendees_from_speaker_map(speaker_map: dict[int, str]) -> list[dict[str, str]]:
    """Build Fireflies AudioUploadInput attendees from diarization id → name map.

    The public API matches attendees to CRM contacts; it does not assign diarization labels.
    Names are merged after transcription using merge_speaker_name_overrides.
    """
    attendees: list[dict[str, str]] = []
    for speaker_id in sorted(speaker_map.keys()):
        display_name = speaker_map[speaker_id]
        email_local = f"speaker{speaker_id}"
        attendees.append(
            {
                "displayName": display_name,
                "email": f"{email_local}@{PLACEHOLDER_ATTENDEE_EMAIL_DOMAIN}",
                "phoneNumber": PLACEHOLDER_PHONE_NUMBER,
            }
        )
    return attendees


def build_upload_input(
    *,
    audio_url: str,
    title_with_marker: str,
    speaker_map: dict[int, str],
    client_reference_id: str,
    custom_language: str | None,
    webhook_url: str | None,
) -> dict[str, Any]:
    input_data: dict[str, Any] = {
        "url": audio_url,
        "title": title_with_marker,
        "client_reference_id": client_reference_id,
    }
    if speaker_map:
        input_data["attendees"] = build_attendees_from_speaker_map(speaker_map)
    if custom_language:
        input_data["custom_language"] = custom_language
    if webhook_url:
        input_data["webhook_url"] = webhook_url
    return input_data


def parse_transcript_list_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    transcripts = payload.get("data", {}).get("transcripts")
    if not isinstance(transcripts, list):
        return []
    return [item for item in transcripts if isinstance(item, dict)]


def transcript_has_marker_title(item: dict[str, Any], marker_token: str) -> bool:
    title_text = str(item.get("title") or "")
    return f"{MARKER_PREFIX}{marker_token}" in title_text


def create_candidate_items(
    token: str,
    marker_token: str,
    from_date_iso: str,
) -> list[dict[str, Any]]:
    keyword = f"{MARKER_PREFIX}{marker_token}"
    payload = create_transcripts_payload(
        from_date=from_date_iso,
        keyword=keyword,
        limit=50,
        skip=0,
        to_date=None,
    )
    response = execute_graphql_query(token, payload)
    items = parse_transcript_list_items(response)
    if items:
        return items

    payload = create_transcripts_payload(
        from_date=from_date_iso,
        keyword=None,
        limit=50,
        skip=0,
        to_date=None,
    )
    response = execute_graphql_query(token, payload)
    return [
        item
        for item in parse_transcript_list_items(response)
        if transcript_has_marker_title(item, marker_token)
    ]


def create_sorted_marker_matches(items: list[dict[str, Any]], marker_token: str) -> list[dict[str, Any]]:
    matches = [item for item in items if transcript_has_marker_title(item, marker_token)]
    return sorted(matches, key=lambda item: int(item.get("date") or 0), reverse=True)


def find_matching_transcript_id(
    token: str,
    marker_token: str,
    from_date_iso: str,
    *,
    require_sentences: bool,
) -> str | None:
    items = create_candidate_items(token, marker_token, from_date_iso)
    for item in create_sorted_marker_matches(items, marker_token):
        transcript_id = item.get("id")
        if not transcript_id:
            continue
        if not require_sentences:
            return str(transcript_id)
        detail = fetch_transcript_payload(token, str(transcript_id))
        sentences = detail.get("sentences") or []
        if isinstance(sentences, list) and len(sentences) > 0:
            return str(transcript_id)
    return None


def poll_until_transcript_ready(
    token: str,
    marker_token: str,
    from_date_iso: str,
    *,
    poll_interval_seconds: float,
    timeout_seconds: float,
) -> str:
    deadline_monotonic = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline_monotonic:
        transcript_id = find_matching_transcript_id(
            token,
            marker_token,
            from_date_iso,
            require_sentences=True,
        )
        if transcript_id is not None:
            return transcript_id

        time.sleep(poll_interval_seconds)

    raise SystemExit(
        "Timed out waiting for Fireflies to finish transcription. "
        "Use fireflies_transcripts_cli.py list to locate the meeting by title."
    )


def save_transcript_json_file(
    output_directory: Path,
    transcript_identifier: str,
    transcript_payload: dict[str, Any],
) -> Path:
    output_directory.mkdir(parents=True, exist_ok=True)
    safe_id = "".join(character if character.isalnum() else "-" for character in transcript_identifier)
    output_path = output_directory / f"fireflies-transcript-{safe_id}.json"
    output_path.write_text(
        json.dumps(transcript_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output_path


def run_upload_url_flow(
    *,
    token: str,
    audio_url: str,
    title: str,
    speaker_map_json: str,
    custom_language: str | None,
    webhook_url: str | None,
    wait_for_transcript: bool,
    poll_interval_seconds: float,
    poll_timeout_seconds: float,
    existing_lookback_days: int,
    idempotency_key: str | None,
    output_directory: Path | None,
    render_format: str | None,
) -> None:
    validate_public_https_url(audio_url)
    speaker_map = parse_speaker_map_json(speaker_map_json)
    resolved_title = title or DEFAULT_UPLOAD_TITLE
    marker_token = create_title_marker_token(audio_url, resolved_title, idempotency_key)
    client_reference_id = create_client_reference_id()
    title_with_marker = embed_title_marker(resolved_title, marker_token)
    from_date_iso = create_upload_started_from_date()
    existing_from_date_iso = create_existing_search_from_date(existing_lookback_days)

    existing_transcript_id = find_matching_transcript_id(
        token,
        marker_token,
        existing_from_date_iso,
        require_sentences=wait_for_transcript,
    )
    if existing_transcript_id is not None:
        print(f"Reusing existing transcript: {existing_transcript_id}")
        print(f"Title (with marker): {title_with_marker}")
        print(f"marker_token: {marker_token}")
        if not wait_for_transcript:
            print("Skipping upload because a matching transcript already exists in Fireflies.")
            return
        transcript_id = existing_transcript_id
    else:
        upload_input = build_upload_input(
            audio_url=audio_url,
            title_with_marker=title_with_marker,
            speaker_map=speaker_map,
            client_reference_id=client_reference_id,
            custom_language=custom_language,
            webhook_url=webhook_url,
        )

        upload_result = upload_audio(token, upload_input)
        if not upload_result.get("success"):
            raise SystemExit("uploadAudio did not succeed: " + json.dumps(upload_result, indent=2))

        print(f"Upload accepted: {upload_result.get('message', '')}".strip())
        print(f"Title (with marker): {title_with_marker}")
        print(f"marker_token: {marker_token}")
        print(f"client_reference_id: {client_reference_id}")

        if not wait_for_transcript:
            print(
                "Polling skipped. After processing completes, list transcripts and download by id, "
                "or re-run with --wait."
            )
            return

        transcript_id = poll_until_transcript_ready(
            token,
            marker_token,
            from_date_iso,
            poll_interval_seconds=poll_interval_seconds,
            timeout_seconds=poll_timeout_seconds,
        )
    print(f"transcript_id: {transcript_id}")

    transcript_payload = fetch_transcript_payload(token, transcript_id)
    api_speaker_map = create_speaker_map(transcript_payload)
    merged_speaker_map = merge_speaker_name_overrides(api_speaker_map, speaker_map)

    json_path: Path | None = None
    if output_directory is not None:
        json_path = save_transcript_json_file(output_directory, transcript_id, transcript_payload)
        print(f"saved_json: {json_path}")

    if render_format:
        if output_directory is None:
            raise SystemExit("--render requires --output-dir for output placement.")
        if json_path is None:
            json_path = save_transcript_json_file(output_directory, transcript_id, transcript_payload)
        output_path = create_output_path(json_path, None, render_format)
        render_transcript_payload_to_file(
            transcript_payload=transcript_payload,
            speaker_map=merged_speaker_map,
            output_path=output_path,
            selected_format=render_format,
        )
        print(f"rendered: {output_path}")
