import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bundleName = "paper-lens-migration";
const pathKeys = {
  reviewDataDir: "corpus.reviewDataDir",
  paperPdfDir: "corpus.paperPdfDir",
  paperMdDir: "corpus.paperMdDir"
};

export async function exportWorkspace({ appRoot, archivePath, env = loadLocalEnv(appRoot) }) {
  const root = path.resolve(appRoot);
  const paths = resolveSourcePaths(root, env);
  const savedPaths = readSavedCorpusPaths(paths.readerDbPath);
  Object.assign(paths, savedPaths);

  if (!fs.existsSync(paths.readerDbPath)) {
    throw new Error(`Reader database does not exist: ${paths.readerDbPath}`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "paper-lens-migrate-export-"));
  const bundleRoot = path.join(tempRoot, bundleName);
  try {
    fs.mkdirSync(path.join(bundleRoot, "data"), { recursive: true });
    copyDirectory(paths.reviewDataDir, path.join(bundleRoot, "data/review_data"));
    copyDirectory(paths.paperPdfDir, path.join(bundleRoot, "data/papers_pdf"));
    copyDirectory(paths.paperMdDir, path.join(bundleRoot, "data/papers_md"));
    copyDirectory(paths.readerExportDir, path.join(bundleRoot, "data/exports"));

    const database = new Database(paths.readerDbPath, { readonly: true });
    await database.backup(path.join(bundleRoot, "data/reader.sqlite"));
    database.close();

    fs.writeFileSync(
      path.join(bundleRoot, "manifest.json"),
      `${JSON.stringify({ format: "paper-lens-migration", version: 1, createdAt: new Date().toISOString() }, null, 2)}\n`
    );
    fs.writeFileSync(path.join(bundleRoot, "README_IMPORT.txt"), importGuide());
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    runTar(["-czf", path.resolve(archivePath), "-C", tempRoot, bundleName]);
    return { archivePath: path.resolve(archivePath), paths };
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

export async function importWorkspace({ appRoot, archivePath, force = false }) {
  const root = path.resolve(appRoot);
  const archive = path.resolve(archivePath);
  if (!fs.existsSync(archive)) throw new Error(`Migration archive does not exist: ${archive}`);

  const entries = runTar(["-tzf", archive]).stdout.split(/\r?\n/).filter(Boolean);
  const entryTypes = runTar(["-tvzf", archive]).stdout.split(/\r?\n/).filter(Boolean);
  if (
    entries.length === 0 ||
    entries.some((entry) => !isSafeArchiveEntry(entry)) ||
    entryTypes.some((entry) => !["-", "d"].includes(entry[0]))
  ) {
    throw new Error("Migration archive contains unsafe or unexpected paths.");
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "paper-lens-migrate-import-"));
  try {
    runTar(["-xzf", archive, "-C", tempRoot]);
    const bundleRoot = path.join(tempRoot, bundleName);
    const manifest = JSON.parse(fs.readFileSync(path.join(bundleRoot, "manifest.json"), "utf8"));
    if (manifest.format !== "paper-lens-migration" || manifest.version !== 1) {
      throw new Error("Unsupported Paper Lens migration archive.");
    }

    const destinations = {
      reviewDataDir: path.join(root, "paper-lens-data/review_data"),
      paperPdfDir: path.join(root, "paper-lens-data/papers_pdf"),
      paperMdDir: path.join(root, "paper-lens-data/papers_md"),
      readerExportDir: path.join(root, "exports"),
      readerDbPath: path.join(root, "reader.sqlite")
    };
    const existing = Object.values(destinations).filter((pathname) => fs.existsSync(pathname));
    if (existing.length > 0 && !force) {
      throw new Error(`Destination already exists: ${existing[0]}. Re-run with --force to replace it.`);
    }

    if (force) {
      for (const pathname of Object.values(destinations)) {
        fs.rmSync(pathname, { force: true, recursive: true });
      }
    }

    copyDirectory(path.join(bundleRoot, "data/review_data"), destinations.reviewDataDir);
    copyDirectory(path.join(bundleRoot, "data/papers_pdf"), destinations.paperPdfDir);
    copyDirectory(path.join(bundleRoot, "data/papers_md"), destinations.paperMdDir);
    copyDirectory(path.join(bundleRoot, "data/exports"), destinations.readerExportDir);
    fs.copyFileSync(path.join(bundleRoot, "data/reader.sqlite"), destinations.readerDbPath);
    rewriteSavedCorpusPaths(destinations.readerDbPath, destinations);
    writeLocalPaths(root, destinations);
    return destinations;
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

export function defaultArchivePath(appRoot) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(path.resolve(appRoot), "dist", `paper-lens-migration-${stamp}.tar.gz`);
}

export function importGuide() {
  return [
    "Paper Lens workspace migration",
    "",
    "On the new device:",
    "1. git clone https://github.com/SonnetZ/paper-lens-workbench.git",
    "2. cd paper-lens-workbench && npm install",
    "3. npm run migrate:import -- --file /path/to/paper-lens-migration.tar.gz",
    "4. npm run dev:local:cpu",
    "",
    "The first local start creates the lit_reviewer Python environment when needed.",
    "Use --force only when you intend to replace existing local workspace data.",
    ""
  ].join("\n");
}

function resolveSourcePaths(root, env) {
  return {
    reviewDataDir: resolvePath(root, env.REVIEW_DATA_DIR, "./sample-data/review_data"),
    paperPdfDir: resolvePath(root, env.PAPER_PDF_DIR, "./sample-data/papers_pdf"),
    paperMdDir: resolvePath(root, env.PAPER_MD_DIR, "./sample-data/papers_md"),
    readerDbPath: resolvePath(root, env.READER_DB_PATH, "./reader.sqlite"),
    readerExportDir: resolvePath(root, env.READER_EXPORT_DIR, "./exports")
  };
}

function resolvePath(root, value, fallback) {
  const selected = value?.trim() || fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(root, selected);
}

function readSavedCorpusPaths(readerDbPath) {
  if (!fs.existsSync(readerDbPath)) return {};
  const database = new Database(readerDbPath, { readonly: true });
  try {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'model_config'").get();
    if (!table) return {};
    const rows = database
      .prepare("SELECT key, value FROM model_config WHERE key IN (?, ?, ?)")
      .all(pathKeys.reviewDataDir, pathKeys.paperPdfDir, pathKeys.paperMdDir);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      ...(values.get(pathKeys.reviewDataDir) ? { reviewDataDir: values.get(pathKeys.reviewDataDir) } : {}),
      ...(values.get(pathKeys.paperPdfDir) ? { paperPdfDir: values.get(pathKeys.paperPdfDir) } : {}),
      ...(values.get(pathKeys.paperMdDir) ? { paperMdDir: values.get(pathKeys.paperMdDir) } : {})
    };
  } finally {
    database.close();
  }
}

function rewriteSavedCorpusPaths(readerDbPath, destinations) {
  const database = new Database(readerDbPath);
  try {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'model_config'").get();
    if (!table) return;
    const statement = database.prepare(
      `INSERT INTO model_config (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    const now = new Date().toISOString();
    statement.run(pathKeys.reviewDataDir, destinations.reviewDataDir, now);
    statement.run(pathKeys.paperPdfDir, destinations.paperPdfDir, now);
    statement.run(pathKeys.paperMdDir, destinations.paperMdDir, now);
  } finally {
    database.close();
  }
}

function writeLocalPaths(root, destinations) {
  const envPath = path.join(root, ".env.local");
  const replacements = new Map([
    ["REVIEW_DATA_DIR", "./paper-lens-data/review_data"],
    ["PAPER_PDF_DIR", "./paper-lens-data/papers_pdf"],
    ["PAPER_MD_DIR", "./paper-lens-data/papers_md"],
    ["READER_DB_PATH", "./reader.sqlite"],
    ["READER_EXPORT_DIR", "./exports"]
  ]);
  const kept = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((line) => !replacements.has(line.split("=", 1)[0]))
    : [];
  while (kept.at(-1) === "") kept.pop();
  fs.writeFileSync(envPath, `${[...kept, ...[...replacements].map(([key, value]) => `${key}=${value}`)].join("\n")}\n`);
}

function loadLocalEnv(appRoot) {
  const env = { ...process.env };
  for (const filename of [".env.local", ".env"]) {
    const pathname = path.join(appRoot, filename);
    if (!fs.existsSync(pathname)) continue;
    for (const line of fs.readFileSync(pathname, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || env[match[1]] !== undefined) continue;
      env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return env;
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true, dereference: true });
}

function isSafeArchiveEntry(entry) {
  const normalized = entry.replace(/\\/g, "/").replace(/\/$/, "");
  return normalized === bundleName || (
    normalized.startsWith(`${bundleName}/`) &&
    !normalized.split("/").includes("..") &&
    !path.posix.isAbsolute(normalized)
  );
}

function runTar(args) {
  const result = spawnSync("tar", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "tar command failed");
  return result;
}
