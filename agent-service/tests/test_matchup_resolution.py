import unittest
from unittest.mock import patch

from datetime import datetime, timezone

from app.tools.football_tools import (
    extract_ambiguous_matchup_query,
    extract_matchup_query,
    extract_team_schedule_query,
    is_fixture_list_query,
    is_reminder_query,
    is_team_schedule_query,
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

    def test_accepts_case_insensitive_llm_team_id(self):
        teams = [{"id": "POR", "name": "Portugal", "short_name": "POR", "country_code": "PT"}]
        with patch("app.graph.nodes._call_llm", return_value='{"team_id": "por", "confidence": "high"}'):
            self.assertEqual(resolve_team_id_from_rows("bồ đào nha", teams), "POR")

    def test_accepts_llm_matched_name_from_database_rows(self):
        teams = [{"id": "POR", "name": "Portugal", "short_name": "POR", "country_code": "PT"}]
        with patch("app.graph.nodes._call_llm", return_value='{"team_id": null, "matched_name": "Portugal", "confidence": "high"}'):
            self.assertEqual(resolve_team_id_from_rows("bo dao nha", teams), "POR")

    def test_rejects_low_confidence_llm_resolution(self):
        teams = [{"id": "POR", "name": "Portugal", "short_name": "POR", "country_code": "PT"}]
        with patch("app.graph.nodes._call_llm", return_value='{"team_id": "POR", "confidence": "low"}'):
            self.assertIsNone(resolve_team_id_from_rows("unknown", teams))

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

    def test_resolves_short_vietnamese_tomorrow_window(self):
        window = resolve_relative_date_window(
            "mai có trận",
            now_utc=datetime(2026, 6, 27, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(window["label"], "tomorrow")
        self.assertEqual(window["start_iso"], "2026-06-28T00:00:00+00:00")
        self.assertEqual(window["end_iso"], "2026-06-29T00:00:00+00:00")

    def test_resolves_tomorrow_window_in_user_timezone(self):
        window = resolve_relative_date_window(
            "fixtures tomorrow",
            now_utc=datetime(2026, 6, 27, 20, tzinfo=timezone.utc),
            request_metadata={"client": {"timezone": "Asia/Ho_Chi_Minh"}},
        )

        self.assertEqual(window["label"], "tomorrow")
        self.assertEqual(window["timezone"], "Asia/Ho_Chi_Minh")
        self.assertEqual(window["start_iso"], "2026-06-28T17:00:00+00:00")
        self.assertEqual(window["end_iso"], "2026-06-29T17:00:00+00:00")

    def test_detects_fixture_list_query(self):
        self.assertTrue(is_fixture_list_query("lịch thi đấu hôm nay có trận nào"))

    def test_detects_short_vietnamese_tomorrow_fixture_query(self):
        self.assertTrue(is_fixture_list_query("mai có trận"))

    def test_detects_reminder_query(self):
        self.assertTrue(is_reminder_query("nhắc tôi các trận sắp diễn ra"))

    def test_extracts_head_to_head_matchup(self):
        self.assertEqual(extract_matchup_query("lịch sử đối đầu POR vs COD"), ("POR", "COD"))

    def test_extracts_ambiguous_vietnamese_matchup(self):
        self.assertEqual(extract_ambiguous_matchup_query("bồ đào nha và colombia"), ("bồ đào nha", "colombia"))

    def test_explicit_connector_does_not_use_ambiguous_matchup(self):
        self.assertIsNone(extract_ambiguous_matchup_query("bồ đào nha với colombia"))
        self.assertEqual(extract_matchup_query("bồ đào nha với colombia"), ("bồ đào nha", "colombia"))

    def test_detects_team_next_match_query(self):
        self.assertTrue(is_team_schedule_query("argentina đá trận tiếp theo khi nào"))
        self.assertEqual(extract_team_schedule_query("argentina đá trận tiếp theo khi nào"), "argentina")

    def test_extracts_english_team_next_match_query(self):
        self.assertTrue(is_team_schedule_query("when is Argentina next match"))
        self.assertEqual(extract_team_schedule_query("when is Argentina next match"), "Argentina")


if __name__ == "__main__":
    unittest.main()
