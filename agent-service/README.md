# We Speak Football Agent

Separate FastAPI service for the Predict 2026 agent experience. It verifies the frontend Supabase access token, gathers football context through per-request Supabase clients bound to the caller's JWT (so row-level security applies), runs a LangGraph-style workflow, and stores useful semantic memory in Mem0.

## Local Setup

```bash
cd agent-service
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e .
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Configuration

Copy `.env.example` to `.env` and fill in the server-side keys. Keep `MEM0_API_KEY`, `OPENAI_API_KEY`, and `LLM_API_KEY` only in this Python service environment. `SUPABASE_ANON_KEY` is the public anon key — the service forwards each caller's JWT to PostgREST, so queries run under that user's row-level security policies rather than a privileged service role. The React frontend should only receive `VITE_AGENT_API_URL`.

Use `OPENAI_API_KEY` for the default OpenAI path, or set the OpenAI-compatible provider trio:

```env
LLM_API_KEY=
LLM_BASE_URL=https://provider.example/v1
LLM_MODEL=provider/model
```
