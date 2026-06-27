import unittest

from app.graph.nodes import _build_prompt, _fallback_answer, safety_review_text


class BuildPromptTest(unittest.TestCase):
    def test_limits_answers_to_we_speak_football_domain(self):
        prompt = _build_prompt({"intent": "general_chat", "memories": [], "tool_results": {}}, "Tell me about stock trading")

        self.assertIn("Only answer questions related to We Speak Football", prompt)
        self.assertIn("World Cup football", prompt)
        self.assertIn("politely redirect", prompt)


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
