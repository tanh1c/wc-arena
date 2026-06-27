import unittest

from app.graph.nodes import _build_prompt, _fallback_answer, safety_review_text


class BuildPromptTest(unittest.TestCase):
    def test_limits_answers_to_we_speak_football_domain(self):
        prompt = _build_prompt({"intent": "general_chat", "memories": [], "tool_results": {}}, "Tell me about stock trading")

        self.assertIn("Only answer questions related to We Speak Football", prompt)
        self.assertIn("World Cup football", prompt)
        self.assertIn("politely redirect", prompt)

    def test_includes_current_time(self):
        prompt = _build_prompt({"intent": "general_chat", "memories": [], "tool_results": {}}, "What matches are live?")

        self.assertRegex(prompt, r"Current time: \d{4}-\d{2}-\d{2}T")
        self.assertIn("+00:00", prompt)

    def test_requires_tool_context_for_factual_football_data(self):
        prompt = _build_prompt({"intent": "team_context", "memories": [], "tool_results": {}}, "đội hình Argentina thế nào")

        self.assertIn("source of truth", prompt)
        self.assertIn("Do not invent", prompt)
        self.assertIn("squads", prompt)


class FallbackAnswerTest(unittest.TestCase):
    def test_asks_for_clarification_when_matchup_unmatched(self):
        answer = _fallback_answer(
            {
                "tool_results": {
                    "unmatched_matchup": {
                        "teams": ["foo", "bar"],
                        "suggestions": ["Portugal", "Argentina"],
                    }
                }
            },
            "foo vs bar",
        )

        self.assertIn("Could you clarify the team names", answer)
        self.assertIn("Portugal", answer)

    def test_lists_fixture_window_from_tool_context(self):
        answer = _fallback_answer(
            {
                "tool_results": {
                    "fixture_window": {"label": "tomorrow"},
                    "fixtures": [
                        {
                            "home_team": {"name": "Portugal"},
                            "away_team": {"name": "Congo DR"},
                            "kickoff_at": "2026-06-28T20:00:00+00:00",
                            "city": "Miami",
                        }
                    ],
                }
            },
            "cho tôi biết trận ngày mai",
        )

        self.assertIn("tomorrow", answer)
        self.assertIn("Portugal vs Congo DR", answer)

    def test_team_context_does_not_fabricate_unavailable_squad(self):
        answer = _fallback_answer(
            {
                "tool_results": {
                    "team_context": {
                        "team": {"name": "Argentina", "fifa_rank": 1},
                        "squad_available": False,
                        "matches": [],
                    }
                }
            },
            "đội hình Argentina thế nào",
        )

        self.assertIn("Argentina", answer)
        self.assertIn("squad", answer.lower())
        self.assertIn("not available", answer.lower())


class SafetyReviewTextTest(unittest.TestCase):
    def test_removes_gambling_framing(self):
        text = "Check the odds before you wager on this betting angle."

        reviewed = safety_review_text(text)

        self.assertNotIn("odds", reviewed.lower())
        self.assertNotIn("wager", reviewed.lower())
        self.assertNotIn("betting", reviewed.lower())
        self.assertIn("prediction angle", reviewed.lower())


if __name__ == "__main__":
    unittest.main()
