import types
import unittest

import httpx
from unittest.mock import patch

from app.match_lab.actions import ProviderActionError, decide_action, parse_action
from app.match_lab.resolver import MatchPausedError, rarity_modifier, resolve_match, resolve_team_strengths
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
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=["bad", "still bad"]):
            action, source = decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(source, "fallback")
        self.assertEqual(action["action"], "pass")
        self.assertEqual(action["actor_slot"], "cm1")

    def test_match_lab_debug_summaries_stay_out_of_the_persisted_report(self):
        from app.match_lab.service import run_match_lab

        class InsertBuilder:
            def select(self, columns):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        class ServiceClient:
            def table(self, name):
                return self

            def insert(self, payload):
                self.payload = payload
                return InsertBuilder()

            def update(self, payload):
                self.update_payload = payload
                return self

            def eq(self, column, value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        result = {"score": {"home": 1, "away": 0}, "timeline": [{"minute": minute} for minute in range(12)], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 0, "retried": 0, "fallback": 0}, "hotspot_summaries": [{"minute": 5}]}
        service = ServiceClient()
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", return_value=result), patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            response = run_match_lab("jwt", "user", "4-3-3", "starter", [], True)

        self.assertEqual(response["debug"]["hotspot_summaries"], result["hotspot_summaries"])
        self.assertNotIn("hotspot_summaries", service.payload["final_report"])

    def test_resolver_exposes_safe_deterministic_local_context_only_for_debug(self):
        xi = [
            {"slot_id": "st", "card_id": "st", "position": "ST", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
            {"slot_id": "cm", "card_id": "cm", "position": "CM", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
            {"slot_id": "rw", "card_id": "rw", "position": "RW", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
        ]
        calls = []

        def action(snapshot, actor_slot, target_slots):
            calls.append((snapshot, actor_slot, target_slots))
            return {"action": "pass", "actor_slot": actor_slot, "target_slot": sorted(target_slots)[0], "risk": 20}, "llm"

        with patch("app.match_lab.resolver.decide_action", side_effect=action):
            result = resolve_match("seed", xi, xi, 10, coach_intents={"home": "keep shape", "away": "press high"}, debug=True)
            initial_calls = list(calls)
            comparison = resolve_match("seed", xi, xi, 10, coach_intents={"home": "keep shape", "away": "press high"}, debug=True)

        self.assertEqual(
            [(item["side"], item["local_actors"], item["action"], item["outcome"]) for item in result["hotspot_summaries"]],
            [(item["side"], item["local_actors"], item["action"], item["outcome"]) for item in comparison["hotspot_summaries"]],
        )
        self.assertEqual(len(result["hotspot_summaries"]), 10)
        self.assertEqual(len(initial_calls), 10)
        for summary, (snapshot, actor_slot, target_slots) in zip(result["hotspot_summaries"], initial_calls):
            local = summary["local_actors"]
            self.assertEqual(local["carrier"], actor_slot)
            self.assertLessEqual(len(local["support"]), 2)
            self.assertLessEqual(len(local["opponents"]), 2)
            self.assertNotIn(actor_slot, local["support"])
            self.assertEqual(target_slots, set(local["support"]))
            self.assertEqual(snapshot["coach_intent"], summary["coach_intent"])
            self.assertEqual(set(summary), {"minute", "side", "coach_intent", "local_actors", "action", "outcome", "latency_ms"})
            self.assertTrue(set(local["support"]) <= {"st", "cm", "rw"})
            self.assertTrue(set(local["opponents"]) <= {"st", "cm", "rw"})
            self.assertIsInstance(summary["latency_ms"], int)
        self.assertNotIn("hotspot_summaries", resolve_match("seed", xi, xi, 10))

    def test_resume_continues_at_the_paused_hotspot_without_replaying_events(self):
        xi = [
            {"slot_id": "st", "card_id": "st", "position": "ST", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
            {"slot_id": "cm", "card_id": "cm", "position": "CM", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
        ]
        def pass_action(_, actor_slot, target_slots):
            return {"action": "pass", "actor_slot": actor_slot, "target_slot": sorted(target_slots)[0], "risk": 20}, "llm"

        with patch("app.match_lab.resolver.decide_action", side_effect=pass_action):
            complete = resolve_match("seed", xi, xi, 10)

        with patch("app.match_lab.resolver.decide_action", side_effect=[
            ({"action": "pass", "actor_slot": "st", "target_slot": "cm", "risk": 20}, "llm"),
            ({"action": "pass", "actor_slot": "st", "target_slot": "cm", "risk": 20}, "llm"),
            ProviderActionError("unavailable"),
        ]):
            with self.assertRaises(MatchPausedError) as paused:
                resolve_match("seed", xi, xi, 10)

        partial = paused.exception.result
        with patch("app.match_lab.resolver.decide_action", side_effect=pass_action):
            resumed = resolve_match(
                "seed", xi, xi, 10,
                start_index=partial["hotspot_index"],
                initial_score=partial["score"],
                initial_timeline=partial["timeline"],
                initial_action_sources=partial["action_sources"],
            )

        self.assertEqual(partial["hotspot_index"], 2)
        self.assertEqual(len(partial["timeline"]), 2)
        self.assertEqual(resumed["timeline"][:2], partial["timeline"])
        self.assertEqual(resumed, complete)

    def test_resolver_batch_resumes_to_the_uninterrupted_result(self):
        xi = [
            {"slot_id": "st", "card_id": "st", "position": "ST", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
            {"slot_id": "cm", "card_id": "cm", "position": "CM", "effective_stats": {"OVR": 80, "PAC": 80, "SHO": 80, "PAS": 80, "DRI": 80, "DEF": 80, "PHY": 80}, "rarity": "Common"},
        ]

        def pass_action(_, actor_slot, target_slots):
            return {"action": "pass", "actor_slot": actor_slot, "target_slot": sorted(target_slots)[0], "risk": 20}, "llm"

        with patch("app.match_lab.resolver.decide_action", side_effect=pass_action):
            complete = resolve_match("seed", xi, xi, 10)
            partial = resolve_match("seed", xi, xi, 10, end_index=2)
            resumed = resolve_match(
                "seed", xi, xi, 10,
                start_index=2,
                initial_score=partial["score"],
                initial_timeline=partial["timeline"],
                initial_action_sources=partial["action_sources"],
            )

        self.assertEqual(len(partial["timeline"]), 2)
        self.assertEqual(resumed, complete)

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

    def test_match_lab_llm_posts_openai_compatible_chat_completion(self):
        from app.match_lab.actions import _call_llm_with_deadline

        calls = []

        class Response:
            def raise_for_status(self):
                pass

            def json(self):
                return {"choices": [{"message": {"content": "response"}}]}

        class Client:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                pass

            def post(self, url, **kwargs):
                calls.append((url, kwargs))
                return Response()

        settings = types.SimpleNamespace(
            llm_api_key="provider-key",
            openai_api_key="",
            llm_base_url="https://provider.example/v1/",
            llm_model="provider/model",
        )
        with patch("app.match_lab.actions.get_settings", return_value=settings), patch("app.match_lab.actions.httpx.Client", return_value=Client()) as client:
            self.assertEqual(_call_llm_with_deadline("prompt"), "response")

        self.assertEqual(client.call_args.kwargs, {"timeout": 8, "trust_env": False})
        self.assertEqual(calls, [("https://provider.example/v1/chat/completions", {
            "headers": {"Authorization": "Bearer provider-key", "Content-Type": "application/json"},
            "json": {"model": "provider/model", "temperature": 0.3, "messages": [{"role": "user", "content": "prompt"}]},
        })])

    def test_match_lab_llm_classifies_direct_provider_errors(self):
        from app.match_lab.actions import _MatchLabLLMError, _call_llm_with_deadline

        settings = types.SimpleNamespace(llm_api_key="key", openai_api_key="", llm_base_url="https://provider.example/v1", llm_model="model")
        request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
        cases = [
            (httpx.TimeoutException("private timeout"), {"category": "timeout", "exception_class": "TimeoutException"}),
            (httpx.ReadTimeout("private response body", request=request), {"category": "timeout", "exception_class": "ReadTimeout"}),
            (httpx.ConnectError("private endpoint", request=request), {"category": "provider_error", "exception_class": "ConnectError"}),
            (httpx.HTTPStatusError("private provider body", request=request, response=httpx.Response(429, request=request)), {"category": "rate_limit", "exception_class": "HTTPStatusError"}),
            (httpx.HTTPStatusError("private provider body", request=request, response=httpx.Response(401, request=request)), {"category": "client_error", "exception_class": "HTTPStatusError"}),
            (httpx.HTTPStatusError("private provider body", request=request, response=httpx.Response(503, request=request)), {"category": "provider_error", "exception_class": "HTTPStatusError"}),
        ]
        for error, fields in cases:
            with self.subTest(error=type(error).__name__), patch("app.match_lab.actions.get_settings", return_value=settings), patch("app.match_lab.actions.httpx.Client") as client:
                client.return_value.__enter__.return_value.post.side_effect = error
                with self.assertRaises(_MatchLabLLMError) as raised:
                    _call_llm_with_deadline("prompt")
            self.assertEqual(raised.exception.safe_fields, fields)

    def test_provider_exception_retries_once_then_pauses(self):
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=RuntimeError("unavailable")) as call:
            with self.assertRaises(ProviderActionError):
                decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})

        self.assertEqual(call.call_count, 2)
        self.assertEqual([item.kwargs for item in call.call_args_list], [{}, {}])

    def test_read_timeouts_retry_once_then_use_safe_fallback(self):
        from app.match_lab.actions import _MatchLabLLMError

        timeout = _MatchLabLLMError({"category": "timeout", "exception_class": "ReadTimeout"})
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=timeout) as call:
            with self.assertLogs("app.match_lab.actions", "INFO") as logs:
                action, source = decide_action({"private_snapshot": "do-not-log"}, "cm1", {"cm1", "rw"})

        self.assertEqual(call.call_count, 2)
        self.assertEqual(source, "fallback")
        self.assertEqual(action, {"action": "pass", "actor_slot": "cm1", "target_slot": "rw", "risk": 20})
        self.assertEqual(len(logs.output), 2)
        for index, line in enumerate(logs.output, start=1):
            self.assertIn(f'"attempt": {index}', line)
            self.assertIn('"category": "timeout"', line)
            self.assertIn('"exception_class": "ReadTimeout"', line)
            self.assertNotIn("private_snapshot", line)
            self.assertNotIn("do-not-log", line)
            self.assertNotIn("cm1", line)
            self.assertNotIn("rw", line)

    def test_hard_deadline_retries_once_and_logs_safe_timeout(self):
        from app.match_lab.actions import _MatchLabLLMError

        timeout = _MatchLabLLMError({"category": "timeout", "exception_class": "MatchLabActionDeadline"})
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=timeout) as call:
            with self.assertLogs("app.match_lab.actions", "INFO") as logs:
                with self.assertRaises(ProviderActionError):
                    decide_action({"private_snapshot": "do-not-log"}, "cm1", {"cm1", "rw"})

        self.assertEqual(call.call_count, 2)
        self.assertEqual(len(logs.output), 2)
        for index, line in enumerate(logs.output, start=1):
            self.assertIn(f'"attempt": {index}', line)
            self.assertIn('"category": "timeout"', line)
            self.assertIn('"exception_class": "MatchLabActionDeadline"', line)
            self.assertNotIn("private_snapshot", line)
            self.assertNotIn("do-not-log", line)
            self.assertNotIn("cm1", line)
            self.assertNotIn("rw", line)

    def test_provider_timeout_logs_safe_attempt_fields(self):
        def timeout(*_args, **_kwargs):
            raise RuntimeError("provider response: private-provider-body") from TimeoutError("private timeout")

        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=timeout):
            with self.assertLogs("app.match_lab.actions", "INFO") as logs:
                with self.assertRaises(ProviderActionError):
                    decide_action({"private_snapshot": "do-not-log"}, "cm1", {"cm1", "rw"})

        self.assertEqual(len(logs.output), 2)
        for index, line in enumerate(logs.output, start=1):
            self.assertIn("match_lab_action attempt_failed", line)
            self.assertIn(f'"attempt": {index}', line)
            self.assertIn('"elapsed_ms": ', line)
            self.assertIn('"timeout_seconds": 8', line)
            self.assertIn('"category": "timeout"', line)
            self.assertIn('"exception_class": "TimeoutError"', line)
            self.assertNotIn("private-provider-body", line)
            self.assertNotIn("private timeout", line)
            self.assertNotIn("private_snapshot", line)
            self.assertNotIn("do-not-log", line)
            self.assertNotIn("cm1", line)
            self.assertNotIn("rw", line)

    def test_rate_limit_category_uses_status_code_without_logging_provider_body(self):
        class RateLimited(Exception):
            status_code = 429

        def rate_limited(*_args, **_kwargs):
            raise RuntimeError("provider response: private-provider-body") from RateLimited("private rate-limit body")

        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=rate_limited):
            with self.assertLogs("app.match_lab.actions", "INFO") as logs:
                with self.assertRaises(ProviderActionError):
                    decide_action({"private_snapshot": "do-not-log"}, "cm1", {"cm1", "rw"})

        self.assertEqual(len(logs.output), 2)
        for line in logs.output:
            self.assertIn('"category": "rate_limit"', line)
            self.assertIn('"exception_class": "RateLimited"', line)
            self.assertNotIn("private-provider-body", line)
            self.assertNotIn("private rate-limit body", line)

    def test_invalid_actions_log_parse_errors_without_raw_output(self):
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=["private malformed model output", "still private malformed output"]):
            with self.assertLogs("app.match_lab.actions", "INFO") as logs:
                action, source = decide_action({"private_snapshot": "do-not-log"}, "cm1", {"cm1", "rw"})

        self.assertEqual(source, "fallback")
        self.assertEqual(action, {"action": "pass", "actor_slot": "cm1", "target_slot": "rw", "risk": 20})
        self.assertEqual(len(logs.output), 2)
        for index, line in enumerate(logs.output, start=1):
            self.assertIn("match_lab_action parse_error", line)
            self.assertIn(f'"attempt": {index}', line)
            self.assertIn('"elapsed_ms": ', line)
            self.assertIn('"timeout_seconds": 8', line)
            self.assertNotIn("private malformed", line)
            self.assertNotIn("private_snapshot", line)
            self.assertNotIn("do-not-log", line)
            self.assertNotIn("cm1", line)
            self.assertNotIn("rw", line)

    def test_llm_exception_retries_then_falls_back(self):
        with patch("app.match_lab.actions._call_llm_with_deadline", side_effect=["bad", "still bad"]):
            action, source = decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(source, "fallback")
        self.assertEqual(action["action"], "pass")
        self.assertEqual(action["target_slot"], "rw")

    def test_actions_reject_self_targets(self):
        self.assertIsNone(parse_action('{"action":"pass","actor_slot":"cm1","target_slot":"cm1","risk":40}', {"cm1", "rw"}, "cm1"))

    def test_match_lab_action_uses_hard_deadline_wrapper(self):
        with patch("app.match_lab.actions._call_llm_with_deadline", return_value='{"action":"pass","actor_slot":"cm1","target_slot":"rw","risk":40}') as call:
            decide_action({"score": {"home": 0, "away": 0}}, "cm1", {"cm1", "rw"})
        self.assertEqual(call.call_count, 1)
        self.assertEqual(call.call_args.kwargs, {})
        self.assertIn("Required actor slot: cm1", call.call_args.args[0])

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

    def test_run_match_lab_persists_a_running_two_hotspot_checkpoint(self):
        from app.match_lab.service import run_match_lab

        class InsertBuilder:
            def select(self, _columns):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        class ServiceClient:
            def table(self, _name):
                return self

            def insert(self, payload):
                self.insert_payload = dict(payload)
                return InsertBuilder()

            def update(self, payload):
                self.update_payload = dict(payload)
                return self

            def eq(self, _column, _value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        result = {"score": {"home": 1, "away": 0}, "timeline": [{"minute": 5}, {"minute": 13}], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 2, "retried": 0, "fallback": 0}}
        service = ServiceClient()
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", return_value=result) as resolve, patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            response = run_match_lab("jwt", "user", "4-3-3", "starter", [], False)

        self.assertEqual(service.insert_payload["status"], "running")
        self.assertEqual(resolve.call_args.kwargs["end_index"], 2)
        self.assertEqual(service.update_payload["status"], "running")
        self.assertEqual(service.update_payload["hotspot_index"], 2)
        self.assertNotIn("final_report", service.update_payload)
        self.assertNotIn("completed_at", service.update_payload)
        self.assertEqual(response["status"], "running")

    def test_match_lab_provider_pause_stays_paused(self):
        from app.match_lab.service import run_match_lab

        class InsertBuilder:
            def select(self, _columns):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        class ServiceClient:
            def table(self, _name):
                return self

            def insert(self, payload):
                self.insert_payload = dict(payload)
                return InsertBuilder()

            def update(self, payload):
                self.update_payload = dict(payload)
                return self

            def eq(self, _column, _value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        partial = {"hotspot_index": 1, "score": {"home": 0, "away": 0}, "timeline": [{"minute": 5}], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 1, "retried": 0, "fallback": 0}}
        service = ServiceClient()
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", side_effect=MatchPausedError(partial)), patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            response = run_match_lab("jwt", "user", "4-3-3", "starter", [], False)

        self.assertEqual(service.insert_payload["status"], "running")
        self.assertEqual(service.update_payload["status"], "paused")
        self.assertEqual(service.update_payload["hotspot_index"], 1)
        self.assertNotIn("final_report", service.update_payload)
        self.assertNotIn("completed_at", service.update_payload)
        self.assertEqual(response["status"], "paused")

    def test_resume_match_lab_accepts_running_checkpoint(self):
        from app.match_lab.service import resume_match_lab

        row = {"id": "run-1", "user_id": "user", "status": "running"}
        with patch("app.match_lab.service._owned_run", return_value=row), patch("app.match_lab.service._advance_run", return_value={"id": "run-1", "status": "running"}) as advance:
            response = resume_match_lab("user", "run-1", False)

        advance.assert_called_once_with(row, False)
        self.assertEqual(response["status"], "running")

    def test_abandon_match_lab_accepts_running_checkpoint(self):
        from app.match_lab.service import abandon_match_lab

        class ServiceClient:
            def table(self, _name):
                return self

            def update(self, payload):
                self.update_payload = dict(payload)
                return self

            def eq(self, _column, _value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        service = ServiceClient()
        with patch("app.match_lab.service._owned_run", return_value={"id": "run-1", "status": "running"}), patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            response = abandon_match_lab("user", "run-1")

        self.assertEqual(service.update_payload, {"status": "abandoned", "resolver_state": None})
        self.assertEqual(response, {"id": "run-1", "status": "abandoned"})

    def test_resume_match_lab_completes_the_final_batch(self):
        from app.match_lab.service import resume_match_lab

        class ServiceClient:
            def table(self, _name):
                return self

            def update(self, payload):
                self.update_payload = dict(payload)
                return self

            def eq(self, _column, _value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        state = {"home_xi": [{"slot_id": "st", "card_id": "player", "position": "ST", "rarity": "Common"}], "away_xi": [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}], "action_sources": {"llm": 10, "retried": 0, "fallback": 0}}
        row = {"id": "run-1", "user_id": "user", "status": "paused", "formation": "4-3-3", "bot_id": "starter", "seed": "seed", "hotspot_index": 10, "home_score": 1, "away_score": 0, "broadcast_timeline": [{"minute": minute} for minute in range(10)], "resolver_state": state}
        result = {"score": {"home": 2, "away": 0}, "timeline": [{"minute": minute} for minute in range(12)], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 12, "retried": 0, "fallback": 0}}
        service = ServiceClient()
        with patch("app.match_lab.service._owned_run", return_value=row), patch("app.match_lab.service.resolve_match", return_value=result) as resolve, patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            response = resume_match_lab("user", "run-1", False)

        self.assertEqual(resolve.call_args.kwargs["start_index"], 10)
        self.assertEqual(resolve.call_args.kwargs["end_index"], 12)
        self.assertEqual(service.update_payload["status"], "completed")
        self.assertIsNone(service.update_payload["resolver_state"])
        self.assertIn("final_report", service.update_payload)
        self.assertIn("completed_at", service.update_payload)
        self.assertEqual(response["status"], "completed")

    def test_completed_run_clears_server_only_resolver_state(self):
        from app.match_lab.service import run_match_lab

        class InsertBuilder:
            def select(self, columns):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        class ServiceClient:
            def table(self, name):
                return self

            def insert(self, payload):
                self.insert_payload = payload
                return InsertBuilder()

            def update(self, payload):
                self.update_payload = payload
                return self

            def eq(self, column, value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        result = {"score": {"home": 1, "away": 0}, "timeline": [{"minute": minute} for minute in range(12)], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 0, "retried": 0, "fallback": 0}}
        service = ServiceClient()
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", return_value=result), patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            run_match_lab("jwt", "user", "4-3-3", "starter", [], False)

        self.assertIsNone(service.update_payload["resolver_state"])

    def test_feedback_whitelists_only_ratings_and_text(self):
        from app.match_lab.service import submit_match_lab_feedback

        class ServiceClient:
            def table(self, name):
                return self

            def select(self, columns):
                return self

            def eq(self, column, value):
                return self

            def update(self, payload):
                self.update_payload = payload
                return self

            def execute(self):
                return type("Response", (), {"data": [{"status": "completed"}]})()

        service = ServiceClient()
        feedback = {"fun_rating": 5, "clarity_rating": 4, "fairness_rating": 3, "feedback_text": "Good", "status": "abandoned"}
        with patch("app.match_lab.service.get_service_supabase_client", return_value=service):
            submit_match_lab_feedback("user", "run-1", feedback)

        self.assertEqual(service.update_payload, {"fun_rating": 5, "clarity_rating": 4, "fairness_rating": 3, "feedback_text": "Good"})

    def test_bot_preview_exposes_only_display_safe_card_fields(self):
        from app.match_lab.service import get_bot_xi_preview

        bot_xi = [{
            "slot_id": "gk", "card_id": "bot-card", "name": "Preview Keeper", "position": "GK", "rarity": "Common",
            "team": "Team", "league": "League", "nation_region": "Nation", "image_url": "https://example.com/card.png",
            "stats": {"OVR": 50}, "effective_stats": {"OVR": 50}, "profile": {"OVR": 50},
            "alternate_positions": ["CB"], "resolver_state": {"seed": "private"}, "prompt": "private",
        }]
        with patch("app.match_lab.service._bot_xi", return_value=bot_xi):
            preview = get_bot_xi_preview("jwt", "starter")

        self.assertEqual(preview["bot"], {"id": "starter", "formation": "4-3-3", "ovr_band": "50-68", "identity": "Balanced basics"})
        self.assertEqual(preview["xi"], [{"slot_id": "gk", "card_id": "bot-card", "name": "Preview Keeper", "position": "GK", "rarity": "Common", "team": "Team", "league": "League", "nation_region": "Nation", "image_url": "https://example.com/card.png"}])

    def test_bot_preview_rejects_unknown_bot(self):
        from app.match_lab.service import get_bot_xi_preview

        with self.assertRaises(ValueError):
            get_bot_xi_preview("jwt", "missing")

    def test_bot_xi_orders_catalog_before_selecting_formation_slots(self):
        from app.match_lab.rules import FORMATIONS
        from app.match_lab.service import _bot_xi

        class CatalogQuery:
            def select(self, columns):
                return self

            def order(self, column):
                self.order_column = column
                return self

            def limit(self, amount):
                return self

            def execute(self):
                return type("Response", (), {"data": cards})()

        class UserClient:
            def __init__(self):
                self.query = CatalogQuery()

            def table(self, name):
                return self.query

        cards = [{
            "id": f"card-{slot_id}", "name": slot_id, "position": position,
            "alternate_positions": "", "rarity": "Common", "team": None,
            "league": None, "nation_region": None, "image_url": None,
            "player_card_gameplay_profiles": {"raw_stats": {"OVR": 60}, "effective_stats": {"OVR": 60}},
        } for slot_id, position in FORMATIONS["4-3-3"].items()]
        client = UserClient()
        with patch("app.match_lab.service.get_user_supabase_client", return_value=client):
            xi = _bot_xi("jwt", "starter")

        self.assertEqual(client.query.order_column, "id")
        self.assertEqual([card["slot_id"] for card in xi], list(FORMATIONS["4-3-3"]))

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

            def update(self, payload):
                self.update_payload = payload
                return self

            def eq(self, column, value):
                return self

            def execute(self):
                return type("Response", (), {"data": [{"id": "run-1"}]})()

        player_xi = [{"slot_id": "st", "card_id": "player", "owned_card_id": "owned", "position": "ST", "rarity": "Common"}]
        bot_xi = [{"slot_id": "st", "card_id": "bot", "position": "ST", "rarity": "Common"}]
        result = {"score": {"home": 1, "away": 0}, "timeline": [], "strengths": {"home": {}, "away": {}}, "action_sources": {"llm": 0, "retried": 0, "fallback": 0}}
        with patch("app.match_lab.service._owned_xi", return_value=player_xi), patch("app.match_lab.service._bot_xi", return_value=bot_xi), patch("app.match_lab.service.resolve_match", return_value=result), patch("app.match_lab.service.get_service_supabase_client", return_value=ServiceClient()):
            self.assertEqual(run_match_lab("jwt", "user", "4-3-3", "starter", [], False)["id"], "run-1")


if __name__ == "__main__":
    unittest.main()
