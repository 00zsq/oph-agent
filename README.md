# Oph Agent Service (Next.js + LangGraph)

This service provides:

- SSR AI assistant page at `/ai`
- Agent API endpoint at `/api/chat`
- PDF upload proxy endpoint at `/api/pdf`
- Function-call bridge to existing Java backend APIs
- Internal RAG lookup + optional live web search

## 1) Install and prepare env

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` values:

- `OPENAI_API_KEY`
- `JAVA_API_BASE_URL`
- Java endpoint paths used in your current system
- Optional `TAVILY_API_KEY` for web search

## 2) Run

```bash
npm run dev
```

Open `http://localhost:3000/ai`.

## 3) Embed into existing Vue app via iframe

```html
<iframe
  src="http://localhost:3000/ai?token=YOUR_TOKEN"
  style="width: 100%; height: 100%; border: 0;"
  allow="clipboard-read; clipboard-write"
></iframe>
```

## API contracts

### POST `/api/chat`

Request body:

```json
{
  "question": "Query patient 1024 case and summarize key findings",
  "threadId": "optional-session-id"
}
```

Headers:

- `authentication: <token>` (compatible with current Java interface style)
- or `Authorization: Bearer <token>`

Response:

```json
{
  "threadId": "session-id",
  "data": "assistant answer"
}
```

### POST `/api/pdf`

Pass-through upload endpoint for Java PDF upload API. Send multipart `form-data` from frontend.

## Notes

- Current RAG is a simple in-memory demo retriever in `lib/agent/tools/rag-tools.ts`.
- Replace it with your vector DB retriever (e.g. PGVector, Milvus, Pinecone) next.
- Current function-call tools are in `lib/agent/tools/business-tools.ts` and can be expanded safely without changing Java backend code.
