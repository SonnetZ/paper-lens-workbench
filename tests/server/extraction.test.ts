import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig, ExtractionArtifactInput } from "@/lib/types";
import { readExtractionArtifact, saveExtractionArtifact } from "@/lib/server/extraction";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-extraction-"));
  return {
    llmMode: "mock",
    reviewDataDir: root,
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

function input(overrides: Partial<ExtractionArtifactInput> = {}): ExtractionArtifactInput {
  return {
    methodTypology: "Analytical pathway: human-in-the-loop LLM coding.",
    promptingPractices: "Prompt asked for candidate themes and quoted excerpts.",
    evaluationPractices: "Compared model suggestions with human reviewer notes.",
    synthesisNote: "Relevant for LLM-integrated qualitative analysis.",
    evidenceLocator: "Methods > paragraph 2",
    ...overrides
  };
}

describe("extraction artifact store", () => {
  it("returns an empty draft for records without saved extraction data", async () => {
    const config = await makeConfig();

    const artifact = readExtractionArtifact(config, "FT0001");

    expect(artifact).toMatchObject({
      recordId: "FT0001",
      methodTypology: "",
      promptingPractices: "",
      evaluationPractices: "",
      synthesisNote: "",
      evidenceLocator: ""
    });
    expect(artifact.updatedAt).toBe("");
  });

  it("saves and updates extraction artifacts by record id", async () => {
    const config = await makeConfig();

    const saved = saveExtractionArtifact(config, "FT0001", input());
    const updated = saveExtractionArtifact(
      config,
      "FT0001",
      input({ evaluationPractices: "Reports disagreement review as an evaluation practice." })
    );

    expect(saved.recordId).toBe("FT0001");
    expect(updated.updatedAt).not.toBe("");
    expect(readExtractionArtifact(config, "FT0001")).toMatchObject({
      recordId: "FT0001",
      methodTypology: "Analytical pathway: human-in-the-loop LLM coding.",
      evaluationPractices: "Reports disagreement review as an evaluation practice.",
      evidenceLocator: "Methods > paragraph 2"
    });
  });
});
