# Paper Lens Workbench

A local, portable web app for LLM-assisted paper reading, PDF/Markdown evidence capture, screening, extraction, and corpus-level review work.

The app is intentionally self-contained. It can be copied, archived, and shared
as a standalone project without private corpora or local runtime state.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Next.js.

## Portable App Box

This directory is designed to be copied or cloned as a self-contained app:

```bash
cd /path/to/paper-lens-workbench
npm install
cp .env.example .env.local
npm run portable:check
npm run dev
```

To create a clean archive for sharing:

```bash
npm run portable:smoke
npm run portable:pack
```

The archive is written to `dist/paper-lens-workbench-0.1.0-portable.tar.gz`.
It includes source code, migrations, tests, docs, and synthetic sample data.
It excludes generated and private local state such as `node_modules/`, `.next/`,
`test-results/`, `playwright-report/`, `exports/`, `.env`, `.env.*`,
`*.sqlite`, `*.sqlite3`, `*.sqlite-wal`, `*.sqlite-shm`, and `*.db`.

To test the archive without touching your working copy:

```bash
mkdir -p /tmp/paper-lens-check
tar -xzf dist/paper-lens-workbench-0.1.0-portable.tar.gz -C /tmp/paper-lens-check
cd /tmp/paper-lens-check/paper-lens-workbench
npm install
cp .env.example .env.local
npm run portable:check
npm run dev
```

## Data Paths

The app can configure review data paths from the `Corpus setup` panel in the
left sidebar. Paste local absolute paths for:

- Review data folder
- Markdown papers folder
- PDF papers folder

Click `Save corpus paths`. The server checks for `full_text_screening.csv`,
counts Markdown/PDF files, saves the paths in the local SQLite database, and
reloads the paper queue without requiring a restart.

The app also reads initial fallback paths from environment variables:

- `REVIEW_DATA_DIR`: directory containing `full_text_screening.csv` and `controlled_vocabularies.json`
- `PAPER_MD_DIR`: directory containing Markdown paper conversions
- `PAPER_PDF_DIR`: directory containing source PDFs
- `READER_DB_PATH`: local SQLite database for evidence packets and app artifacts

The default `.env.example` points to synthetic `sample-data/` so the app can run without the private full review corpus.

To use a real review corpus after copying the app, edit `.env.local`:

```bash
REVIEW_DATA_DIR=/absolute/path/to/review_data
PAPER_MD_DIR=/absolute/path/to/papers_md
PAPER_PDF_DIR=/absolute/path/to/papers_pdf
READER_DB_PATH=/absolute/path/to/reader.sqlite
```

Keep `.env.local` private. API keys, private corpus paths, generated evidence
databases, and local exports are never packaged by `npm run portable:pack`.

## Model Sources

The model picker in the review workspace is session-level. It lets a reviewer
choose Local or Online without rewriting `.env.local`.

- Local: enter a port and model name. The connection test only calls
  `GET /v1/models`.
- Online manual key: paste a key for the current browser session. The key is
  sent only to this local server for the scoped request and is not written to
  disk.
- Online environment key: set `ONLINE_LLM_API_KEY` in `.env.local`.
- Online CC switch / Codex config: reads OpenAI-compatible settings visible to
  the Paper Lens server process: `ONLINE_LLM_*`, provider `base_url` / `model`
  values in `CODEX_HOME/config.toml`, provider token fields such as
  `experimental_bearer_token`, `api_key`, `bearer_token`, or `token`, and a
  string API key in `CODEX_HOME/auth.json` or `~/.codex/auth.json`. If
  `ONLINE_LLM_CONFIG_SOURCE` is blank, the app automatically uses configured
  environment variables or Codex provider config before falling back to manual.
  It cannot use the hidden auth token from this Codex chat session.

The app sends only reviewer-selected evidence packets or retrieved knowledge
base chunks to Local or Online models. Full-paper model calls remain blocked.

## Knowledge Bases

The Corpus `Knowledge base` card supports multiple named RAG indexes in the
same local SQLite database. Create one knowledge base per review project, select
it, then add paper text, current-paper review artifacts, or included-paper review
outputs. `Knowledge search` and AI Help `Ask` use the currently selected
knowledge base.

Example: create `Scoping review A`, add included review outputs, search
`prompt transparency`, then switch to `Scoping review B`. Results from A will not
appear in B unless you add them there too.

## Selection Translation

Start the default local English-to-Chinese translator in a second terminal:

```bash
npm run translate:opus
```

Select text in Markdown or PDF, then click `Translate selection`. The default
provider calls `Helsinki-NLP/opus-mt-en-zh` through
`TRANSLATION_OPUS_BASE_URL`; the same popup can switch to the configured Local
or Online LLM.

## Health Check

After starting the app, `GET /api/health` should return:

```json
{ "ok": true, "app": "paper-lens-workbench" }
```

## Local LLM Safety

Automated tests and setup checks must not send full paper text to `localhost:8000`. The local connection test calls only `GET /v1/models`.

## Verification

```bash
npm run portable:check
npm run portable:smoke
npm test
npm run lint
npm run build
npm run e2e
```

These commands must pass in mock mode. They must not send full paper text to local port `8000`.
