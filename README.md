# Scoping Review Reader

A local, portable web app for reading papers, capturing evidence, and completing scoping-review screening and extraction work.

The app is intentionally contained inside this directory. It can be copied,
archived, and shared without the legacy `lit_reviewer` code around it.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Next.js.

## Portable App Box

This directory is designed to be copied as a self-contained app. From the
original repository:

```bash
cp -R apps/scoping-review-reader /path/to/scoping-review-reader
cd /path/to/scoping-review-reader
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

The archive is written to `dist/scoping-review-reader-0.1.0-portable.tar.gz`.
It includes source code, migrations, tests, docs, and synthetic sample data.
It excludes generated and private local state such as `node_modules/`, `.next/`,
`test-results/`, `playwright-report/`, `exports/`, `.env`, `.env.*`,
`*.sqlite`, `*.sqlite3`, `*.sqlite-wal`, `*.sqlite-shm`, and `*.db`.

To test the archive without touching your working copy:

```bash
mkdir -p /tmp/scoping-reader-check
tar -xzf dist/scoping-review-reader-0.1.0-portable.tar.gz -C /tmp/scoping-reader-check
cd /tmp/scoping-reader-check/scoping-review-reader
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
REVIEW_DATA_DIR=/absolute/path/to/scoping_review
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
- Online CC switch: uses the Codex auth file managed by `cc-switch` or Codex
  at `CODEX_HOME/auth.json`, falling back to `~/.codex/auth.json`.

The app currently sends only reviewer-selected evidence packets to Local or
Online models. Full-paper model calls remain blocked.

## Health Check

After starting the app, `GET /api/health` should return:

```json
{ "ok": true, "app": "scoping-review-reader" }
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
