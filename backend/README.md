# Chu Chu backend

FastAPI + the AI engine. See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
for why it's built this way, and [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
to actually deploy it.

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
cp .env.example .env       # add your GROQ_API_KEY at minimum
uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000` — `http://localhost:8000/docs` gets
you FastAPI's interactive Swagger UI for free.

## Tests

```bash
pytest
```

`tests/test_streaming.py` is the one worth reading first — it stress-tests
the ```chu-action fence parser against hundreds of randomized chunk-boundary
splits, which is the trickiest hand-rolled logic in the backend (a streaming
API can split `` ```chu-action `` across network chunks anywhere, including
one character at a time).

## Project layout

```
app/
├── main.py                  FastAPI app, CORS, lifespan (http client + AI engine)
├── core/
│   ├── config.py             All environment variables, one place
│   ├── db.py                  Async SQLAlchemy engine/session (SQLite or Postgres)
│   ├── security.py             Shared-secret auth gate
│   └── ratelimit.py             In-memory rate limiter
├── models/
│   ├── orm.py                   SQLAlchemy tables: users, notes, reminders, history, settings
│   └── schemas.py                Pydantic request/response contracts
├── repositories/                  Data access, one file per table
├── services/
│   ├── ai_provider.py             Groq/Gemini/OpenRouter adapters + failover — the "AI engine"
│   ├── streaming.py                 Parses ```chu-action blocks out of a token stream
│   ├── automation_intents.py         The action allowlist + param validation
│   ├── prompts.py                     Chu Chu's system prompt
│   ├── search_provider.py             Tavily web search
│   ├── page_reader.py                  Lightweight fetch+extract (no headless browser)
│   └── voice_provider.py                Groq Whisper proxy
└── routers/                        One file per route group, thin — logic lives in services/
```

## A note on what's *not* here
No `torch`, `whisper`, `transformers`, or any local model runtime —
deliberately. Everything AI-shaped is a plain HTTP call to a free hosted API.
That's not a shortcut; it's the only way this fits in Render's free 512MB
instance at all. See "The core tension" in `docs/ARCHITECTURE.md`.
