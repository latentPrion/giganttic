#!/usr/bin/env python3
"""Convert a Fireflies transcript JSON file into SRT or PDF with speaker names."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Sequence

from fireflies_api_common import ENVIRONMENT_TOKEN_KEY, fetch_transcript_payload, require_token
from fireflies_transcript_rendering import (
    create_speaker_map,
    create_srt_content,
    create_timestamped_text,
    extract_transcript_identifier,
    load_transcript_file,
)


DEFAULT_FORMAT = "srt"
OUTPUT_SUFFIX_BY_FORMAT = {
    "pdf": ".pdf",
    "srt": ".srt",
}
PDF_BINARY_NAMES = {
    "enscript": "enscript",
    "ps2pdf": "ps2pdf",
}
SUPPORTED_FORMATS = tuple(OUTPUT_SUFFIX_BY_FORMAT.keys())


def parse_arguments(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a saved Fireflies transcript JSON file, resolve speaker names via the "
            "Fireflies API, and write SRT or PDF output."
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
        help="Optional output file path. Defaults next to the input file.",
    )
    parser.add_argument(
        "-f",
        "--format",
        choices=SUPPORTED_FORMATS,
        default=DEFAULT_FORMAT,
        help=f"Output format. Default: {DEFAULT_FORMAT}.",
    )
    return parser.parse_args(argv)


def create_output_path(
    input_path: Path,
    explicit_output_path: str | None,
    selected_format: str,
) -> Path:
    if explicit_output_path:
        return Path(explicit_output_path)
    return input_path.with_name(input_path.stem + OUTPUT_SUFFIX_BY_FORMAT[selected_format])


def create_rendered_content(
    transcript_payload: dict,
    speaker_map: dict[int, str],
    selected_format: str,
) -> str:
    if selected_format == "srt":
        return create_srt_content(transcript_payload, speaker_map)
    if selected_format == "pdf":
        return create_timestamped_text(transcript_payload, speaker_map)
    raise SystemExit(f"Unsupported output format: {selected_format}")


def write_output_file(output_path: Path, content: str) -> None:
    output_path.write_text(content, encoding="utf-8")


def create_output_directory(output_path: Path) -> Path:
    output_directory = output_path.parent
    output_directory.mkdir(parents=True, exist_ok=True)
    return output_directory


def create_required_pdf_binary_map() -> dict[str, str]:
    resolved_binaries: dict[str, str] = {}
    for binary_key, binary_name in PDF_BINARY_NAMES.items():
        resolved_binary = shutil.which(binary_name)
        if resolved_binary is None:
            raise SystemExit(
                "Missing PDF conversion dependency. Install Ubuntu packages "
                "'enscript' and 'ghostscript', then retry."
            )
        resolved_binaries[binary_key] = resolved_binary
    return resolved_binaries


def convert_text_to_pdf(output_path: Path, text_content: str) -> None:
    required_binaries = create_required_pdf_binary_map()
    output_directory = create_output_directory(output_path)

    with tempfile.TemporaryDirectory(dir=output_directory) as temporary_directory_name:
        temporary_directory = Path(temporary_directory_name)
        text_path = temporary_directory / "transcript.txt"
        postscript_path = temporary_directory / "transcript.ps"

        text_path.write_text(text_content, encoding="utf-8")
        run_enscript(required_binaries["enscript"], text_path, postscript_path)
        run_ps2pdf(required_binaries["ps2pdf"], postscript_path, output_path)


def run_enscript(enscript_binary: str, text_path: Path, postscript_path: Path) -> None:
    command = [
        enscript_binary,
        "-B",
        "-q",
        "-p",
        str(postscript_path),
        str(text_path),
    ]
    run_pdf_command(command, "enscript")


def run_ps2pdf(ps2pdf_binary: str, postscript_path: Path, output_path: Path) -> None:
    command = [ps2pdf_binary, str(postscript_path), str(output_path)]
    run_pdf_command(command, "ps2pdf")


def run_pdf_command(command: list[str], command_name: str) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        error_output = (error.stderr or error.stdout or "").strip()
        raise SystemExit(f"{command_name} failed while generating PDF: {error_output}") from error


def write_rendered_output(output_path: Path, rendered_content: str, selected_format: str) -> None:
    create_output_directory(output_path)
    if selected_format == "pdf":
        convert_text_to_pdf(output_path, rendered_content)
        return
    write_output_file(output_path, rendered_content)


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    token = require_token(arguments.token)
    input_path = Path(arguments.input_path)
    output_path = create_output_path(input_path, arguments.output_path, arguments.format)

    local_transcript_payload = load_transcript_file(input_path)
    transcript_identifier = extract_transcript_identifier(local_transcript_payload)
    api_transcript_payload = fetch_transcript_payload(token, transcript_identifier)
    speaker_map = create_speaker_map(api_transcript_payload)
    rendered_content = create_rendered_content(api_transcript_payload, speaker_map, arguments.format)

    write_rendered_output(output_path, rendered_content, arguments.format)
    print(output_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
