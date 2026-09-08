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

Requires **Node 22 or newer** — `better-sqlite3` declares `engines: >=22` and
ships prebuilt binaries for the Node 22 ABI. On Node 20 the native module
segfaults rather than failing cleanly.

```bash
npm install                       # postinstall runs `prisma generate`
cp .env.example .env
sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' .env
npm run db:migrate                # creates dev.db and applies migrations
node scripts/ensure-fts.mjs       # builds the FTS5 table and its triggers
npm run dev
```

Open <http://localhost:3000>.

The FTS5 virtual table lives outside the Prisma schema, so
`scripts/ensure-fts.mjs` has to run after any reset of the database. It is
idempotent — running it again on an up-to-date database is a no-op.

### Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit and component tests (vitest)
npm run test:e2e    # rebuilds e2e.db, then runs Playwright
npm run test:all    # all three, in that order
```

On a fresh clone the browser has to be installed once before the e2e suite
will run:

```bash
npx playwright install --with-deps chromium
```

`npm run test:e2e` drops and recreates `e2e.db` before every run, so it never
touches `dev.db`. Running `npx playwright test` directly skips that setup and
will fail against a missing database.

### Other scripts

```bash
npm run build       # production build (output: standalone)
npm run db:generate # regenerate the Prisma client into src/generated/prisma
npm run db:studio   # browse the database
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
