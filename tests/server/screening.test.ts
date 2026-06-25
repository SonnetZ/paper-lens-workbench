import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig, ScreeningUpdateInput } from "@/lib/types";
import { readScreeningRow, updateScreeningDecision } from "@/lib/server/screening";

const header =
  "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-screening-"));
  const reviewDataDir = path.join(root, "review");
  await mkdir(reviewDataDir, { recursive: true });
  await writeFile(
    path.join(reviewDataDir, "full_text_screening.csv"),
    [
      header,
      "FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,,,,,,,,unreviewed,,,",
      "FT0002,Beta Study,Chen,2025,Beta.md,Beta.md,exclude,wrong population,Not about human participants,,,,p. 4,screened,,YZ,2026-06-23"
    ].join("\n"),
    "utf-8"
  );

  return {
    llmMode: "mock",
    reviewDataDir,
    paperMdDir: root,
    paperPdfDir: root,
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

function validInput(overrides: Partial<ScreeningUpdateInput> = {}): ScreeningUpdateInput {
  return {
    decision: "include",
    primaryExclusionReason: "",
    eligibilityRationale: "Uses LLMs to support qualitative interview analysis.",
    typologyRelevanceNotes: "Data analysis pathway.",
    evaluationRelevanceNotes: "Compares AI coding with human review.",
    promptingPracticesNotes: "Reports prompt examples.",
    evidenceLocator: "Methods > paragraph 2",
    reviewStatus: "screened",
    secondReviewReason: "",
    reviewer: "YZ",
    reviewDate: "2026-06-23",
    ...overrides
  };
}

describe("screening write-back", () => {
  it("updates one full-text screening row while preserving headers and other rows", async () => {
    const config = await makeConfig();

    const updated = await updateScreeningDecision(config, "FT0001", validInput());

    expect(updated).toMatchObject({
      recordId: "FT0001",
      decision: "include",
      eligibilityRationale: "Uses LLMs to support qualitative interview analysis.",
      evidenceLocator: "Methods > paragraph 2",
      reviewStatus: "screened"
    });

    const csv = await readFile(path.join(config.reviewDataDir, "full_text_screening.csv"), "utf-8");
    expect(csv.split(/\r?\n/)[0]).toBe(header);
    expect(csv).toContain("FT0002,Beta Study,Chen,2025,Beta.md,Beta.md,exclude,wrong population");
    expect(csv).toContain("FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,include,");
  });

  it("reads a screening row using reviewer-facing field names", async () => {
    const config = await makeConfig();

    const row = await readScreeningRow(config, "FT0002");

    expect(row).toMatchObject({
      recordId: "FT0002",
      decision: "exclude",
      primaryExclusionReason: "wrong population",
      eligibilityRationale: "Not about human participants",
      evidenceLocator: "p. 4",
      reviewStatus: "screened"
    });
  });

  it("requires rationale and evidence locator for include/exclude decisions", async () => {
    const config = await makeConfig();

    await expect(
      updateScreeningDecision(
        config,
        "FT0001",
        validInput({ eligibilityRationale: "", evidenceLocator: "" })
      )
    ).rejects.toThrow("Eligibility rationale is required");
  });

  it("rejects missing record ids", async () => {
    const config = await makeConfig();

    await expect(updateScreeningDecision(config, "FT9999", validInput())).rejects.toThrow(
      "Screening row not found"
    );
  });
});
