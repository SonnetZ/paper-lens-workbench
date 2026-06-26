import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/lib/types";
import { translateSelection } from "@/lib/server/translation";

const mockConfig: AppConfig = {
  llmMode: "mock",
  reviewDataDir: "/tmp/review",
  paperMdDir: "/tmp/md",
  paperPdfDir: "/tmp/pdf",
  readerDbPath: "/tmp/reader.sqlite",
  readerExportDir: "/tmp/exports",
  localLlmBaseUrl: "http://localhost:8000/v1",
  localLlmModel: "",
  onlineLlmBaseUrl: "https://example.test/v1",
  onlineLlmModel: "online-test",
  onlineConfigSource: "manual",
  translationOpusBaseUrl: "http://127.0.0.1:8010",
  llmMaxInputChars: 24000
};

describe("translation service", () => {
  it("defaults to the local OPUS-MT sidecar", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ translation: "研究人员评估了该工具。" })
    );

    const result = await translateSelection(
      mockConfig,
      { text: "The researchers evaluated the tool.", provider: "opus" },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8010/translate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          text: "The researchers evaluated the tool.",
          sourceLanguage: "en",
          targetLanguage: "zh"
        })
      })
    );
    expect(result.translation).toBe("研究人员评估了该工具。");
    expect(result.provider).toBe("opus");
  });

  it("can translate with an OpenAI-compatible local model", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ choices: [{ message: { content: "研究人员评估了该工具。" } }] })
    );

    const result = await translateSelection(
      mockConfig,
      {
        text: "The researchers evaluated the tool.",
        provider: "local",
        modelSettings: {
          mode: "local",
          localBaseUrl: "http://127.0.0.1:8017/v1",
          localModel: "qwen-local",
          onlineBaseUrl: "",
          onlineModel: "",
          onlineConfigSource: "manual",
          onlineApiKey: ""
        }
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8017/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" })
      })
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("qwen-local");
    expect(JSON.stringify(body)).toContain("The researchers evaluated the tool.");
    expect(result.translation).toBe("研究人员评估了该工具。");
    expect(result.provider).toBe("local");
  });
});
