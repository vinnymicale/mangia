# mangia

A self-hosted recipe manager. Single user, no login, one SQLite file.

## Run it

```bash
cp .env.example .env   # set LLM_API_KEY if you want URL import
docker compose up -d
```

Open <http://localhost:3000>.

All state lives in the `mangia-data` volume at `/data`. Back it up by
copying that directory while the container is stopped.

## Develop

```bash
npm install
cp .env.example .env    # point DATABASE_URL at ./dev.db
npx prisma migrate dev
node scripts/ensure-fts.mjs
npm run dev
```

```bash
npx vitest run          # unit and component tests
npx playwright test     # end-to-end tests
```

## Entering recipes

Three doors, all on **Add**:

1. **Paste a block of ingredients.** Parsed locally with no model call.
   Anything the parser is unsure of is flagged amber; one button sends only
   those lines to the LLM.
2. **Paste a URL.** JSON-LD is tried first; the model is a fallback.
3. **Type it out.** The same review table, starting empty.

Every row keeps its original text, so nothing is lost to a bad parse.

## LLM providers

Set `LLM_PROVIDER=gemini` with an `LLM_API_KEY`, or
`LLM_PROVIDER=openai-compatible` pointed at Ollama or LM Studio via
`LLM_BASE_URL`. The app works without either — you lose URL import and
the AI clean-up button, nothing else.
