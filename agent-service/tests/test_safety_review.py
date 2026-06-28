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

        self.assertIn("## Mình chưa hỗ trợ chủ đề này", answer)
        self.assertIn("Mình chưa hỗ trợ **nội dung này**", answer)
        self.assertIn("Thử hỏi mình những câu như:", answer)
        self.assertIn("- Hôm nay World Cup có trận nào?", answer)
        self.assertIn("- Pick khóa trước trận bao lâu?", answer)
        self.assertIn("- Bảng xếp hạng hiện tại của tôi ra sao?", answer)
        self.assertNotIn("Argentina vs Mexico", answer)
        self.assertNotIn("foo vs bar", answer.lower())
        self.assertNotIn("**foo", answer.lower())

    def test_off_topic_returns_english_examples_for_english_message(self):
        answer = _fallback_answer(
            {"response_language": "English", "intent": "general_chat", "tool_results": {}},
            "Tell me about crypto trading",
        )

        self.assertIn("## I can't help with that topic yet", answer)
        self.assertIn("I can't help with **Tell me about crypto trading**", answer)
        self.assertIn("Try asking me things like:", answer)
        self.assertIn("- What World Cup matches are today?", answer)
        self.assertIn("- How do pick deadlines work?", answer)
        self.assertIn("- What is my current leaderboard snapshot?", answer)

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

        self.assertIn("## Matches for World Cup tomorrow", answer)
        self.assertIn("### Portugal vs Congo DR", answer)
        self.assertIn("- **Time:** 28/06 20:00", answer)
        self.assertIn("- **Location:** Miami", answer)

    def test_formats_fixture_window_in_user_timezone(self):
        answer = _fallback_answer(
            {
                "response_language": "Vietnamese",
                "request_metadata": {"client": {"timezone": "Asia/Ho_Chi_Minh"}},
                "tool_results": {
                    "fixture_window": {"label": "tomorrow", "timezone": "Asia/Ho_Chi_Minh"},
                    "fixtures": [
                        {
                            "home_team": {"name": "South Africa"},
                            "away_team": {"name": "Canada"},
                            "kickoff_at": "2026-06-28T19:00:00+00:00",
                            "stage": "round32",
                            "city": "Los Angeles (Inglewood)",
                            "status": "open",
                        }
                    ],
                },
            },
            "Ngày mai World Cup có trận nào?",
        )

        self.assertIn("## Trận đấu World Cup ngày mai", answer)
        self.assertIn("### South Africa vs Canada", answer)
        self.assertIn("- **Giờ:** 29/06 02:00", answer)
        self.assertIn("- **Vòng:** Vòng 32 đội", answer)
        self.assertIn("- **Địa điểm:** Los Angeles (Inglewood)", answer)
        self.assertIn("- **Trạng thái:** Đang mở dự đoán", answer)
        self.assertNotIn("| Giờ |", answer)
        self.assertNotIn("2026-06-28T19:00:00+00:00", answer)

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
        self.assertIn("Squad", answer)
        self.assertIn("Not available yet", answer)

    def test_team_context_answer_uses_only_available_match_rows(self):
        answer = _fallback_answer(
            {
                "response_language": "Vietnamese",
                "tool_results": {
                    "team_context": {
                        "team": {"name": "Spain", "fifa_rank": 2},
                        "squad_available": False,
                        "form_available": False,
                        "matches": [
                            {
                                "home_team_id": "ESP",
                                "away_team_id": "AUT",
                                "home_team": {"name": "Spain"},
                                "away_team": {"name": "Austria"},
                                "kickoff_at": "2026-07-03T19:00:00+00:00",
                                "stage": "round32",
                            }
                        ],
                    }
                },
            },
            "tây ban nha thế nào",
        )

        self.assertIn("Spain", answer)
        self.assertIn("Spain vs Austria", answer)
        self.assertIn("Chưa có dữ liệu", answer)
        self.assertNotIn("Brazil", answer)
        self.assertNotIn("Tổng kết", answer)

    def test_prediction_answer_includes_score_reason_and_natural_labels(self):
        answer = _fallback_answer(
            {
                "response_language": "Vietnamese",
                "request_metadata": {"client": {"timezone": "Asia/Ho_Chi_Minh"}},
                "intent": "prediction_help",
                "tool_results": {
                    "match": {
                        "home_team_id": "POR",
                        "away_team_id": "CRO",
                        "kickoff_at": "2026-07-02T23:00:00+00:00",
                        "stage": "round32",
                        "stadium": "BMO Field",
                        "status": "open",
                    },
                    "teams": {
                        "home": {"name": "Portugal", "short_name": "POR"},
                        "away": {"name": "Croatia", "short_name": "CRO"},
                    },
                    "prediction_signal": {"espn": {"home_win_pct": 52, "draw_pct": 27, "away_win_pct": 21}},
                },
            },
            "dự đoán cho tôi trận bồ đào nha và croatia",
        )

        self.assertIn("## Dự đoán: Portugal vs Croatia", answer)
        self.assertIn("### Tỉ số gợi ý", answer)
        self.assertIn("**Portugal 2-1 Croatia**", answer)
        self.assertIn("Portugal nhỉnh hơn theo ESPN", answer)
        self.assertIn("03/07 06:00", answer)
        self.assertIn("Đang mở dự đoán", answer)
        self.assertNotIn("POR vs CRO", answer)
        self.assertNotIn("open", answer)


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
