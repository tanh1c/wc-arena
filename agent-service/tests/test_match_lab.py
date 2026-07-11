import unittest

from unittest.mock import patch

from app.match_lab.actions import decide_action, parse_action
from app.match_lab.resolver import rarity_modifier, resolve_match, resolve_team_strengths
from app.match_lab.rules import validate_xi


class MatchLabActionTest(unittest.TestCase):
    def test_accepts_only_known_local_action_schema(self):
        slots = {"cm1", "rw"}
        self.assertEqual(
            parse_action('{"action":"pass","actor_slot":"cm1","target_slot":"rw","risk":40}', slots, "cm1"),
            {"action": "pass", "actor_slot": "cm1", "target_slot": "rw", "risk": 40},
        )
        self.assertIsNone(parse_action('{"action":"pass","actor_slot":"cm1","target_slot":"rw","risk":40,"extra":true}', slots, "cm1"))
        self.assertIsNone(parse_action('prose {"action":"pass"}', slots, "cm1"))
        self.assertIsNone(parse_action('{"action":"shoot","actor_slot":"rw","risk":40}', slots, "cm1"))

    def test_invalid_actions_retry_once_then_use_safe_fallback(self):
        with patch("app.match_lab.actions._call_llm", side_effect=["bad", "still bad"]):
            action, source = decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(source, "fallback")
        self.assertEqual(action["action"], "pass")
        self.assertEqual(action["actor_slot"], "cm1")

    def test_resolver_is_deterministic_and_emits_supported_events(self):
        xi = [{"slot_id": "gk", "card_id": "gk", "stats": {"GK Reflexes": 100, "GK Diving": 100, "GK Handling": 100, "Positioning": 100, "OVR": 90, "PAC": 1, "SHO": 1, "PAS": 1, "DRI": 1, "DEF": 1, "PHY": 1}, "rarity": "Common"}]
        result = resolve_match("seed", xi, xi, 10)
        self.assertEqual(result, resolve_match("seed", xi, xi, 10))
        self.assertTrue(10 <= len(result["timeline"]) <= 14)
        self.assertTrue({event["type"] for event in result["timeline"]} <= {"possession", "pass", "dribble", "shot", "save", "goal"})

    def test_hotspots_use_agent_intent_but_keep_score_resolution_authoritative(self):
        xi = [
            {"slot_id": "st", "card_id": "st", "position": "ST", "effective_stats": {"OVR": 90, "PAC": 90, "SHO": 90, "PAS": 90, "DRI": 90, "DEF": 50, "PHY": 80, "Finishing": 90, "Shot Power": 90, "Long Shot": 90, "Volleys": 90, "Penalties": 90}, "rarity": "Common"},
            {"slot_id": "cm", "card_id": "cm", "position": "CM", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 60, "PHY": 70, "Finishing": 80, "Shot Power": 80, "Long Shot": 80, "Volleys": 80, "Penalties": 80}, "rarity": "Common"},
        ]
        def shoot_action(_, actor_slot, local_slots):
            return {"action": "shoot", "actor_slot": actor_slot, "target_slot": next(iter(local_slots)), "risk": 40}, "llm"

        with patch("app.match_lab.resolver.decide_action", side_effect=shoot_action) as decide:
            result = resolve_match("seed", xi, xi, 10)

        self.assertEqual(decide.call_count, 10)
        self.assertEqual(result["action_sources"], {"llm": 10, "retried": 0, "fallback": 0})
        self.assertTrue(all(event["type"] in {"goal", "save"} and event["summary"] for event in result["timeline"]))
        scores = [event["score"] for event in result["timeline"]]
        self.assertTrue(all(scores[index]["home"] >= scores[index - 1]["home"] and scores[index]["away"] >= scores[index - 1]["away"] for index in range(1, len(scores))))

    def test_llm_exception_retries_then_falls_back(self):
        with patch("app.match_lab.actions._call_llm", side_effect=RuntimeError("unavailable")):
            action, source = decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(source, "fallback")
        self.assertEqual(action["action"], "pass")
        self.assertEqual(action["target_slot"], "rw")

    def test_actions_reject_self_targets(self):
        self.assertIsNone(parse_action('{"action":"pass","actor_slot":"cm1","target_slot":"cm1","risk":40}', {"cm1", "rw"}, "cm1"))

    def test_match_lab_action_uses_short_model_timeout(self):
        with patch("app.match_lab.actions._call_llm", return_value='{"action":"pass","actor_slot":"cm1","target_slot":"rw","risk":40}') as call:
            decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(call.call_args.kwargs["timeout"], 1)

    def test_resolver_normalizes_stats_against_reference_profiles(self):
        strong = [{"slot_id": "st", "card_id": "strong", "stats": {"OVR": 95, "PAC": 95, "SHO": 95, "PAS": 95, "DRI": 95, "DEF": 95, "PHY": 95, "Finishing": 95}, "rarity": "Common"}]
        weak = [{"slot_id": "st", "card_id": "weak", "stats": {"OVR": 40, "PAC": 40, "SHO": 40, "PAS": 40, "DRI": 40, "DEF": 40, "PHY": 40, "Finishing": 40}, "rarity": "Common"}]
        strengths = resolve_team_strengths(strong, weak, [card["stats"] for card in strong + weak])
        self.assertGreater(strengths["home"]["shot"], strengths["away"]["shot"])
        self.assertEqual(resolve_match("seed", strong, weak, 10, [card["stats"] for card in strong + weak]), resolve_match("seed", strong, weak, 10, [card["stats"] for card in strong + weak]))

    def test_rarity_modifier_is_small_and_unknown_is_neutral(self):
        self.assertEqual(rarity_modifier("Unknown"), 0)
        self.assertGreater(rarity_modifier("GOAT"), rarity_modifier("Common"))
        self.assertLessEqual(rarity_modifier("GOAT"), 0.035)

    def test_persisted_effective_stats_do_not_receive_a_second_rarity_bonus(self):
        card = {
            "slot_id": "rw",
            "card_id": "salah",
            "position": "RW",
            "effective_stats": {"OVR": 50, "PAC": 50, "SHO": 50, "PAS": 50, "DRI": 50, "DEF": 50, "PHY": 50},
            "rarity": "GOAT",
        }

        strengths = resolve_team_strengths([card], [card])

        self.assertEqual(strengths["home"]["shot"], 0.5)

    def test_goalkeeper_drives_save_strength(self):
        goalkeeper = {"position": "GK", "effective_stats": {"OVR": 95, "DEF": 95, "GK Reflexes": 95, "GK Diving": 95, "GK Handling": 95, "Positioning": 95}}
        outfield = {"position": "ST", "effective_stats": {"OVR": 50, "DEF": 50, "GK Reflexes": 50, "GK Diving": 50, "GK Handling": 50, "Positioning": 50}}

        strengths = resolve_team_strengths([goalkeeper, outfield], [outfield, outfield])

        self.assertEqual(strengths["home"]["save"], 0.95)
        self.assertEqual(strengths["away"]["save"], 0.5)

    def test_forward_drives_shot_strength(self):
        forward = {"position": "ST", "effective_stats": {"OVR": 95, "PAC": 95, "SHO": 95, "PAS": 50, "DRI": 50, "DEF": 50, "PHY": 50, "Finishing": 95, "Shot Power": 95, "Long Shot": 95, "Volleys": 95, "Penalties": 95}}
        defender = {"position": "CB", "effective_stats": {"OVR": 50, "PAC": 50, "SHO": 50, "PAS": 50, "DRI": 50, "DEF": 95, "PHY": 50, "Finishing": 50, "Shot Power": 50, "Long Shot": 50, "Volleys": 50, "Penalties": 50}}

        strengths = resolve_team_strengths([forward, defender], [defender, defender])

        self.assertGreater(strengths["home"]["shot"], strengths["away"]["shot"])

    def test_xi_requires_unique_position_eligible_cards(self):
        cards = [
            {"slot_id": "gk", "owned_card_id": "a", "card_id": "goalkeeper", "position": "GK", "alternate_positions": [], "profile": {"OVR": 80}},
            {"slot_id": "lb", "owned_card_id": "b", "card_id": "left-back", "position": "LB", "alternate_positions": [], "profile": {"OVR": 80}},
        ]
        self.assertIsNone(validate_xi("4-3-3", cards))

    def test_match_lab_run_reads_the_inserted_run_id_from_list_response(self):
        from app.match_lab.service import run_match_lab

        class InsertBuilder:
            def select(self, columns):
                self.columns = columns
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        class ServiceClient:
            def table(self, name):
                self.table_name = name
                return self

            def insert(self, payload):
                self.payload = payload
                return InsertBuilder()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        result = {"score": {"home": 1, "away": 0}, "timeline": [], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 0, "retried": 0, "fallback": 0}}
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", return_value=result), patch("app.match_lab.service.get_service_supabase_client", return_value=ServiceClient()):
            self.assertEqual(run_match_lab("jwt", "user", "4-3-3", "starter", [], False)["id"], "run-1")


if __name__ == "__main__":
    unittest.main()
