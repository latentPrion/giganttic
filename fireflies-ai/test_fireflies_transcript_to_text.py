#!/usr/bin/env python3
"""Unit tests for the Fireflies transcript converter."""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

import fireflies_transcript_to_text as converter
from fireflies_transcript_rendering import (
    DEFAULT_FINAL_SUBTITLE_DURATION_SECONDS,
    create_speaker_map,
    create_srt_content,
    format_srt_timestamp,
)


SAMPLE_TRANSCRIPT_PAYLOAD = {
    "date": 1772568000000,
    "duration": 26.38,
    "id": "tx-1",
    "participants": ["user@example.com"],
    "sentences": [
        {"speaker_id": 0, "start_time": 0.08, "text": "Hello there."},
        {"speaker_id": 1, "start_time": 1.2, "text": "General Kenobi."},
    ],
    "speakers": [
        {"id": 0, "name": "Alice"},
    ],
    "title": "Example Transcript",
}


class FirefliesTranscriptToTextTests(unittest.TestCase):
    def test_parse_arguments_defaults_to_srt(self) -> None:
        arguments = converter.parse_arguments(["example.json"])
        self.assertEqual(arguments.format, "srt")

    def test_parse_arguments_accepts_pdf(self) -> None:
        arguments = converter.parse_arguments(["-f", "pdf", "example.json"])
        self.assertEqual(arguments.format, "pdf")

    def test_create_output_path_uses_srt_suffix_by_default(self) -> None:
        output_path = converter.create_output_path(Path("example.json"), None, "srt")
        self.assertEqual(output_path, Path("example.srt"))

    def test_create_output_path_uses_pdf_suffix_for_pdf_format(self) -> None:
        output_path = converter.create_output_path(Path("example.json"), None, "pdf")
        self.assertEqual(output_path, Path("example.pdf"))

    def test_srt_rendering_uses_resolved_name_and_fallback_speaker_label(self) -> None:
        speaker_map = create_speaker_map(SAMPLE_TRANSCRIPT_PAYLOAD)
        srt_content = create_srt_content(SAMPLE_TRANSCRIPT_PAYLOAD, speaker_map)

        self.assertIn("Alice: Hello there.", srt_content)
        self.assertIn("Speaker1: General Kenobi.", srt_content)
        self.assertIn("00:00:00,080 --> 00:00:01,200", srt_content)

    def test_srt_rendering_uses_default_final_duration(self) -> None:
        speaker_map = create_speaker_map(SAMPLE_TRANSCRIPT_PAYLOAD)
        srt_content = create_srt_content(SAMPLE_TRANSCRIPT_PAYLOAD, speaker_map)
        expected_end = 1.2 + DEFAULT_FINAL_SUBTITLE_DURATION_SECONDS
        self.assertIn(
            f"00:00:01,200 --> {format_srt_timestamp(expected_end)}",
            srt_content,
        )

    def test_missing_pdf_dependencies_raise_clear_error(self) -> None:
        with patch("fireflies_transcript_to_text.shutil.which", return_value=None):
            with self.assertRaises(SystemExit) as error_context:
                converter.create_required_pdf_binary_map()

        self.assertIn("enscript", str(error_context.exception))
        self.assertIn("ghostscript", str(error_context.exception))

    def test_pdf_command_uses_requested_output_path(self) -> None:
        with patch(
            "fireflies_transcript_to_text.create_required_pdf_binary_map",
            return_value={"enscript": "/usr/bin/enscript", "ps2pdf": "/usr/bin/ps2pdf"},
        ):
            with patch("fireflies_transcript_to_text.run_enscript") as run_enscript_mock:
                with patch("fireflies_transcript_to_text.run_ps2pdf") as run_ps2pdf_mock:
                    converter.convert_text_to_pdf(Path("out/result.pdf"), "hello")

        run_enscript_mock.assert_called_once()
        run_ps2pdf_mock.assert_called_once()
        self.assertEqual(run_ps2pdf_mock.call_args.args[2], Path("out/result.pdf"))


if __name__ == "__main__":
    unittest.main()
