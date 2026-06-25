import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@/lib/types";
import {
  listEvidencePackets,
  saveEvidencePacket,
  updateEvidencePdfVerificationNote
} from "@/lib/server/evidence";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-evidence-"));
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

describe("evidence store", () => {
  it("saves and lists evidence packets", async () => {
    const config = await makeConfig();

    const saved = saveEvidencePacket(config, {
      recordId: "FT0001",
      sourceFormat: "markdown",
      sourcePath: "/tmp/paper.md",
      evidenceLocator: "Methods > paragraph 2",
      quoteSnippet: "human reviewers revised the codebook",
      headingPath: "Methods",
      pageNumber: null,
      reviewerNote: "Useful for HITL coding.",
      pdfVerificationNote: "Verified against PDF p. 6."
    });

    expect(saved.id).toMatch(/^ev_/);
    expect(saved.pdfVerificationNote).toBe("Verified against PDF p. 6.");
    const packets = listEvidencePackets(config, "FT0001");
    expect(packets).toHaveLength(1);
    expect(packets[0].quoteSnippet).toContain("human reviewers");
    expect(packets[0].pdfVerificationNote).toBe("Verified against PDF p. 6.");
  });

  it("rejects evidence without a locator", async () => {
    const config = await makeConfig();

    expect(() =>
      saveEvidencePacket(config, {
        recordId: "FT0001",
        sourceFormat: "manual",
        sourcePath: null,
        evidenceLocator: "",
        quoteSnippet: "note",
        headingPath: null,
        pageNumber: null,
        reviewerNote: "",
        pdfVerificationNote: ""
      })
    ).toThrow("evidenceLocator is required");
  });

  it("updates the PDF verification note for an existing evidence packet", async () => {
    const config = await makeConfig();
    const saved = saveEvidencePacket(config, {
      recordId: "FT0001",
      sourceFormat: "markdown",
      sourcePath: "/tmp/paper.md",
      evidenceLocator: "Evaluation",
      quoteSnippet: "model-suggested codes were compared with human notes",
      headingPath: "Evaluation",
      pageNumber: null,
      reviewerNote: "",
      pdfVerificationNote: ""
    });

    const updated = updateEvidencePdfVerificationNote(
      config,
      saved.id,
      "Verified in PDF p. 9; table formatting checked."
    );

    expect(updated.pdfVerificationNote).toBe("Verified in PDF p. 9; table formatting checked.");
    expect(listEvidencePackets(config, "FT0001")[0].pdfVerificationNote).toBe(
      "Verified in PDF p. 9; table formatting checked."
    );
  });
});
