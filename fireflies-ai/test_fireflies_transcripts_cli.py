#!/usr/bin/env python3
"""Unit tests for the Fireflies transcript listing CLI."""

from __future__ import annotations

import unittest
from io import StringIO
from unittest.mock import patch

import fireflies_transcripts_cli as cli


SAMPLE_RECORDS = [
    cli.TranscriptRecord(
        audio_url=None,
        date_epoch_millis=None,
        date_string="2026-03-12T00:00:00.000Z",
        duration_minutes=10.0,
        identifier="tx-1",
        organizer_email=None,
        title="Transcript One",
        transcript_url="https://example.invalid/tx-1",
        video_url=None,
    ),
    cli.TranscriptRecord(
        audio_url=None,
        date_epoch_millis=None,
        date_string="2026-03-11T00:00:00.000Z",
        duration_minutes=11.0,
        identifier="tx-2",
        organizer_email=None,
        title="Transcript Two",
        transcript_url="https://example.invalid/tx-2",
        video_url=None,
    ),
]


class FirefliesTranscriptsCliTests(unittest.TestCase):
    def test_parse_arguments_defaults_to_first_page(self) -> None:
        arguments = cli.parse_arguments(["list"])
        self.assertEqual(arguments.page, 1)
        self.assertFalse(arguments.detail)

    def test_create_effective_skip_uses_page_number(self) -> None:
        arguments = cli.parse_arguments(["--limit", "25", "--page", "3", "list"])
        cli.validate_date_filters(arguments)
        self.assertEqual(cli.create_effective_skip(arguments), 50)

    def test_build_graphql_payload_uses_page_number_when_present(self) -> None:
        arguments = cli.parse_arguments(["--limit", "10", "--page", "4", "list"])
        cli.validate_date_filters(arguments)
        payload = cli.build_graphql_payload(arguments)
        self.assertEqual(payload["variables"]["limit"], 10)
        self.assertEqual(payload["variables"]["skip"], 30)

    def test_skip_and_non_default_page_are_mutually_exclusive(self) -> None:
        arguments = cli.parse_arguments(["--skip", "25", "--page", "2", "list"])
        with self.assertRaises(SystemExit) as error_context:
            cli.validate_date_filters(arguments)
        self.assertIn("--page or --skip", str(error_context.exception))

    def test_page_must_be_positive(self) -> None:
        arguments = cli.parse_arguments(["--page", "0", "list"])
        with self.assertRaises(SystemExit) as error_context:
            cli.validate_date_filters(arguments)
        self.assertIn("--page must be a positive integer", str(error_context.exception))

    def test_display_index_base_uses_pagination_offset(self) -> None:
        arguments = cli.parse_arguments(["--limit", "25", "--page", "2", "list"])
        cli.validate_date_filters(arguments)
        self.assertEqual(cli.create_display_index_base(arguments), 26)

    def test_parse_selection_uses_displayed_index_range(self) -> None:
        selected_indexes = cli.parse_selection("26,27", 26, 27)
        self.assertEqual(selected_indexes, [26, 27])

    def test_print_transcripts_uses_offset_indexes(self) -> None:
        output = StringIO()
        with patch("sys.stdout", output):
            cli.print_transcripts(SAMPLE_RECORDS, display_index_base=26)
        rendered_output = output.getvalue()
        self.assertIn(" 26  ", rendered_output)
        self.assertIn(" 27  ", rendered_output)

    def test_run_download_command_maps_display_indexes_back_to_page_records(self) -> None:
        arguments = cli.parse_arguments(
            ["--limit", "25", "--page", "2", "download", "26,27", "--assets", "transcript"]
        )
        cli.validate_date_filters(arguments)
        page_two_payload = {
            "data": {
                "transcripts": [
                    {
                        "id": "tx-1",
                        "title": "Transcript One",
                        "date": None,
                        "dateString": "2026-03-12T00:00:00.000Z",
                        "organizer_email": None,
                        "duration": 10.0,
                        "transcript_url": "https://example.invalid/tx-1",
                        "audio_url": None,
                        "video_url": None,
                    },
                    {
                        "id": "tx-2",
                        "title": "Transcript Two",
                        "date": None,
                        "dateString": "2026-03-11T00:00:00.000Z",
                        "organizer_email": None,
                        "duration": 11.0,
                        "transcript_url": "https://example.invalid/tx-2",
                        "audio_url": None,
                        "video_url": None,
                    },
                ]
            }
        }
        with patch("fireflies_transcripts_cli.execute_graphql_query", return_value=page_two_payload):
            with patch("fireflies_transcripts_cli.download_selected_records") as download_mock:
                cli.run_download_command(arguments, SAMPLE_RECORDS, "token")

        selected_records = download_mock.call_args.args[2]
        self.assertEqual([record.identifier for record in selected_records], ["tx-1", "tx-2"])

    def test_run_download_command_fetches_needed_page_for_absolute_indexes(self) -> None:
        arguments = cli.parse_arguments(["--limit", "25", "download", "26,27", "--assets", "audio"])
        cli.validate_date_filters(arguments)
        page_two_payload = {
            "data": {
                "transcripts": [
                    {
                        "id": "tx-26",
                        "title": "Transcript 26",
                        "date": None,
                        "dateString": "2026-03-12T00:00:00.000Z",
                        "organizer_email": None,
                        "duration": 10.0,
                        "transcript_url": "https://example.invalid/tx-26",
                        "audio_url": "https://example.invalid/audio-26",
                        "video_url": None,
                    },
                    {
                        "id": "tx-27",
                        "title": "Transcript 27",
                        "date": None,
                        "dateString": "2026-03-11T00:00:00.000Z",
                        "organizer_email": None,
                        "duration": 11.0,
                        "transcript_url": "https://example.invalid/tx-27",
                        "audio_url": "https://example.invalid/audio-27",
                        "video_url": None,
                    },
                ]
            }
        }
        with patch("fireflies_transcripts_cli.execute_graphql_query", return_value=page_two_payload) as query_mock:
            with patch("fireflies_transcripts_cli.download_selected_records") as download_mock:
                cli.run_download_command(arguments, [], "token")

        payload = query_mock.call_args.args[1]
        self.assertEqual(payload["variables"]["skip"], 25)
        selected_records = download_mock.call_args.args[2]
        self.assertEqual([record.identifier for record in selected_records], ["tx-26", "tx-27"])

    def test_run_list_command_defaults_to_compact_table_only(self) -> None:
        arguments = cli.parse_arguments(["list"])
        output = StringIO()
        with patch("sys.stdout", output):
            cli.run_list_command(arguments, SAMPLE_RECORDS, 1)

        rendered_output = output.getvalue()
        self.assertIn("Idx  Date", rendered_output)
        self.assertNotIn("id: tx-1", rendered_output)

    def test_run_list_command_with_detail_shows_detail_only(self) -> None:
        arguments = cli.parse_arguments(["--detail", "list"])
        output = StringIO()
        with patch("sys.stdout", output):
            cli.run_list_command(arguments, SAMPLE_RECORDS, 1)

        rendered_output = output.getvalue()
        self.assertIn("id: tx-1", rendered_output)
        self.assertNotIn("Idx  Date", rendered_output)


if __name__ == "__main__":
    unittest.main()
