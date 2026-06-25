import unittest
from unittest.mock import patch

from app.picks.picker import parse_pick, decide_pick


class ParsePickTest(unittest.TestCase):
    def test_parses_valid_json(self):
        result = parse_pick('{"home_score": 2, "away_score": 1, "confidence": 70}')
        self.assertEqual(result, {"home_score": 2, "away_score": 1, "confidence": 70})

    def test_parses_json_embedded_in_text(self):
        raw = 'Sure! Here is my pick: {"home_score": 0, "away_score": 0, "confidence": 55} good luck'
        result = parse_pick(raw)
        self.assertEqual(result, {"home_score": 0, "away_score": 0, "confidence": 55})

    def test_rejects_negative_score(self):
        self.assertIsNone(parse_pick('{"home_score": -1, "away_score": 2, "confidence": 50}'))

    def test_rejects_non_integer_score(self):
        self.assertIsNone(parse_pick('{"home_score": 1.5, "away_score": 2, "confidence": 50}'))

    def test_rejects_missing_field(self):
        self.assertIsNone(parse_pick('{"home_score": 1, "away_score": 2}'))

    def test_rejects_garbage(self):
        self.assertIsNone(parse_pick('I cannot decide'))

    def test_clamps_confidence_out_of_range(self):
        result = parse_pick('{"home_score": 1, "away_score": 1, "confidence": 999}')
        self.assertEqual(result["confidence"], 100)
        result2 = parse_pick('{"home_score": 1, "away_score": 1, "confidence": -5}')
        self.assertEqual(result2["confidence"], 0)


class DecidePickTest(unittest.TestCase):
    def test_returns_parsed_pick_from_llm(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value='{"home_score": 3, "away_score": 0, "confidence": 80}'):
            result = decide_pick(context)
        self.assertEqual(result, {"home_score": 3, "away_score": 0, "confidence": 80})

    def test_returns_none_when_llm_unparseable(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value="no idea"):
            result = decide_pick(context)
        self.assertIsNone(result)

    def test_returns_none_when_llm_unavailable(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value=None):
            result = decide_pick(context)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
