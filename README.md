# Paper Lens Workbench

Paper Lens Workbench is a local-first workspace for reading PDF and Markdown papers, capturing evidence, asking scoped questions, translating selected text, and building project-specific knowledge bases for literature reviews.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/SonnetZ/paper-lens-workbench.git
cd paper-lens-workbench
npm install
npm run setup:local
```

`npm install` installs the web application and its Node.js dependencies.

`npm run setup:local` automatically creates or updates the Python environment used by the bundled translation and embedding services. It installs Python 3.11, PyTorch, Transformers, Sentence Transformers, SentencePiece, Sacremoses, and Requests.

### 2. Start the complete local stack

CPU:

```bash
npm run dev:local:cpu
```

NVIDIA GPU for BGE-M3 embedding:

```bash
npm run dev:local:gpu
```

Open `http://127.0.0.1:3000`.

The one-command local stack starts:

| Component | Address | Purpose |
| --- | --- | --- |
| Paper Lens web app | `http://127.0.0.1:3000` | Reader, evidence, review forms, Ask, and knowledge bases |
| OPUS-MT | `http://127.0.0.1:8010` | Local English-to-Chinese selection translation |
| BGE-M3 | `http://127.0.0.1:8090/v1` | Local embeddings for knowledge search and retrieval |

The services run in the background. Their logs and PID files are written to `logs/`. The startup command prints the exact command for stopping them.

The OPUS-MT and BGE-M3 model files are downloaded on first use and cached locally. The first startup therefore takes longer and requires internet access.

## What Is Installed

### Web application

`npm install` installs:

- Next.js and React
- PDF.js for PDF rendering and text selection
- SQLite support through `better-sqlite3`; no database server is required
- Markdown rendering, UI icons, animations, testing, and build tooling

### Local AI helpers

`npm run setup:local` installs the runtime required by:

- OPUS-MT translation
- BGE-M3 embeddings
- CPU execution and optional CUDA execution through PyTorch

The setup command is safe to run again after pulling updates. It updates the existing local Python environment instead of creating another one.

### Generative LLM

The bundled local stack does **not** install or start a generative LLM. The app starts in mock mode until you select a local or online OpenAI-compatible model from the **Model source** panel.

For an existing local model server:

```bash
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_LLM_MODEL=your-model-name
```

For an online OpenAI-compatible provider:

```bash
ONLINE_LLM_BASE_URL=https://api.openai.com/v1
ONLINE_LLM_API_KEY=your-api-key
ONLINE_LLM_MODEL=your-model-name
ONLINE_LLM_CONFIG_SOURCE=env
```

These values can be placed in `.env.local`, or configured from the application where supported.

## Requirements

- Node.js 20 or newer
- npm
- Miniconda, Anaconda, or another installation that provides `conda`
- Internet access during installation and the first model download
- Optional: an NVIDIA GPU and compatible driver for `npm run dev:local:gpu`

You do not need to create a conda environment manually. `npm run setup:local` handles it.

## Try It Before Adding Your Corpus

The repository includes synthetic sample data. After Quick Start, the app opens without additional configuration.

To connect a review corpus, use **Library paths** in the app or create `.env.local`:

```bash
REVIEW_DATA_DIR=/absolute/path/to/review_data
PAPER_MD_DIR=/absolute/path/to/papers_md
PAPER_PDF_DIR=/absolute/path/to/papers_pdf
READER_DB_PATH=/absolute/path/to/reader.sqlite
READER_EXPORT_DIR=/absolute/path/to/exports
```

`REVIEW_DATA_DIR` should contain `full_text_screening.csv`. Saving the paths validates the corpus and can add missing base rows for discovered paper files.

## Lighter Startup Options

Start only the web application:

```bash
npm run dev
```

This is useful for UI development or mock-mode review. It does not start OPUS-MT or BGE-M3.

Start helpers separately:

```bash
npm run translate:opus
npm run embed:bge-m3:cpu
npm run embed:bge-m3:gpu
```

## Main Workflow

1. Open a PDF or Markdown paper.
2. Select text to save evidence, translate it, or ask a scoped question.
3. Record screening and extraction decisions with evidence locators.
4. Create or select a knowledge base for the review project.
5. Build the index and use knowledge retrieval for paper or corpus questions.
6. Export the evidence-backed review material.

Evidence, Ask conversations, review artifacts, and knowledge indexes are stored locally. Knowledge bases act as project namespaces, keeping review contexts separate.

## Knowledge Search

The bundled BGE-M3 service is configured automatically by `npm run dev:local:cpu` and `npm run dev:local:gpu`.

The knowledge store contains:

- document chunks extracted from papers, preferring PDF when both PDF and Markdown exist
- review-layer chunks from extraction artifacts and saved evidence

Rebuild the index after changing the embedding model, maximum length, or normalization settings.

## Local Files

By default the app stores runtime data in the project directory:

- `reader.sqlite` — local database
- `exports/` — generated review exports
- `logs/` — local service logs and PID files
- `~/.cache/paper-lens/models/` — downloaded OPUS-MT model files
- the standard Hugging Face cache — downloaded BGE-M3 files

Private environment files, databases, exports, model files, logs, and build output are excluded from Git and portable archives.

## Portable Packaging

```bash
npm run portable:check
npm run portable:pack
```

The generated archive contains the application and setup scripts, but excludes private runtime state and downloaded dependencies.

## Verification

```bash
npm test
npm run portable:check
npm run build
```

Use `npm run e2e` for browser-flow verification.
