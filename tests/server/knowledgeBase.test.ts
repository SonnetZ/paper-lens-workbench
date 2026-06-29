import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@/lib/types";
import { saveEvidencePacket } from "@/lib/server/evidence";
import { saveExtractionArtifact } from "@/lib/server/extraction";
import { openReaderDb } from "@/lib/server/sqliteStore";
import {
  createKnowledgeBase,
  getKnowledgeBaseStatus,
  ingestPaperMarkdown,
  ingestPaperSource,
  ingestReviewArtifacts,
  isPaperSourceIndexed,
  listKnowledgeBases,
  searchKnowledgeBase
} from "@/lib/server/knowledgeBase";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-knowledge-"));
  const reviewDataDir = path.join(root, "review");
  const paperMdDir = path.join(root, "md");
  const paperPdfDir = path.join(root, "pdf");
  await mkdir(reviewDataDir, { recursive: true });
  await mkdir(paperMdDir, { recursive: true });
  await mkdir(paperPdfDir, { recursive: true });
  await writeFile(
    path.join(reviewDataDir, "full_text_screening.csv"),
    [
      "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
      "FT0001,Alpha Study,Rivera,2026,Alpha Study.md,Alpha Study.md,,,,,,,,unreviewed,,,"
    ].join("\n"),
    "utf-8"
  );
  await writeFile(
    path.join(paperMdDir, "Alpha Study.md"),
    [
      "# Alpha Study",
      "",
      "## Methods",
      "",
      "The paper uses human-in-the-loop qualitative coding with LLM suggestions.",
      "",
      "## Prompting",
      "",
      "The authors report the exact prompt template and revision process."
    ].join("\n"),
    "utf-8"
  );
  return {
    llmMode: "mock",
    reviewDataDir,
    paperMdDir,
    paperPdfDir,
    readerDbPath: path.join(root, "reader.sqlite"),
    readerExportDir: path.join(root, "exports"),
    localLlmBaseUrl: "http://localhost:8000/v1",
    localLlmModel: "",
    onlineLlmBaseUrl: "",
    onlineLlmModel: "",
    onlineConfigSource: "manual",
    llmMaxInputChars: 24000
  };
}

describe("knowledge base", () => {
  it("creates the knowledge tables when opening the reader database", async () => {
    const config = await makeConfig();
    const db = openReaderDb(config.readerDbPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'knowledge_%'")
      .all() as Array<{ name: string }>;
    db.close();

    expect(tables.map((table) => table.name).sort()).toEqual([
      "knowledge_bases",
      "knowledge_chunks",
      "knowledge_documents"
    ]);
  });

  it("ingests markdown paper chunks and replaces the same source on re-index", async () => {
    const config = await makeConfig();

    const first = await ingestPaperMarkdown(config, "FT0001");
    const second = await ingestPaperMarkdown(config, "FT0001");
    const status = getKnowledgeBaseStatus(config);

    expect(first.documentCount).toBe(1);
    expect(first.chunkCount).toBeGreaterThan(0);
    expect(second.documentCount).toBe(1);
    expect(status.documentCount).toBe(1);
    expect(status.chunkCount).toBe(first.chunkCount);
    expect(status.knowledgeBaseName).toBe("Default review");
    expect(status.embeddingModel).toBe("portable-hash-v1");
  });

  it("prefers PDF over Markdown when indexing a paper source", async () => {
    const config = await makeConfig();
    await writeFile(path.join(config.paperPdfDir, "Alpha Study.pdf"), "PDF bytes", "utf-8");

    const result = await ingestPaperSource(
      config,
      "FT0001",
      "default",
      async () => "PDF extracted text about qualitative interviewing."
    );
    const status = getKnowledgeBaseStatus(config);

    expect(result.documentCount).toBe(1);
    expect(status.paperDocumentCount).toBe(1);
    expect(status.pdfDocumentCount).toBe(1);
    expect(status.markdownDocumentCount).toBe(0);
    expect(isPaperSourceIndexed(config, "FT0001", "default")).toBe(true);
    expect(searchKnowledgeBase(config, "qualitative interviewing")[0]).toMatchObject({
      sourceKind: "pdf"
    });
  });

  it("searches indexed paper chunks with source metadata", async () => {
    const config = await makeConfig();
    await ingestPaperMarkdown(config, "FT0001");

    const results = searchKnowledgeBase(config, "prompt template revision", { topK: 3 });

    expect(results[0]).toMatchObject({
      recordId: "FT0001",
      sourceKind: "paper",
      headingPath: "Prompting"
    });
    expect(results[0].text).toContain("prompt template");
  });

  it("ingests review artifacts and evidence as knowledge sources", async () => {
    const config = await makeConfig();
    saveEvidencePacket(config, {
      recordId: "FT0001",
      sourceFormat: "manual",
      sourcePath: null,
      evidenceLocator: "Reviewer memo",
      quoteSnippet: "",
      headingPath: null,
      pageNumber: null,
      reviewerNote: "Reviewer notes that prompt transparency is central to this paper.",
      pdfVerificationNote: "Checked against PDF p. 4."
    });
    saveExtractionArtifact(config, "FT0001", {
      methodTypology: "Human-in-the-loop LLM coding.",
      promptingPractices: "The paper discloses prompt templates and iterative prompt refinement.",
      evaluationPractices: "Human expert review is used.",
      synthesisNote: "Useful for Prompting Practices synthesis.",
      evidenceLocator: "Reviewer memo"
    });

    const result = ingestReviewArtifacts(config, "FT0001");
    const search = searchKnowledgeBase(config, "prompt transparency", { topK: 5 });

    expect(result.documentCount).toBe(2);
    expect(result.chunkCount).toBeGreaterThanOrEqual(2);
    expect(search.map((item) => item.sourceKind)).toContain("artifact");
    expect(search.map((item) => item.sourceKind)).toContain("evidence");
  });

  it("keeps separate review knowledge bases from sharing retrieval results", async () => {
    const config = await makeConfig();
    const base = createKnowledgeBase(config, "Scoping review A");

    await ingestPaperMarkdown(config, "FT0001");
    await ingestPaperMarkdown(config, "FT0001", base.id);

    const defaultStatus = getKnowledgeBaseStatus(config);
    const scopedStatus = getKnowledgeBaseStatus(config, base.id);
    const defaultResults = searchKnowledgeBase(config, "prompt template", {
      knowledgeBaseId: "default"
    });
    const scopedResults = searchKnowledgeBase(config, "prompt template", {
      knowledgeBaseId: base.id
    });

    expect(listKnowledgeBases(config).map((item) => item.name)).toContain("Scoping review A");
    expect(defaultStatus.documentCount).toBe(1);
    expect(scopedStatus.documentCount).toBe(1);
    expect(defaultResults[0].documentId).not.toBe(scopedResults[0].documentId);
    expect(scopedResults[0].recordId).toBe("FT0001");
  });
});
