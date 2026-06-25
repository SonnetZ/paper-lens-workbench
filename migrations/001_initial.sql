CREATE TABLE IF NOT EXISTS evidence_packets (
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

CREATE INDEX IF NOT EXISTS idx_evidence_packets_record_id
ON evidence_packets(record_id);

CREATE TABLE IF NOT EXISTS model_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extraction_artifacts (
  record_id TEXT PRIMARY KEY,
  method_typology TEXT NOT NULL DEFAULT '',
  prompting_practices TEXT NOT NULL DEFAULT '',
  evaluation_practices TEXT NOT NULL DEFAULT '',
  synthesis_note TEXT NOT NULL DEFAULT '',
  evidence_locator TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_path TEXT,
  title TEXT NOT NULL DEFAULT '',
  embedding_model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(record_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_record_id
ON knowledge_documents(record_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
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
  FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_record_id
ON knowledge_chunks(record_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id
ON knowledge_chunks(document_id);
