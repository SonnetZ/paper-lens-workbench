import { describe, expect, it } from "vitest";
import { resolveAppConfig } from "@/lib/server/config";

describe("resolveAppConfig", () => {
  it("uses portable sample-data defaults", () => {
    const config = resolveAppConfig({}, "/tmp/reader");

    expect(config.reviewDataDir).toBe("/tmp/reader/sample-data/scoping_review");
    expect(config.paperMdDir).toBe("/tmp/reader/sample-data/papers_md");
    expect(config.paperPdfDir).toBe("/tmp/reader/sample-data/papers_pdf");
    expect(config.readerDbPath).toBe("/tmp/reader/reader.sqlite");
    expect(config.llmMode).toBe("mock");
  });

  it("normalizes explicit paths and local model defaults", () => {
    const config = resolveAppConfig(
      {
        REVIEW_DATA_DIR: "../review-data",
        PAPER_MD_DIR: "/papers/md",
        PAPER_PDF_DIR: "/papers/pdf",
        READER_DB_PATH: "../state/reviewer.sqlite",
        LLM_MODE: "local",
        LOCAL_LLM_PORT: "8100"
      },
      "/tmp/reader"
    );

    expect(config.reviewDataDir).toBe("/tmp/review-data");
    expect(config.paperMdDir).toBe("/papers/md");
    expect(config.paperPdfDir).toBe("/papers/pdf");
    expect(config.readerDbPath).toBe("/tmp/state/reviewer.sqlite");
    expect(config.localLlmBaseUrl).toBe("http://localhost:8100/v1");
    expect(config.llmMode).toBe("local");
  });

  it("rejects unsupported model modes", () => {
    expect(() => resolveAppConfig({ LLM_MODE: "agent" }, "/tmp/reader")).toThrow(
      "Unsupported LLM_MODE"
    );
  });
});
