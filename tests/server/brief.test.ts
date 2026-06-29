import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig, BriefArtifactInput } from "@/lib/types";
import { readBriefArtifact, saveBriefArtifact } from "@/lib/server/brief";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-brief-"));
  await mkdir(path.join(root, "exports"), { recursive: true });
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

function input(overrides: Partial<BriefArtifactInput> = {}): BriefArtifactInput {
  return {
    eligibilitySuggestion: "maybe",
    rationale: "Read the methods section first.",
    readFirst: ["Abstract", "Methods"],
    warnings: ["Draft only."],
    payloadScope: "Paper sections",
    ...overrides
  };
}

describe("brief artifact store", () => {
  it("returns null for records without a saved brief", async () => {
    const config = await makeConfig();

    expect(readBriefArtifact(config, "default", "FT0001")).toBeNull();
  });

  it("saves and overwrites the latest brief per review project and record", async () => {
    const config = await makeConfig();

    const first = saveBriefArtifact(config, "project-a", "FT0001", input());
    const updated = saveBriefArtifact(
      config,
      "project-a",
      "FT0001",
      input({
        eligibilitySuggestion: "include",
        rationale: "Stored for this project.",
        warnings: []
      })
    );

    expect(first.recordId).toBe("FT0001");
    expect(first.reviewProjectId).toBe("project-a");
    expect(updated.updatedAt).not.toBe("");
    expect(readBriefArtifact(config, "project-a", "FT0001")).toMatchObject({
      recordId: "FT0001",
      reviewProjectId: "project-a",
      eligibilitySuggestion: "include",
      rationale: "Stored for this project.",
      readFirst: ["Abstract", "Methods"]
    });
  });
});
