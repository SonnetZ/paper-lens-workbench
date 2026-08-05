import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportWorkspace, importWorkspace } from "../../scripts/migrate-core.mjs";

describe("workspace migration", () => {
  it("exports and imports the database, corpus, papers, and exports with portable paths", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-lens-migration-"));
    const sourceRoot = path.join(root, "source");
    const targetRoot = path.join(root, "target");
    const reviewDataDir = path.join(sourceRoot, "review-data");
    const paperPdfDir = path.join(sourceRoot, "pdfs");
    const paperMdDir = path.join(sourceRoot, "markdown");
    const exportDir = path.join(sourceRoot, "review-exports");
    const readerDbPath = path.join(sourceRoot, "workspace.sqlite");
    const archivePath = path.join(root, "workspace.tar.gz");

    fs.mkdirSync(reviewDataDir, { recursive: true });
    fs.mkdirSync(paperPdfDir, { recursive: true });
    fs.mkdirSync(paperMdDir, { recursive: true });
    fs.mkdirSync(exportDir, { recursive: true });
    fs.writeFileSync(path.join(reviewDataDir, "full_text_screening.csv"), "record_id\nFT0001\n");
    fs.writeFileSync(path.join(paperPdfDir, "paper.pdf"), "pdf");
    fs.writeFileSync(path.join(paperMdDir, "paper.md"), "# Paper");
    fs.writeFileSync(path.join(exportDir, "review.md"), "# Review");

    const db = new Database(readerDbPath);
    db.exec("CREATE TABLE model_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
    db.exec("CREATE TABLE migration_marker (value TEXT NOT NULL)");
    db.prepare("INSERT INTO migration_marker (value) VALUES (?)").run("kept");
    for (const [key, value] of [
      ["corpus.reviewDataDir", reviewDataDir],
      ["corpus.paperPdfDir", paperPdfDir],
      ["corpus.paperMdDir", paperMdDir]
    ]) {
      db.prepare("INSERT INTO model_config VALUES (?, ?, ?)").run(key, value, new Date().toISOString());
    }
    db.close();

    await exportWorkspace({
      appRoot: sourceRoot,
      archivePath,
      env: {
        REVIEW_DATA_DIR: reviewDataDir,
        PAPER_PDF_DIR: paperPdfDir,
        PAPER_MD_DIR: paperMdDir,
        READER_DB_PATH: readerDbPath,
        READER_EXPORT_DIR: exportDir
      }
    });

    fs.mkdirSync(targetRoot, { recursive: true });
    const result = await importWorkspace({ appRoot: targetRoot, archivePath });

    expect(fs.readFileSync(path.join(targetRoot, "paper-lens-data/review_data/full_text_screening.csv"), "utf8"))
      .toContain("FT0001");
    expect(fs.readFileSync(path.join(targetRoot, "paper-lens-data/papers_pdf/paper.pdf"), "utf8"))
      .toBe("pdf");
    expect(fs.readFileSync(path.join(targetRoot, "paper-lens-data/papers_md/paper.md"), "utf8"))
      .toBe("# Paper");
    expect(fs.readFileSync(path.join(targetRoot, "exports/review.md"), "utf8")).toBe("# Review");
    expect(result.readerDbPath).toBe(path.join(targetRoot, "reader.sqlite"));

    const importedDb = new Database(result.readerDbPath, { readonly: true });
    expect(importedDb.prepare("SELECT value FROM migration_marker").pluck().get()).toBe("kept");
    expect(importedDb.prepare("SELECT value FROM model_config WHERE key = ?").pluck().get("corpus.paperPdfDir"))
      .toBe(path.join(targetRoot, "paper-lens-data/papers_pdf"));
    importedDb.close();

    const envFile = fs.readFileSync(path.join(targetRoot, ".env.local"), "utf8");
    expect(envFile).toContain("REVIEW_DATA_DIR=./paper-lens-data/review_data");
    expect(envFile).toContain("READER_DB_PATH=./reader.sqlite");

    await expect(importWorkspace({ appRoot: targetRoot, archivePath })).rejects.toThrow(
      /already exists/i
    );
  });
});
