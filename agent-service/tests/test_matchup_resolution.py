import unittest
from unittest.mock import patch

from datetime import datetime, timezone

from app.tools.football_tools import (
    extract_matchup_query,
    is_fixture_list_query,
    is_reminder_query,
    normalize_team_query,
    resolve_relative_date_window,
    resolve_team_id_from_rows,
)


class MatchupResolutionTest(unittest.TestCase):
    def test_normalizes_vietnamese_team_name(self):
        self.assertEqual(normalize_team_query("Bồ Đào Nha"), "bo dao nha")

    def test_resolves_exact_database_team_name(self):
        teams = [{"id": "COL", "name": "Colombia", "short_name": "COL", "country_code": "CO"}]
        self.assertEqual(resolve_team_id_from_rows("colombia", teams), "COL")

    def test_uses_llm_for_multilingual_or_nickname_resolution(self):
        teams = [{"id": "ARG", "name": "Argentina", "short_name": "ARG", "country_code": "AR"}]
        with patch("app.graph.nodes._call_llm", return_value='{"team_id": "ARG"}'):
            self.assertEqual(resolve_team_id_from_rows("á căn đình", teams), "ARG")

    def test_rejects_llm_team_id_not_in_database_rows(self):
        teams = [{"id": "ARG", "name": "Argentina", "short_name": "ARG", "country_code": "AR"}]
        with patch("app.graph.nodes._call_llm", return_value='{"team_id": "BRA"}'):
            self.assertIsNone(resolve_team_id_from_rows("Brazil", teams))

    def test_extracts_matchup_from_vs_question(self):
        self.assertEqual(extract_matchup_query("phân tích bồ đào nha vs colombia"), ("bồ đào nha", "colombia"))

    def test_extracts_vietnamese_with_matchup_and_trims_question(self):
        self.assertEqual(
            extract_matchup_query("bồ đào nha với congo bạn nghĩ tỉ số bao nhiêu"),
            ("bồ đào nha", "congo"),
        )

    def test_extracts_code_matchup_and_trims_prediction_request(self):
        self.assertEqual(
            extract_matchup_query("POR vs COD dự đoán trận này cho tôi"),
            ("POR", "COD"),
        )

    def test_resolves_tomorrow_window(self):
        window = resolve_relative_date_window(
            "cho tôi biết trận ngày mai",
            now_utc=datetime(2026, 6, 27, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(window["label"], "tomorrow")
        self.assertEqual(window["start_iso"], "2026-06-28T00:00:00+00:00")
        self.assertEqual(window["end_iso"], "2026-06-29T00:00:00+00:00")

    def test_detects_fixture_list_query(self):
        self.assertTrue(is_fixture_list_query("lịch thi đấu hôm nay có trận nào"))

    def test_detects_reminder_query(self):
        self.assertTrue(is_reminder_query("nhắc tôi các trận sắp diễn ra"))

    def test_extracts_head_to_head_matchup(self):
        self.assertEqual(extract_matchup_query("lịch sử đối đầu POR vs COD"), ("POR", "COD"))


if __name__ == "__main__":
    unittest.main()
