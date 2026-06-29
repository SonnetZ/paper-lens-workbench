import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openReaderDb } from "@/lib/server/sqliteStore";

describe("sqlite store migrations", () => {
  it("upgrades an evidence table created before review project namespaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-sqlite-"));
    const dbPath = path.join(root, "reader.sqlite");
    const oldDb = new Database(dbPath);
    oldDb.exec(`
      CREATE TABLE evidence_packets (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        source_format TEXT NOT NULL,
        source_path TEXT,
        evidence_locator TEXT NOT NULL,
        quote_snippet TEXT NOT NULL,
        heading_path TEXT,
        page_number INTEGER,
        reviewer_note TEXT NOT NULL DEFAULT '',
        pdf_verification_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
    `);
    oldDb.close();

    const db = openReaderDb(dbPath);
    const columns = db.prepare("PRAGMA table_info(evidence_packets)").all() as Array<{ name: string }>;
    const indexes = db.prepare("PRAGMA index_list(evidence_packets)").all() as Array<{ name: string }>;
    db.close();

    expect(columns.map((column) => column.name)).toContain("review_project_id");
    expect(indexes.map((index) => index.name)).toContain("idx_evidence_packets_project_record");
  });
});
