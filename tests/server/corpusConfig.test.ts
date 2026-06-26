import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@/lib/types";
import {
  addPaperSourceFileToScreening,
  getEffectiveCorpusConfig,
  saveCorpusConfig,
  syncScreeningRowsForMarkdownPapers,
  validateCorpusConfig
} from "@/lib/server/corpusConfig";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-config-"));
  return {
    llmMode: "mock",
    reviewDataDir: path.join(root, "sample-review"),
    paperMdDir: path.join(root, "sample-md"),
    paperPdfDir: path.join(root, "sample-pdf"),
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

async function makeCorpus(root: string) {
  const reviewDataDir = path.join(root, "review");
  const paperMdDir = path.join(root, "papers_md");
  const paperPdfDir = path.join(root, "papers_pdf");
  await mkdir(reviewDataDir, { recursive: true });
  await mkdir(paperMdDir, { recursive: true });
  await mkdir(paperPdfDir, { recursive: true });
  await writeFile(
    path.join(reviewDataDir, "full_text_screening.csv"),
    [
      "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
      "FT0001,Configured Corpus,Rivera,2026,FT0001.md,FT0001.md,,,,,,,,unreviewed,,,"
    ].join("\n"),
    "utf-8"
  );
  await writeFile(path.join(reviewDataDir, "controlled_vocabularies.json"), "{}", "utf-8");
  await writeFile(path.join(paperMdDir, "FT0001.md"), "# Configured Corpus\n", "utf-8");
  return { reviewDataDir, paperMdDir, paperPdfDir };
}

describe("corpus config", () => {
  it("validates a corpus path set and reports detected files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-valid-"));
    const corpus = await makeCorpus(root);

    const result = await validateCorpusConfig(corpus);

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      screeningCsv: true,
      controlledVocabularies: true,
      markdownFileCount: 1,
      pdfFileCount: 0
    });
    expect(result.issues).toEqual([]);
  });

  it("saves paths and makes them the effective app corpus config", async () => {
    const appConfig = await makeConfig();
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-save-"));
    const corpus = await makeCorpus(root);

    const saved = await saveCorpusConfig(appConfig, corpus);
    const effective = getEffectiveCorpusConfig(appConfig);

    expect(saved.reviewDataDir).toBe(corpus.reviewDataDir);
    expect(effective.reviewDataDir).toBe(corpus.reviewDataDir);
    expect(effective.paperMdDir).toBe(corpus.paperMdDir);
    expect(effective.paperPdfDir).toBe(corpus.paperPdfDir);
  });

  it("adds missing screening base rows for markdown papers without duplicating existing filenames", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-sync-"));
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "papers_md");
    const paperPdfDir = path.join(root, "papers_pdf");
    await mkdir(reviewDataDir, { recursive: true });
    await mkdir(paperMdDir, { recursive: true });
    await mkdir(paperPdfDir, { recursive: true });
    await writeFile(
      path.join(reviewDataDir, "full_text_screening.csv"),
      [
        "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
        "FT0007,Existing Title,,,Existing Paper.md,Existing Paper.md,,,,,,,,unreviewed,,,"
      ].join("\n"),
      "utf-8"
    );
    await writeFile(path.join(reviewDataDir, "controlled_vocabularies.json"), "{}", "utf-8");
    await writeFile(path.join(paperMdDir, "Existing Paper.md"), "# Existing Heading\n", "utf-8");
    await writeFile(path.join(paperMdDir, "New Paper.md"), "# Extracted New Title\n\nBody", "utf-8");

    const result = await syncScreeningRowsForMarkdownPapers({
      reviewDataDir,
      paperMdDir,
      paperPdfDir
    });

    expect(result).toMatchObject({ markdownFileCount: 2, existingRowCount: 1, addedRowCount: 1 });
    const csv = await readFile(path.join(reviewDataDir, "full_text_screening.csv"), "utf-8");
    expect(csv).toContain("FT0008,Extracted New Title,,,New Paper.md,New Paper.md");
    expect(csv.match(/Existing Paper\.md/g)).toHaveLength(2);
  });

  it("initializes an empty screening CSV before adding markdown paper rows", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-empty-sync-"));
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "papers_md");
    const paperPdfDir = path.join(root, "papers_pdf");
    await mkdir(reviewDataDir, { recursive: true });
    await mkdir(paperMdDir, { recursive: true });
    await mkdir(paperPdfDir, { recursive: true });
    await writeFile(path.join(reviewDataDir, "full_text_screening.csv"), "", "utf-8");
    await writeFile(path.join(reviewDataDir, "controlled_vocabularies.json"), "{}", "utf-8");
    await writeFile(path.join(paperMdDir, "First Paper.md"), "# First Paper Title\n", "utf-8");

    const result = await syncScreeningRowsForMarkdownPapers({
      reviewDataDir,
      paperMdDir,
      paperPdfDir
    });

    expect(result.addedRowCount).toBe(1);
    const csv = await readFile(path.join(reviewDataDir, "full_text_screening.csv"), "utf-8");
    expect(csv.split("\n")[0]).toContain("record_id,title,first_author");
    expect(csv).toContain("FT0001,First Paper Title,,,First Paper.md,First Paper.md");
  });

  it("adds PDF-only rows while merging matching Markdown and PDF stems", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-pdf-sync-"));
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "papers_md");
    const paperPdfDir = path.join(root, "papers_pdf");
    await mkdir(reviewDataDir, { recursive: true });
    await mkdir(paperMdDir, { recursive: true });
    await mkdir(paperPdfDir, { recursive: true });
    await writeFile(path.join(reviewDataDir, "full_text_screening.csv"), "", "utf-8");
    await writeFile(path.join(reviewDataDir, "controlled_vocabularies.json"), "{}", "utf-8");
    await writeFile(path.join(paperMdDir, "Matched Paper.md"), "# Matched Title\n", "utf-8");
    await writeFile(path.join(paperPdfDir, "Matched Paper.pdf"), "fake pdf", "utf-8");
    await writeFile(path.join(paperPdfDir, "PDF Only.pdf"), "fake pdf", "utf-8");

    const result = await syncScreeningRowsForMarkdownPapers({
      reviewDataDir,
      paperMdDir,
      paperPdfDir
    });

    expect(result).toMatchObject({ markdownFileCount: 1, pdfFileCount: 2, addedRowCount: 2 });
    const csv = await readFile(path.join(reviewDataDir, "full_text_screening.csv"), "utf-8");
    expect(csv).toContain("FT0001,Matched Title,,,Matched Paper.md,Matched Paper.md");
    expect(csv).toContain("FT0002,PDF Only,,,PDF Only.pdf,PDF Only.pdf");
    expect(csv.match(/Matched Paper/g)).toHaveLength(2);
  });

  it("appends a single selected paper file to the screening CSV", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-corpus-single-file-"));
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "papers_md");
    const paperPdfDir = path.join(root, "papers_pdf");
    const loosePdf = path.join(root, "Loose Paper.pdf");
    await mkdir(reviewDataDir, { recursive: true });
    await mkdir(paperMdDir, { recursive: true });
    await mkdir(paperPdfDir, { recursive: true });
    await writeFile(path.join(reviewDataDir, "full_text_screening.csv"), "", "utf-8");
    await writeFile(path.join(reviewDataDir, "controlled_vocabularies.json"), "{}", "utf-8");
    await writeFile(loosePdf, "fake pdf", "utf-8");

    const result = await addPaperSourceFileToScreening(
      { reviewDataDir, paperMdDir, paperPdfDir },
      loosePdf
    );

    expect(result.addedRowCount).toBe(1);
    const csv = await readFile(path.join(reviewDataDir, "full_text_screening.csv"), "utf-8");
    expect(csv).toContain(`FT0001,Loose Paper,,,Loose Paper.pdf,${loosePdf}`);
  });
});
