# Development

Run commands from the Paper Lens Workbench repository root.

```bash
npm install
npm run portable:check
npm run portable:smoke
npm test
npm run lint
npm run build
npm run e2e
```

Use `LLM_MODE=mock` for automated tests. Do not test full-paper prompts against the local model server on port `8000`.

## Portability Rules

Treat this directory as a movable app box. Code inside the box should not rely
on files outside the app repository unless the user has configured external
corpus paths in `.env.local`.

The portability check verifies:

- required app files, migrations, tests, docs, and sample data are present
- required package scripts exist
- source files do not contain host-specific paths from the development machine
- generated directories are ignored by the portable source scan

Run:

```bash
npm run portable:check
```

Create a shareable archive:

```bash
npm run portable:smoke
npm run portable:pack
```

The archive goes to `dist/` and intentionally excludes runtime output:
`node_modules/`, `.next/`, `coverage/`, `test-results/`,
`playwright-report/`, `exports/`, `.env`, `.env.*`, `*.sqlite`,
`*.sqlite3`, `*.sqlite-wal`, `*.sqlite-shm`, and `*.db`.

Use only synthetic sample data in files committed under `sample-data/`.
Private papers, review CSVs, API keys, and reviewer databases should be
configured through local environment variables and kept outside the package.

The Git ignore rules and portable pack rules should stay aligned: only
`.env.example` is meant to travel with the source box. User-specific env files
and generated SQLite databases are local runtime state.
