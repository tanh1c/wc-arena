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


if __name__ == "__main__":
    unittest.main()
