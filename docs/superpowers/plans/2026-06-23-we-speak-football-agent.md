# We Speak Football Agent Implementation Plan

> **For agentic workers:** Preferred workflow is Superpowers-style task execution: complete one checkbox step at a time, verify after each task, and keep the React app, Supabase schema, and Python agent service independently runnable. If a `superpowers:*` plugin is available, use the executing-plans workflow for this document.

## Goal

Add a We Speak Football agent to Predict 2026. The agent uses LangGraph for orchestration, Mem0 for session/user/agent memory, and football data tools to fetch existing Supabase, ESPN, FIFA ranking, and app-domain data for match analysis.

## Architecture

Keep the current React/Vite app and Supabase backend. Add a separate Python service under `agent-service/` that exposes a small HTTP API consumed by the frontend.

```txt
React/Vite app
  -> /agent page and match-detail agent panel
  -> Python FastAPI agent service
      -> LangGraph workflow
      -> Mem0 memory
      -> Supabase football data tools
      -> ESPN/FIFA enrichment tools
      -> LLM provider
```

The Python service should verify Supabase user access tokens from the frontend. It may use `SUPABASE_SERVICE_ROLE_KEY` only server-side. The frontend must never receive service-role, Mem0, or LLM keys.

## Tech Stack

- Frontend: React 19, Vite 6, TypeScript, existing Supabase Auth
- Agent API: Python, FastAPI, Uvicorn
- Agent framework: LangGraph
- Memory: Mem0
- Data: Supabase Postgres, existing ESPN enrichment fields, FIFA ranking sync data
- Optional observability: LangSmith or structured JSON logs

## Task 1: Scaffold Python Agent Service

**Files:**
- Create: `agent-service/pyproject.toml`
- Create: `agent-service/README.md`
- Create: `agent-service/app/main.py`
- Create: `agent-service/app/settings.py`
- Create: `agent-service/app/api/routes.py`
- Create: `agent-service/app/models.py`

- [ ] Create a Python package named `we-speak-football-agent`.
- [ ] Add dependencies: `fastapi`, `uvicorn`, `pydantic-settings`, `httpx`, `supabase`, `langgraph`, `langchain-openai`, `mem0ai`, `python-dotenv`.
- [ ] Add `/health` endpoint returning `{ "ok": true }`.
- [ ] Add CORS allowing `AGENT_ALLOWED_ORIGIN`, defaulting to `http://localhost:3000`.
- [ ] Document local run command:

```bash
cd agent-service
uvicorn app.main:app --reload --port 8000
```

## Task 2: Configure Environment

**Files:**
- Create: `agent-service/.env.example`
- Modify: `.env.example`

- [ ] Add agent service environment template:

```env
OPENAI_API_KEY=
MEM0_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AGENT_ALLOWED_ORIGIN=http://localhost:3000
```

- [ ] Add frontend agent API URL:

```env
VITE_AGENT_API_URL=http://localhost:8000
```

- [ ] Ensure `.gitignore` continues to ignore `.env*` while preserving `.env.example`.
- [ ] Document that service-role, Mem0, and OpenAI keys are server-only.

## Task 3: Add Supabase Auth Verification

**Files:**
- Create: `agent-service/app/auth.py`
- Modify: `agent-service/app/api/routes.py`

- [ ] Accept `Authorization: Bearer <supabase_access_token>` on agent endpoints.
- [ ] Verify the token using Supabase Auth from the Python service.
- [ ] Return `401` for missing/invalid tokens.
- [ ] Pass `user_id`, `email`, and request metadata into the agent graph state.

## Task 4: Build Football Data Tools

**Files:**
- Create: `agent-service/app/tools/supabase_tools.py`
- Create: `agent-service/app/tools/football_tools.py`
- Create: `agent-service/app/tools/__init__.py`

- [ ] Implement `get_match(match_id)` from `public.matches`.
- [ ] Implement `get_teams(home_team_id, away_team_id)` from `public.teams`.
- [ ] Implement `get_espn_context(match_id)` using ESPN columns and `espn_summary`.
- [ ] Implement `get_prediction_signal(match_id)` using ESPN and community outcome fields if present.
- [ ] Implement `get_user_prediction_history(user_id)`.
- [ ] Implement `get_leaderboard_context(user_id)`.
- [ ] Return normalized, compact dicts suitable for LLM context.
- [ ] Avoid exposing private predictions for any user other than the authenticated caller.

## Task 5: Integrate Mem0 Memory

**Files:**
- Create: `agent-service/app/memory.py`

- [ ] Initialize `MemoryClient`.
- [ ] Implement `search_user_memory(user_id, query)`.
- [ ] Implement `save_interaction(user_id, session_id, user_message, assistant_message, metadata)`.
- [ ] Use metadata scopes:
  - `scope=user` for stable user preferences.
  - `scope=session` for current conversation context.
  - `scope=agent` for reusable football-analysis heuristics.
- [ ] Store raw chat history in Supabase later if UI history is required; use Mem0 for extracted semantic memory.

## Task 6: Create LangGraph Workflow

**Files:**
- Create: `agent-service/app/graph/state.py`
- Create: `agent-service/app/graph/nodes.py`
- Create: `agent-service/app/graph/workflow.py`

- [ ] Define graph state with `messages`, `user_id`, `session_id`, `match_id`, `intent`, `memories`, `tool_results`, and `answer`.
- [ ] Add `memory_retrieve` node.
- [ ] Add `intent_router` node with intents: `match_preview`, `prediction_help`, `team_context`, `rules_help`, `general_chat`.
- [ ] Add `data_gather` node that chooses tools based on intent and `match_id`.
- [ ] Add `analysis` node that produces football analysis from tool results.
- [ ] Add `safety_review` node that removes betting, odds, wager, deposit, or gambling framing.
- [ ] Add `memory_write` node for useful preferences and session continuity.
- [ ] Compile the graph and expose a `run_agent_turn(...)` function.

## Task 7: Expose Agent API

**Files:**
- Modify: `agent-service/app/api/routes.py`
- Modify: `agent-service/app/models.py`

- [ ] Add `POST /agent/chat`.
- [ ] Add `POST /agent/analyze-match/{match_id}`.
- [ ] Use request shape:

```json
{
  "message": "Analyze this match",
  "session_id": "optional",
  "match_id": "optional"
}
```

- [ ] Return:

```json
{
  "answer": "...",
  "session_id": "...",
  "intent": "match_preview",
  "used_tools": ["get_match", "get_espn_context"]
}
```

- [ ] Add structured error responses for auth, tool failures, and LLM failures.

## Task 8: Add Frontend Agent Client

**Files:**
- Create: `src/services/agent.ts`
- Modify: `src/vite-env.d.ts` if needed

- [ ] Read `VITE_AGENT_API_URL`.
- [ ] Get Supabase access token from current session.
- [ ] Implement `sendAgentMessage(payload)`.
- [ ] Include `Authorization: Bearer <token>`.
- [ ] Surface clear errors when the Python service is offline.

## Task 9: Build Frontend Agent UI

**Files:**
- Create: `src/pages/Agent.tsx`
- Modify: `src/App.tsx`
- Modify: `src/config/navigation.ts`
- Optionally modify: `src/pages/MatchDetail.tsx`

- [ ] Add `/agent` route named `We Speak Football`.
- [ ] Build a compact chat workspace with conversation messages, input, loading state, and retry/error state.
- [ ] Add optional match selector using existing matches service.
- [ ] Add a match-detail panel button: `Ask Agent About This Match`.
- [ ] When launched from a match page, pass `match_id` automatically.
- [ ] Keep UI consistent with existing brutalist panel/card style.

## Task 10: Verification

- [ ] Run Python service health check:

```bash
curl http://localhost:8000/health
```

- [ ] Run frontend validation:

```bash
npm run lint
npm run build
```

- [ ] Manually test:
  - Unauthenticated agent call returns `401`.
  - Authenticated `/agent` chat returns a response.
  - Match-detail agent call includes match context.
  - Mem0 retrieves prior user preference in a later turn.
  - Response avoids betting/odds/wager language.

## Deployment Notes

- Deploy the Python service separately from the Vite app.
- Set production `VITE_AGENT_API_URL` to the deployed service URL.
- Configure CORS to allow the production frontend domain.
- Store `OPENAI_API_KEY`, `MEM0_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` only in the Python service environment.
- Add request logging before public launch, including user ID, session ID, intent, tools used, latency, and error class.

## Acceptance Criteria

- A signed-in user can open `/agent` and ask football-analysis questions.
- A signed-in user can ask the agent about a specific match from the match detail page.
- The agent fetches match/team/context data through tools rather than relying only on model memory.
- Mem0 stores and retrieves useful user/session context.
- No secret key is exposed to the frontend.
- `npm run lint` and `npm run build` pass for frontend changes.
