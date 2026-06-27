import unittest
from unittest.mock import patch

from app.tools.football_tools import extract_matchup_query, normalize_team_query, resolve_team_id_from_rows


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


if __name__ == "__main__":
    unittest.main()
