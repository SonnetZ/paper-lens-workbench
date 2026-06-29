# Paper Lens Workbench

Paper Lens Workbench is a local web app for reading papers with LLM assistance. It supports PDF and Markdown reading, selected-text evidence capture, full-text screening notes, extraction notes, project-scoped knowledge bases, and corpus-level question answering.

It is designed as a portable app box: clone or copy this directory, install dependencies, point it at your review corpus, and keep all review data on your own machine.

## Requirements

- Node.js 20 or newer
- npm
- A machine that can install native Node packages

The app uses `better-sqlite3`, so you do not need to install or run a separate SQLite server. The local database is a normal file such as `reader.sqlite`.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev -- -p 3000
```

Open the URL printed by Next.js.

The sample configuration uses synthetic data in `sample-data/`, so the app can launch before you connect a private corpus.

## Review Corpus Setup

You can configure paths in the app from the corpus setup panel, or edit `.env.local`.

```bash
REVIEW_DATA_DIR=/absolute/path/to/review_data
PAPER_MD_DIR=/absolute/path/to/papers_md
PAPER_PDF_DIR=/absolute/path/to/papers_pdf
READER_DB_PATH=/absolute/path/to/reader.sqlite
READER_EXPORT_DIR=/absolute/path/to/exports
```

`REVIEW_DATA_DIR` should contain `full_text_screening.csv`. When you save corpus paths, the app checks the paper folders and can add missing base rows for discovered paper files.

## Reading And Evidence

The reader opens Markdown or PDF sources. PDF is the preferred source when both PDF and Markdown exist; Markdown remains useful for converted files and easier text reading.

Select text in PDF or Markdown to save an evidence packet, ask about the selected passage, or translate the passage. Manual reviewer notes can also be saved as evidence.

Evidence is isolated by the selected review project knowledge base. Switching from one knowledge base to another gives that project its own evidence tray and review-context layer.

## Knowledge Bases

Each knowledge base is a review project namespace. The selected knowledge base controls:

- saved evidence visibility
- document indexing
- review artifact indexing
- knowledge search
- corpus retrieval for Ask

The minimal RAG store has two layers:

- document layer: extracted paper text chunks, preferring PDF over Markdown
- review layer: extraction artifacts and saved evidence packets

Use `Build index` to index the corpus. If a paper has both PDF and Markdown, only the PDF text is indexed. Use `Add document` for the current paper; once indexed in the selected project, the button shows `Document indexed`.

The current embedding backend is `portable-hash-v1`, a dependency-free local baseline for portable search. `.env.example` includes optional model names such as `BAAI/bge-m3` and `BAAI/bge-reranker-v2-m3` for future stronger retrieval backends, but this version does not download or run those models automatically.

## Models

The model source panel supports mock mode, local OpenAI-compatible servers, and online OpenAI-compatible providers.

Local example:

```bash
LOCAL_LLM_BASE_URL=http://localhost:8000/v1
LOCAL_LLM_MODEL=your-local-model
```

Online example:

```bash
ONLINE_LLM_BASE_URL=https://api.openai.com/v1
ONLINE_LLM_API_KEY=your-api-key
ONLINE_LLM_MODEL=gpt-4.1-mini
ONLINE_LLM_CONFIG_SOURCE=env
```

Manual API keys entered in the browser are sent only to the local Next.js server for that request and are not written to disk. Environment and CC-switch/Codex-style config sources are read by the server process.

Model-assisted features send scoped payloads:

- selected evidence for selection Ask
- retrieved knowledge chunks for corpus Ask
- bounded paper text for Brief

The app does not send an unrestricted full paper by default.

## Translation

Recommended local translation setup for this project is `en↔zh` with OPUS-MT, running in the existing `lit_reviewer` conda environment:

```bash
conda run -n lit_reviewer python scripts/opus_mt_translate_server.py --host 127.0.0.1 --port 8010 --model Helsinki-NLP/opus-mt-en-zh
```

Then point the app at it with:

```bash
TRANSLATION_OPUS_BASE_URL=http://127.0.0.1:8010
```

This starts the helper server in `scripts/opus_mt_translate_server.py` and uses `TRANSLATION_OPUS_BASE_URL` from `.env.local`. You can also use the configured local or online LLM for selection translation.

## Portable Packaging

Check and pack the app:

```bash
npm run portable:check
npm run portable:pack
```

The archive excludes private runtime state such as `.env.local`, SQLite databases, exports, `node_modules`, build output, and test reports.

## Verification

```bash
npm test
npm run portable:check
npm run build
```

Run `npm run e2e` when you need browser-flow verification.
