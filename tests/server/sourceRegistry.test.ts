import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/lib/types";
import {
  getPaperByRecordId,
  loadPaperQueue,
  readMarkdownForPaper,
  readPdfTextForPaper
} from "@/lib/server/sourceRegistry";

const pdfjsMock = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn()
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjsMock);

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-registry-"));
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
  await writeFile(path.join(paperMdDir, "Alpha Study.md"), "# Alpha\n\nBody", "utf-8");
  await writeFile(path.join(paperPdfDir, "Alpha Study.pdf"), "fake pdf", "utf-8");
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

describe("source registry", () => {
  beforeEach(() => {
    pdfjsMock.GlobalWorkerOptions.workerSrc = "";
    pdfjsMock.getDocument.mockReset();
  });

  it("loads queue and resolves markdown and pdf availability", async () => {
    const config = await makeConfig();

    const queue = await loadPaperQueue(config);

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      recordId: "FT0001",
      title: "Alpha Study",
      hasMarkdown: true,
      hasPdf: true,
      reviewStatus: "unreviewed"
    });
  });

  it("reads markdown for a paper", async () => {
    const config = await makeConfig();

    const result = await readMarkdownForPaper(config, "FT0001");

    expect(result?.content).toContain("# Alpha");
    expect(result?.path.endsWith("Alpha Study.md")).toBe(true);
  });

  it("returns null for unknown paper", async () => {
    const config = await makeConfig();

    await expect(getPaperByRecordId(config, "FT9999")).resolves.toBeNull();
  });

  it("sets the pdf.js worker path before extracting server-side PDF text", async () => {
    const config = await makeConfig();
    pdfjsMock.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({ items: [{ str: "PDF extracted text" }] })
        }),
        destroy: vi.fn()
      })
    }));

    const result = await readPdfTextForPaper(config, "FT0001");

    expect(result?.content).toContain("PDF extracted text");
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toMatch(
      /^file:\/\/.*\/node_modules\/pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs$/
    );
  });
});
