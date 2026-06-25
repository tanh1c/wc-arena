# Agent Auto-Predictions — Design

> Date: 2026-06-25
> Status: Approved design, pending implementation plan
> Branch: `feat/agent-auto-predictions`

## Mục tiêu

Cho AI agent ("We Speak Football") trở thành một **đối thủ thật trên leaderboard**: có account riêng (user thật), tự động dự đoán và đặt prediction định kỳ qua đúng cửa ngõ của người chơi, leo bảng xếp hạng cùng người dùng thật.

## Quyết định cốt lõi

- **Account agent = user thật + JWT.** Không service-role, không bypass RLS. Agent đi qua Edge Function `submit_prediction` y như người chơi → tự động chơi đúng luật (lock-time, scoring, rate-limit, upsert profile).
- **Trigger = endpoint cron + UptimeRobot.** Không dùng scheduler nội bộ (Render free sleep khi idle). UptimeRobot (đã có sẵn) ping endpoint định kỳ; `CRON_SECRET` chống gọi bừa.
- **Bộ não = LLM (DeepSeek)** tái dùng pipeline `_call_llm` hiện có + context trận (FIFA rank, ESPN, community signal).
- **Lấy JWT = tự sign-in bằng email+password (env).** Stateless, chạy lại an toàn, không lưu refresh-token state.

## Kiến trúc

```
UptimeRobot (mỗi ~30 phút)
   │  POST /cron/run-agent-picks   (header: x-cron-secret)
   ▼
agent-service (FastAPI, Render free)
   1. Verify CRON_SECRET (secrets.compare_digest) — sai → 401
   2. Sign-in account agent (AGENT_EMAIL + AGENT_PASSWORD) → JWT tươi
   3. Query trận "sắp lock trong X giờ, chưa có pick của agent" (JWT agent + RLS)
   4. for mỗi trận (giới hạn N/lần):
        a. Gather context (tái dùng football_tools)
        b. LLM pick → parse {home, away, confidence} + validate
        c. Gọi Edge Function submit_prediction (JWT agent)
   5. Trả JSON {picked, skipped, errors}
```

Agent không cần đặc quyền. Edge Function `submit_prediction` tự: validate lock-time, upsert profile, rate-limit theo user.id, set status='submitted'.

## Thành phần (file)

Trong `agent-service/`:

| File | Vai trò |
|---|---|
| `app/agent_account.py` (mới) | Sign-in agent (email+pw env) → JWT tươi. Stateless. |
| `app/tools/prediction_tools.py` (mới) | (a) query trận sắp lock chưa pick (JWT agent); (b) gọi `submit_prediction` đúng schema. |
| `app/picks/picker.py` (mới) | Bộ não: context 1 trận → `_call_llm` → parse `{homeScore, awayScore, confidence}` + validate (int ≥0, outcome khớp tỷ số). |
| `app/api/routes.py` (sửa) | Thêm `POST /cron/run-agent-picks`, bảo vệ bằng `CRON_SECRET`. |
| `app/settings.py` (sửa) | Thêm `agent_email`, `agent_password`, `cron_secret`, `agent_pick_window_hours`, `agent_pick_batch_limit`. |
| `tests/` (mới) | picker parse/validate; cron auth (sai secret → 401); query lọc trận chưa pick. |

Tái dùng: `nodes._call_llm`, `supabase_tools.get_user_supabase_client`, settings pattern.

**Reasoning tách khỏi pipeline chat:** picker là đường đi riêng (cron → pick → submit), KHÔNG đụng LangGraph 6-node của chat. Hai luồng độc lập, chỉ chia sẻ helper cấp thấp.

**Không tạo gì ở frontend.** Agent hiện trên leaderboard/squad tự nhiên vì là user thật; UI hiện có tự render.

## Data flow & xử lý lỗi

1. Verify `CRON_SECRET` → sai: 401, dừng.
2. Sign-in agent → JWT. Lỗi → log + 502, không làm gì thêm.
3. Query: `matches.status='open'` AND `lock_at ∈ [now, now+X giờ]`, loại trận agent đã pick.
4. for mỗi trận (giới hạn N/lần):
   - Gather context → LLM pick → parse.
   - Parse fail / số phi lý → **SKIP** (log, không submit rác).
   - `submit_prediction`: 409 deadline → SKIP; 429 rate-limit → **dừng vòng lặp** (lần sau tiếp); 200 → đếm.
5. Trả `{picked: n, skipped: m, errors: [...]}`.

**Nguyên tắc:**
- **Idempotent:** bước 3 chỉ lấy trận chưa pick → cron chạy lại nhiều lần không pick trùng.
- **Giới hạn N/lần (mặc định 10):** tránh timeout Render free + đốt LLM. Trận còn lại để lần sau (idempotent nên phủ hết).
- **Lỗi 1 trận không hỏng cả batch:** mỗi trận try/except riêng.
- **Cửa sổ lock X (mặc định 48h):** chỉ pick trận sắp lock, giống người chơi đợi gần giờ mới chốt.

## Config (env trên Render)

| Key | Mục đích |
|---|---|
| `AGENT_EMAIL` | email account agent (user thật) |
| `AGENT_PASSWORD` | password agent — chỉ ở backend env |
| `CRON_SECRET` | chuỗi ngẫu nhiên, UptimeRobot gửi kèm header |
| `AGENT_PICK_WINDOW_HOURS` | mặc định 48 |
| `AGENT_PICK_BATCH_LIMIT` | mặc định 10 |

## Bảo mật

- `CRON_SECRET` so sánh bằng `secrets.compare_digest` (chống timing attack). Sai/thiếu → 401.
- `AGENT_PASSWORD` chỉ ở env backend, không log, không trả ra response.
- Account agent là user thường (`role='user'`), không quyền admin → lộ cũng chỉ chơi như người thường.

## Tạo account agent

Thủ công 1 lần: đăng ký 1 account qua chính app (email riêng, vd `ai-oracle@...`) với tên hiển thị mong muốn. Đó là "nhân vật" agent. Không cần script.

## Testing

- `picker`: parse output LLM đúng/sai (số âm, outcome lệch tỷ số, text rác) → unit test, mock `_call_llm`.
- Cron auth: thiếu/sai `CRON_SECRET` → 401; đúng → chạy.
- Query "trận chưa pick": mock Supabase, verify lọc đúng.
- Không gọi LLM/Edge Function thật trong CI (mock hết) — test nhanh, không tốn quota.
- Verify: `python -m unittest discover` (backend); frontend không đổi (sanity lint).

## Ngoài scope (YAGNI)

- Badge/nhãn "AI" cạnh tên agent trên UI — việc riêng, làm sau nếu muốn.
- Nhiều nhân vật agent với personality khác nhau — bản này chỉ 1 agent.
- Agent tự reasoning đa bước / tool-calling thật — giữ fixed pipeline.
- Agent cập nhật/đổi pick đã đặt — bản này chỉ pick 1 lần/trận (trận đã pick bị loại khỏi query).
