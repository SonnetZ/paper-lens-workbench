import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@/lib/types";
import { saveEvidencePacket } from "@/lib/server/evidence";
import { exportReviewMaterial } from "@/lib/server/reviewExport";
import { saveExtractionArtifact } from "@/lib/server/extraction";

const header =
  "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-review-export-"));
  const reviewDataDir = path.join(root, "review");
  const paperMdDir = path.join(root, "papers_md");
  const paperPdfDir = path.join(root, "papers_pdf");
  await mkdir(reviewDataDir, { recursive: true });
  await mkdir(paperMdDir, { recursive: true });
  await mkdir(paperPdfDir, { recursive: true });
  await writeFile(
    path.join(reviewDataDir, "full_text_screening.csv"),
    [
      header,
      "FT0001,Sample AI-assisted interview analysis,Rivera,2026,FT0001_sample.md,FT0001_sample.md,include,,Uses LLMs to support qualitative interview analysis.,Data analysis pathway.,Compares AI coding with human review.,Reports prompt examples.,Methods > paragraph 2,screened,,YZ,2026-06-23"
    ].join("\n"),
    "utf-8"
  );
  await writeFile(path.join(paperMdDir, "FT0001_sample.md"), "# Sample\n", "utf-8");

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

describe("review material export", () => {
  it("writes a per-paper markdown packet with metadata, screening, extraction, and evidence chain", async () => {
    const config = await makeConfig();
    saveExtractionArtifact(config, "FT0001", {
      methodTypology: "Human-in-the-loop LLM coding.",
      promptingPractices: "Prompt asks for candidate themes and quoted excerpts.",
      evaluationPractices: "Compared model suggestions with human reviewer notes.",
      synthesisNote: "Central paper for analytical pathway synthesis.",
      evidenceLocator: "Evaluation > paragraph 1"
    });
    saveEvidencePacket(config, {
      recordId: "FT0001",
      sourceFormat: "markdown",
      sourcePath: "FT0001_sample.md",
      evidenceLocator: "Evaluation > paragraph 1",
      quoteSnippet: "The authors compared model-suggested codes with human reviewer notes.",
      headingPath: "Evaluation",
      pageNumber: null,
      reviewerNote: "Use this for evaluation-practices synthesis.",
      pdfVerificationNote: "Verified in PDF p. 9; table formatting checked."
    });

    const exported = await exportReviewMaterial(config, "FT0001");
    const contentOnDisk = await readFile(exported.path, "utf-8");

    expect(exported).toMatchObject({
      recordId: "FT0001",
      format: "markdown",
      evidenceCount: 1
    });
    expect(exported.path).toBe(
      path.join(config.readerExportDir, "review-materials", "FT0001_review_material.md")
    );
    expect(contentOnDisk).toBe(exported.content);
    expect(exported.content).toContain("# FT0001 - Sample AI-assisted interview analysis");
    expect(exported.content).toContain("- First author: Rivera");
    expect(exported.content).toContain("- Decision: include");
    expect(exported.content).toContain("Uses LLMs to support qualitative interview analysis.");
    expect(exported.content).toContain("## Extraction Notes");
    expect(exported.content).toContain("Human-in-the-loop LLM coding.");
    expect(exported.content).toContain("## Evidence Chain");
    expect(exported.content).toContain("Evaluation > paragraph 1");
    expect(exported.content).toContain(
      "> The authors compared model-suggested codes with human reviewer notes."
    );
    expect(exported.content).toContain("Reviewer note: Use this for evaluation-practices synthesis.");
    expect(exported.content).toContain(
      "- PDF verification note: Verified in PDF p. 9; table formatting checked."
    );
  });
});
