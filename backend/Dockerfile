# Optional. Render's native Python runtime (see render.yaml) needs no Dockerfile —
# this exists for local parity (`docker compose up`) and as a fallback if you'd
# rather deploy to Render as a Docker service (runtime: docker) than a native one.
FROM python:3.12-slim AS base

WORKDIR /app

# System deps kept minimal on purpose: no compiler toolchain needed for anything
# in requirements.txt (asyncpg ships manylinux wheels), so we skip build-essential
# entirely and keep the image small.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
