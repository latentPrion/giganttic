#!/usr/bin/env python3
"""Shared Fireflies API helpers for CLI scripts in pm/."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://api.fireflies.ai/graphql"
DEFAULT_LIMIT = 25
DEFAULT_TIMEOUT_SECONDS = 60
ENVIRONMENT_TOKEN_KEY = "FIREFLIES_API_KEY"
ISO_8601_UTC_SUFFIX = "Z"
USER_AGENT = "giganttic-fireflies-cli/0.1"

TRANSCRIPTS_QUERY = """
query Transcripts(
  $limit: Int
  $skip: Int
  $fromDate: DateTime
  $toDate: DateTime
  $keyword: String
) {
  transcripts(
    limit: $limit
    skip: $skip
    fromDate: $fromDate
    toDate: $toDate
    keyword: $keyword
  ) {
    id
    title
    date
    dateString
    organizer_email
    duration
    transcript_url
    audio_url
    video_url
  }
}
""".strip()

TRANSCRIPT_DETAIL_QUERY = """
query TranscriptDetail($id: String!) {
  transcript(id: $id) {
    id
    title
    transcript_url
    duration
    date
    participants
    sentences {
      text
      speaker_id
      speaker_name
      start_time
    }
    speakers {
      id
      name
    }
    summary {
      keywords
      action_items
    }
  }
}
""".strip()


def create_iso_utc_timestamp(value: datetime) -> str:
    utc_value = value.astimezone(timezone.utc)
    return utc_value.isoformat(timespec="milliseconds").replace("+00:00", ISO_8601_UTC_SUFFIX)


def create_relative_from_date(last_n_days: int | None) -> str | None:
    if last_n_days is None:
        return None
    return create_iso_utc_timestamp(datetime.now(timezone.utc) - timedelta(days=last_n_days))


def create_api_request(token: str, payload: dict[str, Any]) -> Request:
    encoded_payload = json.dumps(payload).encode("utf-8")
    return Request(
        API_URL,
        data=encoded_payload,
        headers=create_request_headers(token),
        method="POST",
    )


def create_request_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }


def execute_graphql_query(token: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = create_api_request(token, payload)

    try:
        with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            raw_response = response.read().decode("utf-8")
    except HTTPError as error:
        raise SystemExit(
            f"Fireflies API request failed with HTTP {error.code}: "
            f"{error.read().decode('utf-8', errors='replace')}"
        ) from error
    except URLError as error:
        raise SystemExit(f"Unable to reach Fireflies API: {error}") from error

    decoded_response = json.loads(raw_response)
    graphql_errors = decoded_response.get("errors")
    if graphql_errors:
        raise SystemExit(
            "Fireflies API returned GraphQL errors:\n"
            + json.dumps(graphql_errors, indent=2)
        )

    return decoded_response


def create_transcripts_payload(
    *,
    from_date: str | None,
    keyword: str | None,
    limit: int,
    skip: int,
    to_date: str | None,
) -> dict[str, Any]:
    return {
        "query": TRANSCRIPTS_QUERY,
        "variables": {
            "fromDate": from_date,
            "keyword": keyword,
            "limit": limit,
            "skip": skip,
            "toDate": to_date,
        },
    }


def create_transcript_detail_payload(transcript_identifier: str) -> dict[str, Any]:
    return {
        "query": TRANSCRIPT_DETAIL_QUERY,
        "variables": {
            "id": transcript_identifier,
        },
    }


def fetch_transcript_payload(token: str, transcript_identifier: str) -> dict[str, Any]:
    response = execute_graphql_query(token, create_transcript_detail_payload(transcript_identifier))
    transcript_payload = response.get("data", {}).get("transcript")
    if not isinstance(transcript_payload, dict):
        raise RuntimeError("Fireflies transcript detail query returned no transcript payload.")
    return transcript_payload


def require_token(token: str | None) -> str:
    if token:
        return token
    raise SystemExit(
        "A Fireflies bearer token is required. Pass --token or set "
        f"{ENVIRONMENT_TOKEN_KEY}."
    )


def format_timestamp_label(seconds: float) -> str:
    total_milliseconds = int(round(seconds * 1000))
    total_seconds, milliseconds = divmod(total_milliseconds, 1000)
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}"
