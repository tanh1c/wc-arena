import unittest

from app.graph.nodes import safety_review_text


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
