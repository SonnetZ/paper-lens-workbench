import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAppConfig } from "@/lib/server/config";

describe("resolveAppConfig", () => {
  afterEach(() => {
    delete process.env.CODEX_HOME;
  });

  it("uses portable sample-data defaults", () => {
    const config = resolveAppConfig({}, "/tmp/reader");

    expect(config.reviewDataDir).toBe("/tmp/reader/sample-data/review_data");
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

  it("uses configured online sources without forcing manual credentials", () => {
    expect(
      resolveAppConfig({ ONLINE_LLM_BASE_URL: "https://example.test/v1" }, "/tmp/reader")
        .onlineConfigSource
    ).toBe("env");

    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-source-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "config.toml"),
      [
        'model_provider = "gateway"',
        'model = "gpt-5.5"',
        "",
        "[model_providers.gateway]",
        'base_url = "https://gateway.example.test/v1"',
        'experimental_bearer_token = "provider-secret"',
        ""
      ].join("\n")
    );

    expect(resolveAppConfig({ CODEX_HOME: tempCodexHome }, "/tmp/reader").onlineConfigSource).toBe(
      "cc_switch"
    );
    expect(
      resolveAppConfig(
        {
          CODEX_HOME: tempCodexHome,
          ONLINE_LLM_CONFIG_SOURCE: "manual"
        },
        "/tmp/reader"
      ).onlineConfigSource
    ).toBe("manual");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("does not treat a standalone Codex model name as configured online credentials", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-model-only-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(path.join(tempCodexHome, "config.toml"), 'model = "gpt-5.5"\n');

    expect(resolveAppConfig({ CODEX_HOME: tempCodexHome }, "/tmp/reader").onlineConfigSource).toBe(
      "manual"
    );
    rmSync(tempCodexHome, { recursive: true, force: true });
  });
});
