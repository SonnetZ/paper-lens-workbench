import crypto from "node:crypto";
import type { AppConfig, KnowledgeBaseStatus, KnowledgeSearchResult } from "@/lib/types";
import { listEvidencePackets } from "@/lib/server/evidence";
import { readExtractionArtifact } from "@/lib/server/extraction";
import { openReaderDb } from "@/lib/server/sqliteStore";
import { getPaperByRecordId, loadPaperQueue, readMarkdownForPaper } from "@/lib/server/sourceRegistry";

export type KnowledgeSourceKind = "paper" | "artifact" | "evidence";

export interface KnowledgeIngestResult {
  documentCount: number;
  chunkCount: number;
  embeddingModel: string;
}

export interface KnowledgeSearchOptions {
  topK?: number;
  recordId?: string;
}

interface KnowledgeDocumentInput {
  recordId: string;
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  sourcePath: string | null;
  title: string;
  content: string;
}

interface ChunkInput {
  headingPath: string;
  text: string;
}

interface KnowledgeChunkRow {
  id: string;
  document_id: string;
  record_id: string;
  source_kind: KnowledgeSourceKind;
  source_id: string;
  heading_path: string;
  text: string;
  embedding_json: string;
}

const embeddingModel = "portable-hash-v1";
const embeddingDimensions = 256;
const maxChunkWords = 180;
const minChunkWords = 24;

export async function ingestPaperMarkdown(
  config: AppConfig,
  recordId: string
): Promise<KnowledgeIngestResult> {
  const paper = await getPaperByRecordId(config, recordId);
  const markdown = await readMarkdownForPaper(config, recordId);
  if (!paper || !markdown) throw new Error(`Markdown not found for paper: ${recordId}`);
  return upsertKnowledgeDocument(config, {
    recordId,
    sourceKind: "paper",
    sourceId: paper.sourceFilename || paper.recordId,
    sourcePath: markdown.path,
    title: paper.title || paper.sourceFilename || paper.recordId,
    content: markdown.content
  });
}

export async function ingestCorpusMarkdown(config: AppConfig): Promise<KnowledgeIngestResult> {
  const papers = await loadPaperQueue(config);
  let documentCount = 0;
  let chunkCount = 0;
  for (const paper of papers) {
    if (!paper.hasMarkdown) continue;
    const result = await ingestPaperMarkdown(config, paper.recordId);
    documentCount += result.documentCount;
    chunkCount += result.chunkCount;
  }
  return { documentCount, chunkCount, embeddingModel };
}

export function ingestReviewArtifacts(
  config: AppConfig,
  recordId: string
): KnowledgeIngestResult {
  const results: KnowledgeIngestResult[] = [];
  const extraction = readExtractionArtifact(config, recordId);
  const artifactContent = [
    ["Method typology", extraction.methodTypology],
    ["Prompting practices", extraction.promptingPractices],
    ["Evaluation practices", extraction.evaluationPractices],
    ["Synthesis note", extraction.synthesisNote],
    ["Evidence locator", extraction.evidenceLocator]
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `## ${label}\n\n${value}`)
    .join("\n\n");

  if (artifactContent.trim()) {
    results.push(
      upsertKnowledgeDocument(config, {
        recordId,
        sourceKind: "artifact",
        sourceId: "extraction",
        sourcePath: null,
        title: `${recordId} extraction artifact`,
        content: artifactContent
      })
    );
  }

  const evidencePackets = listEvidencePackets(config, recordId);
  const evidenceContent = evidencePackets
    .map((packet) => {
      const body = packet.quoteSnippet || packet.reviewerNote;
      const pdfNote = packet.pdfVerificationNote ? `\nPDF verification: ${packet.pdfVerificationNote}` : "";
      return `## ${packet.evidenceLocator}\n\n${body}${pdfNote}`;
    })
    .filter((text) => text.trim())
    .join("\n\n");

  if (evidenceContent.trim()) {
    results.push(
      upsertKnowledgeDocument(config, {
        recordId,
        sourceKind: "evidence",
        sourceId: "evidence-packets",
        sourcePath: null,
        title: `${recordId} evidence packets`,
        content: evidenceContent
      })
    );
  }

  return summarizeResults(results);
}

export function getKnowledgeBaseStatus(config: AppConfig): KnowledgeBaseStatus {
  const db = openReaderDb(config.readerDbPath);
  const documentRow = db
    .prepare(
      `SELECT
        COUNT(*) AS document_count,
        SUM(CASE WHEN source_kind = 'paper' THEN 1 ELSE 0 END) AS paper_document_count,
        SUM(CASE WHEN source_kind = 'artifact' THEN 1 ELSE 0 END) AS artifact_document_count,
        SUM(CASE WHEN source_kind = 'evidence' THEN 1 ELSE 0 END) AS evidence_document_count,
        MAX(updated_at) AS updated_at
       FROM knowledge_documents`
    )
    .get() as {
    document_count: number;
    paper_document_count: number | null;
    artifact_document_count: number | null;
    evidence_document_count: number | null;
    updated_at: string | null;
  };
  const chunkRow = db.prepare("SELECT COUNT(*) AS chunk_count FROM knowledge_chunks").get() as {
    chunk_count: number;
  };
  db.close();
  return {
    documentCount: documentRow.document_count,
    chunkCount: chunkRow.chunk_count,
    paperDocumentCount: documentRow.paper_document_count ?? 0,
    artifactDocumentCount: documentRow.artifact_document_count ?? 0,
    evidenceDocumentCount: documentRow.evidence_document_count ?? 0,
    embeddingModel,
    updatedAt: documentRow.updated_at
  };
}

export function searchKnowledgeBase(
  config: AppConfig,
  query: string,
  options: KnowledgeSearchOptions = {}
): KnowledgeSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryEmbedding = embedText(trimmed);
  const db = openReaderDb(config.readerDbPath);
  const rows = (options.recordId
    ? db
        .prepare("SELECT * FROM knowledge_chunks WHERE record_id = ?")
        .all(options.recordId)
    : db.prepare("SELECT * FROM knowledge_chunks").all()) as KnowledgeChunkRow[];
  db.close();

  return rows
    .map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      recordId: row.record_id,
      sourceKind: row.source_kind,
      sourceId: row.source_id,
      headingPath: row.heading_path,
      text: row.text,
      score: cosine(queryEmbedding, parseEmbedding(row.embedding_json))
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.topK ?? 6);
}

function upsertKnowledgeDocument(
  config: AppConfig,
  input: KnowledgeDocumentInput
): KnowledgeIngestResult {
  const content = input.content.trim();
  if (!content) return { documentCount: 0, chunkCount: 0, embeddingModel };
  const chunks = chunkMarkdown(content);
  const now = new Date().toISOString();
  const documentId = stableId([input.recordId, input.sourceKind, input.sourceId]);
  const db = openReaderDb(config.readerDbPath);

  db.prepare(
    `INSERT INTO knowledge_documents
      (id, record_id, source_kind, source_id, source_path, title, embedding_model, content_hash, updated_at)
     VALUES
      (@id, @recordId, @sourceKind, @sourceId, @sourcePath, @title, @embeddingModel, @contentHash, @updatedAt)
     ON CONFLICT(record_id, source_kind, source_id) DO UPDATE SET
      source_path = excluded.source_path,
      title = excluded.title,
      embedding_model = excluded.embedding_model,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at`
  ).run({
    id: documentId,
    recordId: input.recordId,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    title: input.title,
    embeddingModel,
    contentHash: hash(content),
    updatedAt: now
  });

  db.prepare("DELETE FROM knowledge_chunks WHERE document_id = ?").run(documentId);
  const insertChunk = db.prepare(
    `INSERT INTO knowledge_chunks
      (id, document_id, record_id, source_kind, source_id, chunk_index, heading_path, text, token_count, embedding_model, embedding_json, created_at)
     VALUES
      (@id, @documentId, @recordId, @sourceKind, @sourceId, @chunkIndex, @headingPath, @text, @tokenCount, @embeddingModel, @embeddingJson, @createdAt)`
  );
  chunks.forEach((chunk, index) => {
    insertChunk.run({
      id: stableId([documentId, String(index), hash(chunk.text)]),
      documentId,
      recordId: input.recordId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      chunkIndex: index,
      headingPath: chunk.headingPath,
      text: chunk.text,
      tokenCount: tokenize(chunk.text).length,
      embeddingModel,
      embeddingJson: JSON.stringify(embedText(`${chunk.headingPath}\n${chunk.text}`)),
      createdAt: now
    });
  });
  db.close();

  return { documentCount: 1, chunkCount: chunks.length, embeddingModel };
}

function summarizeResults(results: KnowledgeIngestResult[]): KnowledgeIngestResult {
  return {
    documentCount: results.reduce((sum, item) => sum + item.documentCount, 0),
    chunkCount: results.reduce((sum, item) => sum + item.chunkCount, 0),
    embeddingModel
  };
}

function chunkMarkdown(markdown: string): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const headingStack = new Map<number, string>();
  let buffer: string[] = [];
  let sawContent = false;
  let skippedDocumentTitle = false;

  const flush = () => {
    const text = normalizeText(buffer.join("\n"));
    buffer = [];
    if (!text) return;
    sawContent = true;
    const headingPath = Array.from(headingStack.entries())
      .sort(([left], [right]) => left - right)
      .map(([, value]) => value)
      .join(" > ");
    for (const piece of splitLongText(text, maxChunkWords)) {
      if (tokenize(piece).length >= minChunkWords || text === piece) {
        chunks.push({ headingPath, text: piece });
      }
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      if (level === 1 && !sawContent && !skippedDocumentTitle && headingStack.size === 0) {
        skippedDocumentTitle = true;
        continue;
      }
      for (const key of Array.from(headingStack.keys())) {
        if (key >= level) headingStack.delete(key);
      }
      headingStack.set(level, cleanMarkdown(heading[2]));
    } else {
      buffer.push(line);
    }
  }
  flush();

  if (chunks.length === 0) {
    const text = normalizeText(markdown);
    if (text) chunks.push({ headingPath: "", text });
  }
  return chunks;
}

function splitLongText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text];
  const pieces: string[] = [];
  for (let index = 0; index < words.length; index += maxWords) {
    pieces.push(words.slice(index, index + maxWords).join(" "));
  }
  return pieces;
}

function embedText(text: string): number[] {
  const vector = Array.from({ length: embeddingDimensions }, () => 0);
  for (const token of tokenize(text)) {
    const digest = crypto.createHash("sha256").update(token).digest();
    const index = digest.readUInt16BE(0) % embeddingDimensions;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosine(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += left[index] * right[index];
  }
  return Number(sum.toFixed(6));
}

function parseEmbedding(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function tokenize(text: string): string[] {
  const latin = text
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  return latin ?? [];
}

function normalizeText(text: string): string {
  return cleanMarkdown(text).replace(/\s+/g, " ").trim();
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_~>#-]+/g, " ")
    .trim();
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableId(parts: string[]): string {
  return `kb_${hash(parts.join("\0")).slice(0, 24)}`;
}
