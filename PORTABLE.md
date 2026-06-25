# Portable Handoff Guide

This directory is the whole app. You can copy it away from the parent
repository, install dependencies inside the copied directory, and run it with
synthetic sample data before connecting a private review corpus.

## What Travels

- Next.js app source, API routes, migrations, tests, and portable scripts
- Synthetic screening CSV and sample Markdown under `sample-data/`
- `.env.example` with safe local defaults
- Documentation for setup, development, and portability checks

## What Stays Local

- `.env`, `.env.local`, and other private environment files
- API keys and provider-specific model credentials
- Private paper PDFs, private Markdown conversions, and full review CSVs
- SQLite databases, exports, build output, reports, and `node_modules/`

## Verify Before Sharing

Run these commands from this directory:

```bash
npm run portable:check
npm run portable:smoke
npm run portable:pack
```

`portable:smoke` creates the archive, extracts it to a temporary directory,
and runs the portability check on the extracted copy. It does not install
packages and does not call an LLM.

## Recipient Setup

```bash
npm install
cp .env.example .env.local
npm run portable:check
npm run dev
```

To connect a real corpus, edit `.env.local` so the data paths point to local
copies of the review data:

```bash
REVIEW_DATA_DIR=/absolute/path/to/review_data
PAPER_MD_DIR=/absolute/path/to/papers_md
PAPER_PDF_DIR=/absolute/path/to/papers_pdf
READER_DB_PATH=/absolute/path/to/reader.sqlite
```

You can also configure these paths after the app starts from the `Corpus setup`
panel in the left sidebar. The panel saves the selected local paths into the
local SQLite database and reloads the paper queue without restarting the server.

Keep `.env.local`, generated databases, and exports private.

## Model Sources After Copying

Model settings can be selected from the app UI for the current session:

- Local model: provide the local port and model name; the test button calls
  only `/v1/models`.
- Online manual key: paste a key in the UI for the current session only.
- Online environment key: set `ONLINE_LLM_API_KEY` in `.env.local`.
- Online CC switch: use a Codex auth file managed by `cc-switch` or Codex at
  `CODEX_HOME/auth.json`, with `~/.codex/auth.json` as the fallback.

No API keys, private corpora, SQLite evidence stores, or exports are included
in the portable archive.
