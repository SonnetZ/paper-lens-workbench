import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function openReaderDb(dbPath: string): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  const migrationPath = path.join(process.cwd(), "migrations", "001_initial.sql");
  db.exec(readFileSync(migrationPath, "utf-8"));
  ensureEvidencePacketColumns(db);
  ensureBriefTables(db);
  ensureKnowledgeTables(db);
  return db;
}

function ensureEvidencePacketColumns(db: Database.Database) {
  const rows = db.prepare("PRAGMA table_info(evidence_packets)").all() as Array<{
    name: string;
  }>;
  const columns = new Set(rows.map((row) => row.name));
  if (!columns.has("pdf_verification_note")) {
    db.exec("ALTER TABLE evidence_packets ADD COLUMN pdf_verification_note TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("review_project_id")) {
    db.exec("ALTER TABLE evidence_packets ADD COLUMN review_project_id TEXT NOT NULL DEFAULT 'default'");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_evidence_packets_project_record
    ON evidence_packets(review_project_id, record_id);
  `);
}

function ensureKnowledgeTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      knowledge_base_id TEXT NOT NULL DEFAULT 'default',
      record_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_path TEXT,
      title TEXT NOT NULL DEFAULT '',
      embedding_model TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(knowledge_base_id, record_id, source_kind, source_id),
      FOREIGN KEY(knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      knowledge_base_id TEXT NOT NULL DEFAULT 'default',
      document_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      heading_path TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
    );
  `);
  migrateKnowledgeNamespace(db);
  db.exec(`
    INSERT OR IGNORE INTO knowledge_bases (id, name, created_at, updated_at)
    VALUES ('default', 'Default review', datetime('now'), datetime('now'));

    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_base
    ON knowledge_documents(knowledge_base_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_record_id
    ON knowledge_documents(record_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_base
    ON knowledge_chunks(knowledge_base_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_record_id
    ON knowledge_chunks(record_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id
    ON knowledge_chunks(document_id);
  `);
}

function migrateKnowledgeNamespace(db: Database.Database) {
  const documentColumns = tableColumns(db, "knowledge_documents");
  const chunkColumns = tableColumns(db, "knowledge_chunks");
  const documentSql = tableSql(db, "knowledge_documents");
  const alreadyNamespaced =
    documentColumns.has("knowledge_base_id") &&
    chunkColumns.has("knowledge_base_id") &&
    /UNIQUE\s*\(\s*knowledge_base_id\s*,\s*record_id\s*,\s*source_kind\s*,\s*source_id\s*\)/i.test(
      documentSql
    );
  if (alreadyNamespaced) return;

  const documentKnowledgeBaseExpression = documentColumns.has("knowledge_base_id")
    ? "COALESCE(knowledge_base_id, 'default')"
    : "'default'";
  const chunkKnowledgeBaseExpression = chunkColumns.has("knowledge_base_id")
    ? "COALESCE(knowledge_base_id, 'default')"
    : "'default'";

  db.exec("PRAGMA foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      INSERT OR IGNORE INTO knowledge_bases (id, name, created_at, updated_at)
      VALUES ('default', 'Default review', datetime('now'), datetime('now'));

      CREATE TABLE knowledge_documents_new (
        id TEXT PRIMARY KEY,
        knowledge_base_id TEXT NOT NULL DEFAULT 'default',
        record_id TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_path TEXT,
        title TEXT NOT NULL DEFAULT '',
        embedding_model TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(knowledge_base_id, record_id, source_kind, source_id),
        FOREIGN KEY(knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
      );

      INSERT OR REPLACE INTO knowledge_documents_new
        (id, knowledge_base_id, record_id, source_kind, source_id, source_path, title, embedding_model, content_hash, updated_at)
      SELECT
        id,
        ${documentKnowledgeBaseExpression},
        record_id,
        source_kind,
        source_id,
        source_path,
        title,
        embedding_model,
        content_hash,
        updated_at
      FROM knowledge_documents;

      CREATE TABLE knowledge_chunks_new (
        id TEXT PRIMARY KEY,
        knowledge_base_id TEXT NOT NULL DEFAULT 'default',
        document_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        heading_path TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        embedding_model TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      );

      INSERT OR REPLACE INTO knowledge_chunks_new
        (id, knowledge_base_id, document_id, record_id, source_kind, source_id, chunk_index, heading_path, text, token_count, embedding_model, embedding_json, created_at)
      SELECT
        id,
        ${chunkKnowledgeBaseExpression},
        document_id,
        record_id,
        source_kind,
        source_id,
        chunk_index,
        heading_path,
        text,
        token_count,
        embedding_model,
        embedding_json,
        created_at
      FROM knowledge_chunks;

      DROP TABLE knowledge_chunks;
      DROP TABLE knowledge_documents;
      ALTER TABLE knowledge_documents_new RENAME TO knowledge_documents;
      ALTER TABLE knowledge_chunks_new RENAME TO knowledge_chunks;
    `);
  });
  migrate();
  db.exec("PRAGMA foreign_keys = ON");
}

function ensureBriefTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brief_artifacts (
      review_project_id TEXT NOT NULL DEFAULT 'default',
      record_id TEXT NOT NULL,
      eligibility_suggestion TEXT NOT NULL DEFAULT '',
      rationale TEXT NOT NULL DEFAULT '',
      read_first_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      payload_scope TEXT NOT NULL DEFAULT 'Paper sections',
      model_settings_json TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (review_project_id, record_id)
    );
  `);
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function tableSql(db: Database.Database, table: string): string {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql?: string } | undefined;
  return row?.sql ?? "";
}
