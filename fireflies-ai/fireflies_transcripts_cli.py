#!/usr/bin/env python3
"""CLI for listing Fireflies transcripts and downloading available assets.

This script uses the official Fireflies GraphQL API with a bearer token.
It lists transcript records and exposes an interactive download flow for the
documented asset URLs on each transcript.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fireflies_api_common import (
    DEFAULT_LIMIT,
    DEFAULT_TIMEOUT_SECONDS,
    ENVIRONMENT_TOKEN_KEY,
    create_relative_from_date,
    create_transcripts_payload,
    execute_graphql_query,
    fetch_transcript_payload,
    require_token,
)

DEFAULT_OUTPUT_DIRECTORY = Path("pm/downloads")
USER_AGENT = "giganttic-fireflies-cli/0.1"
INDEX_SEPARATOR = "-" * 92
TRANSCRIPT_PAGE_KIND = "transcript"
AUDIO_KIND = "audio"
VIDEO_KIND = "video"
ALL_KINDS = "all"
DOWNLOAD_ASSET_CHOICES = [AUDIO_KIND, VIDEO_KIND, TRANSCRIPT_PAGE_KIND, ALL_KINDS]


@dataclass(frozen=True)
class TranscriptRecord:
    audio_url: str | None
    date_epoch_millis: int | None
    date_string: str | None
    duration_minutes: float | None
    identifier: str
    organizer_email: str | None
    title: str
    transcript_url: str | None
    video_url: str | None


@dataclass(frozen=True)
class DownloadResult:
    kind: str
    message: str
    success: bool


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "List Fireflies transcripts and interactively download available "
            "transcript/audio/video assets."
        ),
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
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Number of transcripts to fetch. Default: {DEFAULT_LIMIT}.",
    )
    parser.add_argument(
        "--skip",
        type=int,
        default=0,
        help="Number of transcript records to skip before listing.",
    )
    parser.add_argument(
        "--from-date",
        dest="from_date",
        help="Optional ISO 8601 lower bound, e.g. 2026-01-01T00:00:00.000Z.",
    )
    parser.add_argument(
        "--to-date",
        dest="to_date",
        help="Optional ISO 8601 upper bound, e.g. 2026-03-09T23:59:59.999Z.",
    )
    parser.add_argument(
        "--last-n-days",
        dest="last_n_days",
        type=int,
        help=(
            "List meetings from the preceding N days by computing a UTC from-date. "
            "Cannot be combined with --from-date."
        ),
    )
    parser.add_argument(
        "--keyword",
        help="Optional Fireflies transcript keyword filter.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIRECTORY),
        help=f"Directory for downloaded files. Default: {DEFAULT_OUTPUT_DIRECTORY}.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List transcript records only.")

    interactive_parser = subparsers.add_parser(
        "interactive",
        help="Interactively choose transcripts and resource types to download.",
    )
    interactive_parser.add_argument(
        "--default-assets",
        default=TRANSCRIPT_PAGE_KIND,
        help=(
            "Comma-separated default asset selection for interactive mode. "
            f"Supported values: {', '.join(DOWNLOAD_ASSET_CHOICES)}."
        ),
    )

    download_parser = subparsers.add_parser(
        "download",
        help="Download by transcript indexes from the current fetched page.",
    )
    download_parser.add_argument(
        "selection",
        help="Indexes/ranges from the listed page, e.g. 1,3-5.",
    )
    download_parser.add_argument(
        "--assets",
        default=TRANSCRIPT_PAGE_KIND,
        help=(
            "Comma-separated asset selection to download. "
            f"Supported values: {', '.join(DOWNLOAD_ASSET_CHOICES)}."
        ),
    )

    return parser.parse_args()


def validate_date_filters(arguments: argparse.Namespace) -> None:
    if arguments.from_date and arguments.last_n_days is not None:
        raise SystemExit("Use either --from-date or --last-n-days, not both.")
    if arguments.last_n_days is not None and arguments.last_n_days < 0:
        raise SystemExit("--last-n-days must be zero or greater.")


def create_from_date(arguments: argparse.Namespace) -> str | None:
    if arguments.from_date:
        return arguments.from_date
    return create_relative_from_date(arguments.last_n_days)


def build_graphql_payload(arguments: argparse.Namespace) -> dict[str, Any]:
    return create_transcripts_payload(
        from_date=create_from_date(arguments),
        keyword=arguments.keyword,
        limit=arguments.limit,
        skip=arguments.skip,
        to_date=arguments.to_date,
    )


def create_transcript_record(item: dict[str, Any]) -> TranscriptRecord:
    return TranscriptRecord(
        audio_url=item.get("audio_url"),
        date_epoch_millis=create_optional_int(item.get("date")),
        date_string=item.get("dateString"),
        duration_minutes=item.get("duration"),
        identifier=str(item["id"]),
        organizer_email=item.get("organizer_email"),
        title=item.get("title") or "(Untitled transcript)",
        transcript_url=item.get("transcript_url"),
        video_url=item.get("video_url"),
    )


def create_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_transcripts_response(payload: dict[str, Any]) -> list[TranscriptRecord]:
    transcript_items = payload.get("data", {}).get("transcripts", [])
    return [create_transcript_record(item) for item in transcript_items]


def create_presence_marker(value: str | None) -> str:
    return "yes" if value else "no"


def create_duration_label(duration_minutes: float | None) -> str:
    if duration_minutes is None:
        return "-"
    return f"{duration_minutes:g}"


def truncate_text(value: str, length: int) -> str:
    if len(value) <= length:
        return value
    return value[: max(0, length - 1)] + "…"


def print_transcripts(records: list[TranscriptRecord]) -> None:
    if not records:
        print("No transcript records matched the current query.")
        return

    header = (
        "Idx  Date                      Title                          "
        "Audio  Video  Transcript"
    )
    print(header)
    print(INDEX_SEPARATOR)

    for index, record in enumerate(records, start=1):
        date_label = truncate_text(record.date_string or "-", 24)
        title_label = truncate_text(record.title, 30)
        print(
            f"{index:>3}  {date_label:<24}  {title_label:<30}  "
            f"{create_presence_marker(record.audio_url):<5}  "
            f"{create_presence_marker(record.video_url):<5}  "
            f"{create_presence_marker(record.transcript_url):<10}"
        )

    print()


def print_transcript_details(records: list[TranscriptRecord]) -> None:
    for index, record in enumerate(records, start=1):
        print(f"[{index}] {record.title}")
        print(f"    id: {record.identifier}")
        print(f"    date_epoch_millis: {record.date_epoch_millis or '-'}")
        print(f"    date: {record.date_string or '-'}")
        print(f"    duration_minutes: {create_duration_label(record.duration_minutes)}")
        print(f"    organizer_email: {record.organizer_email or '-'}")
        print(f"    transcript_url: {record.transcript_url or '-'}")
        print(f"    audio_url: {record.audio_url or '-'}")
        print(f"    video_url: {record.video_url or '-'}")
        print()


def parse_selection(selection: str, maximum_index: int) -> list[int]:
    indexes: set[int] = set()

    for token in [part.strip() for part in selection.split(",") if part.strip()]:
        if "-" in token:
            start_token, end_token = token.split("-", maxsplit=1)
            start_index = int(start_token)
            end_index = int(end_token)
            for index in range(min(start_index, end_index), max(start_index, end_index) + 1):
                validate_index(index, maximum_index)
                indexes.add(index)
            continue

        index = int(token)
        validate_index(index, maximum_index)
        indexes.add(index)

    return sorted(indexes)


def validate_index(index: int, maximum_index: int) -> None:
    if index < 1 or index > maximum_index:
        raise SystemExit(
            f"Selection index {index} is out of range. Valid values are 1..{maximum_index}."
        )


def prompt_for_selection(maximum_index: int) -> str:
    return input(
        "Enter transcript indexes to download (e.g. 1,3-5), or press Enter to cancel: "
    ).strip()


def parse_asset_selection(value: str) -> list[str]:
    raw_tokens = [token.strip() for token in value.split(",") if token.strip()]
    if not raw_tokens:
        raise SystemExit("At least one asset kind must be selected.")

    if ALL_KINDS in raw_tokens:
        if len(raw_tokens) > 1:
            raise SystemExit(f"Use '{ALL_KINDS}' by itself, not combined with other assets.")
        return [AUDIO_KIND, VIDEO_KIND, TRANSCRIPT_PAGE_KIND]

    invalid_tokens = sorted(set(raw_tokens) - set(DOWNLOAD_ASSET_CHOICES))
    if invalid_tokens:
        raise SystemExit(
            f"Unsupported asset kind(s): {', '.join(invalid_tokens)}. "
            f"Expected values from {DOWNLOAD_ASSET_CHOICES}."
        )

    ordered_assets: list[str] = []
    for supported_asset in [TRANSCRIPT_PAGE_KIND, AUDIO_KIND, VIDEO_KIND]:
        if supported_asset in raw_tokens:
            ordered_assets.append(supported_asset)
    return ordered_assets


def prompt_for_download_assets(default_assets: str) -> list[str]:
    entered_assets = input(
        "Choose asset kinds "
        f"({', '.join(DOWNLOAD_ASSET_CHOICES)}) [{default_assets}]: "
    ).strip()
    if not entered_assets:
        return parse_asset_selection(default_assets)
    return parse_asset_selection(entered_assets)


def create_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-")
    return slug or "transcript"


def infer_extension_from_content_type(content_type: str | None) -> str:
    normalized_content_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_content_type.startswith("audio/"):
        return f".{normalized_content_type.split('/', maxsplit=1)[1]}"
    if normalized_content_type.startswith("video/"):
        return f".{normalized_content_type.split('/', maxsplit=1)[1]}"
    if normalized_content_type == "application/json":
        return ".json"
    if normalized_content_type in {"text/html", "application/xhtml+xml"}:
        return ".html"
    if normalized_content_type in {"text/plain", "text/markdown"}:
        return ".txt"
    return ".bin"


def create_output_path(
    output_directory: Path,
    record: TranscriptRecord,
    kind: str,
    content_type: str | None,
    source_url: str | None,
) -> Path:
    output_directory.mkdir(parents=True, exist_ok=True)
    source_name = Path(urlparse(source_url or "").path).name
    source_extension = Path(source_name).suffix
    extension = source_extension or infer_extension_from_content_type(content_type)
    file_stem = create_slug(f"{record.date_string or 'undated'}-{record.title}-{kind}")
    return output_directory / f"{file_stem}{extension}"


def create_download_request(token: str, url: str, kind: str) -> Request:
    accept_header = "*/*"
    if kind == TRANSCRIPT_PAGE_KIND:
        accept_header = "application/json, text/html;q=0.9, */*;q=0.8"
    return Request(
        url,
        headers={
            "Accept": accept_header,
            "Authorization": f"Bearer {token}",
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )


def download_url(token: str, url: str, kind: str) -> tuple[bytes, str | None, str]:
    request = create_download_request(token, url, kind)

    try:
        with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            content = response.read()
            content_type = response.headers.get("Content-Type")
            final_url = response.geturl()
    except HTTPError as error:
        raise RuntimeError(
            f"download failed with HTTP {error.code}: "
            f"{error.read().decode('utf-8', errors='replace')}"
        ) from error
    except URLError as error:
        raise RuntimeError(f"download failed: {error}") from error

    return content, content_type, final_url


def resolve_resource_url(record: TranscriptRecord, kind: str) -> str | None:
    if kind == AUDIO_KIND:
        return record.audio_url
    if kind == VIDEO_KIND:
        return record.video_url
    if kind == TRANSCRIPT_PAGE_KIND:
        return record.transcript_url
    return None


def save_downloaded_content(
    content: bytes,
    content_type: str | None,
    final_url: str,
    kind: str,
    output_directory: Path,
    record: TranscriptRecord,
) -> Path:
    output_path = create_output_path(output_directory, record, kind, content_type, final_url)
    output_path.write_bytes(content)
    return output_path


def save_transcript_payload(
    output_directory: Path,
    record: TranscriptRecord,
    transcript_payload: dict[str, Any],
) -> Path:
    output_path = create_output_path(
        output_directory=output_directory,
        record=record,
        kind=TRANSCRIPT_PAGE_KIND,
        content_type="application/json",
        source_url=None,
    )
    output_path.write_text(
        json.dumps(transcript_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output_path


def download_single_kind(
    token: str,
    output_directory: Path,
    record: TranscriptRecord,
    kind: str,
) -> DownloadResult:
    if kind == TRANSCRIPT_PAGE_KIND:
        try:
            transcript_payload = fetch_transcript_payload(token, record.identifier)
        except RuntimeError as error:
            return DownloadResult(kind=kind, message=str(error), success=False)
        except SystemExit as error:
            return DownloadResult(kind=kind, message=str(error), success=False)

        output_path = save_transcript_payload(output_directory, record, transcript_payload)
        return DownloadResult(kind=kind, message=f"saved to {output_path}", success=True)

    resource_url = resolve_resource_url(record, kind)
    if not resource_url:
        return DownloadResult(kind=kind, message="no URL available", success=False)

    try:
        content, content_type, final_url = download_url(token, resource_url, kind)
    except RuntimeError as error:
        return DownloadResult(kind=kind, message=str(error), success=False)

    output_path = save_downloaded_content(
        content=content,
        content_type=content_type,
        final_url=final_url,
        kind=kind,
        output_directory=output_directory,
        record=record,
    )
    return DownloadResult(kind=kind, message=f"saved to {output_path}", success=True)


def download_selected_records(
    token: str,
    output_directory: Path,
    records: Iterable[TranscriptRecord],
    assets: Iterable[str],
) -> int:
    attempted_downloads = 0
    selected_assets = list(assets)

    for record in records:
        print(f"Downloading assets for '{record.title}' ({record.identifier})")
        for selected_asset in selected_assets:
            result = download_single_kind(token, output_directory, record, selected_asset)
            status = "ok" if result.success else "skip"
            print(f"  [{status}] {selected_asset}: {result.message}")
            attempted_downloads += 1
        print()

    return attempted_downloads


def run_list_command(records: list[TranscriptRecord]) -> None:
    print_transcripts(records)
    print_transcript_details(records)


def run_download_command(
    arguments: argparse.Namespace,
    records: list[TranscriptRecord],
    token: str,
) -> None:
    if not records:
        raise SystemExit("No transcripts available to download from the current page.")

    selected_indexes = parse_selection(arguments.selection, len(records))
    selected_records = [records[index - 1] for index in selected_indexes]
    output_directory = Path(arguments.output_dir)
    download_selected_records(
        token,
        output_directory,
        selected_records,
        parse_asset_selection(arguments.assets),
    )


def run_interactive_command(
    arguments: argparse.Namespace,
    records: list[TranscriptRecord],
    token: str,
) -> None:
    print_transcripts(records)
    print_transcript_details(records)

    if not records:
        return

    selection = prompt_for_selection(len(records))
    if not selection:
        print("Cancelled.")
        return

    selected_indexes = parse_selection(selection, len(records))
    selected_records = [records[index - 1] for index in selected_indexes]
    selected_assets = prompt_for_download_assets(arguments.default_assets)
    output_directory = Path(arguments.output_dir)
    download_selected_records(token, output_directory, selected_records, selected_assets)


def main() -> int:
    arguments = parse_arguments()
    validate_date_filters(arguments)
    token = require_token(arguments.token)
    payload = build_graphql_payload(arguments)
    response = execute_graphql_query(token, payload)
    records = parse_transcripts_response(response)

    if arguments.command == "list":
        run_list_command(records)
        return 0

    if arguments.command == "download":
        run_download_command(arguments, records, token)
        return 0

    if arguments.command == "interactive":
        run_interactive_command(arguments, records, token)
        return 0

    raise SystemExit(f"Unsupported command: {arguments.command}")


if __name__ == "__main__":
    sys.exit(main())
