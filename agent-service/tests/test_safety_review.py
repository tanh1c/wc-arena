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

    def test_instructs_response_language_from_context(self):
        prompt = _build_prompt({"intent": "match_preview", "response_language": "Vietnamese", "memories": [], "tool_results": {}}, "argentina đá trận tiếp theo khi nào")

        self.assertIn("Respond in Vietnamese", prompt)


class FallbackAnswerTest(unittest.TestCase):
    def test_unmatched_matchup_returns_localized_examples(self):
        answer = _fallback_answer(
            {
                "response_language": "Vietnamese",
                "tool_results": {
                    "unmatched_matchup": {
                        "teams": ["foo", "bar"],
                        "suggestions": ["Portugal", "Argentina"],
                    }
                }
            },
            "foo vs bar",
        )

        self.assertIn("## Tôi không hỗ trợ hỏi về foo vs bar", answer)
        self.assertIn("Bạn có thể hỏi:", answer)
        self.assertIn("- Vòng 32 đội hôm nay có trận gì?", answer)
        self.assertNotIn("Argentina, Portugal", answer)

    def test_off_topic_returns_english_examples_for_english_message(self):
        answer = _fallback_answer(
            {"response_language": "English", "intent": "general_chat", "tool_results": {}},
            "Tell me about crypto trading",
        )

        self.assertIn("## I can't help with Tell me about crypto trading", answer)
        self.assertIn("You can ask:", answer)
        self.assertIn("- What round of 32 matches are today?", answer)

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

        self.assertIn("## World Cup fixtures for tomorrow", answer)
        self.assertIn("| Time | Match | Stage | Location | Status |", answer)
        self.assertIn("| 2026-06-28 20:00 +00:00 | Portugal vs Congo DR | - | Miami | - |", answer)

    def test_formats_fixture_window_in_user_timezone(self):
        answer = _fallback_answer(
            {
                "request_metadata": {"client": {"timezone": "Asia/Ho_Chi_Minh"}},
                "tool_results": {
                    "fixture_window": {"label": "tomorrow", "timezone": "Asia/Ho_Chi_Minh"},
                    "fixtures": [
                        {
                            "home_team": {"name": "Portugal"},
                            "away_team": {"name": "Congo DR"},
                            "kickoff_at": "2026-06-28T20:00:00+00:00",
                            "city": "Miami",
                        }
                    ],
                },
            },
            "cho tôi biết trận ngày mai",
        )

        self.assertIn("2026-06-29 03:00", answer)
        self.assertIn("+07", answer)
        self.assertNotIn("2026-06-28T20:00:00+00:00", answer)

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
