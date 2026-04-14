#!/usr/bin/env python3
"""Unit tests for Fireflies URL upload helpers."""

from __future__ import annotations

import unittest
from unittest.mock import patch

import fireflies_audio_upload as upload


class FirefliesAudioUploadTests(unittest.TestCase):
    def test_create_title_marker_token_is_deterministic_for_same_input(self) -> None:
        marker_a = upload.create_title_marker_token("https://example.com/a.mp3", "Meeting", None)
        marker_b = upload.create_title_marker_token("https://example.com/a.mp3", "Meeting", None)
        self.assertEqual(marker_a, marker_b)

    def test_embed_title_marker_respects_max_length(self) -> None:
        long_title = "x" * 300
        embedded = upload.embed_title_marker(long_title, "aabbccdd")
        self.assertLessEqual(len(embedded), upload.TITLE_MAX_LENGTH)
        self.assertIn("[ffcli:aabbccdd]", embedded)

    def test_build_attendees_orders_by_speaker_id(self) -> None:
        attendees = upload.build_attendees_from_speaker_map({2: "Second", 0: "Zero"})
        self.assertEqual(attendees[0]["displayName"], "Zero")
        self.assertEqual(attendees[1]["displayName"], "Second")
        self.assertIn("speaker0@", attendees[0]["email"])

    def test_validate_public_https_url_accepts_https(self) -> None:
        upload.validate_public_https_url("https://example.com/a.mp3")

    def test_validate_public_https_url_rejects_http(self) -> None:
        with self.assertRaises(SystemExit):
            upload.validate_public_https_url("http://example.com/a.mp3")

    def test_poll_finds_transcript_with_sentences(self) -> None:
        marker_token = "abcddddd"
        list_payload = {
            "data": {
                "transcripts": [
                    {
                        "id": "tx-99",
                        "title": f"Meeting [{upload.MARKER_PREFIX}{marker_token}]",
                    }
                ]
            }
        }
        detail_payload = {
            "id": "tx-99",
            "sentences": [{"text": "Hi", "speaker_id": 0, "start_time": 0.0}],
            "speakers": [],
        }
        with patch("fireflies_audio_upload.execute_graphql_query", return_value=list_payload):
            with patch("fireflies_audio_upload.fetch_transcript_payload", return_value=detail_payload):
                transcript_id = upload.poll_until_transcript_ready(
                    "token",
                    marker_token,
                    "2026-01-01T00:00:00.000Z",
                    poll_interval_seconds=0.01,
                    timeout_seconds=1.0,
                )
        self.assertEqual(transcript_id, "tx-99")

    def test_find_matching_transcript_id_returns_latest_match(self) -> None:
        marker_token = "abcd1234"
        list_payload = {
            "data": {
                "transcripts": [
                    {"id": "tx-old", "title": f"One [{upload.MARKER_PREFIX}{marker_token}]", "date": 100},
                    {"id": "tx-new", "title": f"Two [{upload.MARKER_PREFIX}{marker_token}]", "date": 200},
                ]
            }
        }
        with patch("fireflies_audio_upload.execute_graphql_query", return_value=list_payload):
            transcript_id = upload.find_matching_transcript_id(
                "token",
                marker_token,
                "2026-01-01T00:00:00.000Z",
                require_sentences=False,
            )
        self.assertEqual(transcript_id, "tx-new")


if __name__ == "__main__":
    unittest.main()
