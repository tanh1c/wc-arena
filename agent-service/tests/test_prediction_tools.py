import unittest
from unittest.mock import MagicMock, patch

from app.tools.prediction_tools import list_unpicked_matches, derive_outcome


class DeriveOutcomeTest(unittest.TestCase):
    def test_home_win(self):
        self.assertEqual(derive_outcome(2, 1), "home")

    def test_away_win(self):
        self.assertEqual(derive_outcome(0, 3), "away")

    def test_draw(self):
        self.assertEqual(derive_outcome(1, 1), "draw")


class ListUnpickedMatchesTest(unittest.TestCase):
    def test_filters_out_already_picked_matches(self):
        client = MagicMock()

        matches_data = [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}]
        predictions_data = [{"match_id": "m2"}]

        def table_side_effect(name):
            tbl = MagicMock()
            if name == "matches":
                tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.execute.return_value.data = matches_data
            elif name == "predictions":
                tbl.select.return_value.eq.return_value.execute.return_value.data = predictions_data
            return tbl

        client.table.side_effect = table_side_effect

        result = list_unpicked_matches(client, "agent-user-id", window_hours=48, limit=10)
        ids = [m["id"] for m in result]
        self.assertEqual(ids, ["m1", "m3"])

    def test_respects_limit(self):
        client = MagicMock()
        matches_data = [{"id": f"m{i}"} for i in range(20)]

        def table_side_effect(name):
            tbl = MagicMock()
            if name == "matches":
                tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.execute.return_value.data = matches_data
            elif name == "predictions":
                tbl.select.return_value.eq.return_value.execute.return_value.data = []
            return tbl

        client.table.side_effect = table_side_effect

        result = list_unpicked_matches(client, "agent-user-id", window_hours=48, limit=5)
        self.assertEqual(len(result), 5)


if __name__ == "__main__":
    unittest.main()
