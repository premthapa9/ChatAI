# AI Chat App

A minimal full-stack AI chat app: React (Vite) frontend + Express backend that
streams responses from a local **Ollama** server — fully free, no API key,
no usage limits.

```
ai-chat-app/
  backend/     Express server, /api/chat streams the model's reply via SSE
  frontend/    React UI, sends messages and renders the streamed reply
```

## How it works

1. The frontend keeps the conversation as an array of `{ role, content }`
   messages in React state.
2. On submit, it POSTs the whole message array to `POST /api/chat`.
3. The backend forwards the conversation to Ollama's `/api/chat` endpoint
   with `stream: true`, and re-emits each chunk to the browser as a
   Server-Sent Event (Ollama streams newline-delimited JSON; the backend
   translates that into the SSE format the frontend expects).
4. The frontend reads the SSE stream and appends each chunk to the last
   assistant message, so the reply appears token-by-token.

## Setup

### 0. Install Ollama and pull a model

- Download Ollama from https://ollama.com and install it.
- Pull a model (a few GB download, one-time):
  ```bash
  ollama pull llama3.1
  ```
- Ollama runs automatically as a local server on `http://localhost:11434`
  after install — no extra step needed to "start" it.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env already defaults to llama3.1 on localhost:11434 — edit only if you
# pulled a different model or run Ollama elsewhere
npm run dev
```

Runs on http://localhost:3001.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173 and proxies `/api/*` requests to the backend
(see `vite.config.js`).

## Extending it

- **Persist conversations**: swap the in-memory `messages` state for
  localStorage or a small database (SQLite is a good next step).
- **Multiple conversations / sidebar**: keep a list of conversation objects
  keyed by id, same shape as `messages`.
- **System prompt controls**: expose `SYSTEM_PROMPT` in `server.js` as a
  request field so the frontend can let users pick a persona.
- **Swap models**: change `OLLAMA_MODEL` in `.env` to any model you've
  pulled (`ollama pull mistral`, `ollama pull qwen2.5`, etc.) — no code
  changes needed.
- **Switch providers later**: only `server.js`'s `/api/chat` handler talks
  to Ollama; swapping in a hosted API (Anthropic, Groq, Gemini) later means
  editing just that one file — the frontend and SSE contract stay the same.
