#!/usr/bin/env python3
"""Unit tests for speaker map JSON parsing."""

from __future__ import annotations

import unittest

from fireflies_speaker_map_json import parse_speaker_map_json


class FirefliesSpeakerMapJsonTests(unittest.TestCase):
    def test_parse_object_form(self) -> None:
        parsed = parse_speaker_map_json('{"0": "Alpha", "1": "Beta"}')
        self.assertEqual(parsed, {0: "Alpha", 1: "Beta"})

    def test_parse_array_form(self) -> None:
        raw = '[{"speaker": 0, "name": "One"}, {"speaker_id": 2, "displayName": "Three"}]'
        parsed = parse_speaker_map_json(raw)
        self.assertEqual(parsed, {0: "One", 2: "Three"})

    def test_empty_array(self) -> None:
        self.assertEqual(parse_speaker_map_json("[]"), {})

    def test_invalid_json_exits(self) -> None:
        with self.assertRaises(SystemExit):
            parse_speaker_map_json("not-json")


if __name__ == "__main__":
    unittest.main()
