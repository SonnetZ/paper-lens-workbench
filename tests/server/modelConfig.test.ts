import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRedactedModelConfig,
  testLocalModelConnection,
  testOnlineModelConnection
} from "@/lib/server/modelConfig";
import { resolveConfiguredOnlineProvider } from "@/lib/server/onlineCredentials";
import type { AppConfig } from "@/lib/types";

const mockConfig: AppConfig = {
  llmMode: "online",
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
  llmMaxInputChars: 24000
};

describe("model config safety", () => {
  afterEach(() => {
    delete process.env.CODEX_HOME;
    delete process.env.ONLINE_LLM_API_KEY;
    delete process.env.ONLINE_LLM_BASE_URL;
    delete process.env.ONLINE_LLM_MODEL;
    delete process.env.ONLINE_LLM_CONFIG_SOURCE;
  });

  it("tests local connection with /models only", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: [{ id: "qwen-local" }] }))
    );

    const result = await testLocalModelConnection("http://localhost:8000/v1", fetchImpl as any);

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8000/v1/models",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.ok).toBe(true);
    expect(result.models).toEqual(["qwen-local"]);
  });

  it("reports cc-switch managed Codex credentials without exposing the key", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-home-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "cc-switch-secret" })
    );
    process.env.CODEX_HOME = tempCodexHome;

    const config = getRedactedModelConfig({
      ...mockConfig,
      onlineConfigSource: "cc_switch"
    });

    expect(config.online.credentialState).toBe("present");
    expect(JSON.stringify(config)).not.toContain("cc-switch-secret");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("resolves configured environment from env first and then Codex config", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-config-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "config.toml"),
      [
        'model_provider = "lingsuan_plus"',
        'model = "gpt-5.5"',
        "",
        "[model_providers.lingsuan_plus]",
        'base_url = "http://127.0.0.1:15721/v1"',
        ""
      ].join("\n")
    );
    writeFileSync(
      path.join(tempCodexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "configured-secret" })
    );
    process.env.CODEX_HOME = tempCodexHome;
    process.env.ONLINE_LLM_MODEL = "env-model";

    const provider = resolveConfiguredOnlineProvider();

    expect(provider).toEqual({
      baseUrl: "http://127.0.0.1:15721/v1",
      model: "env-model",
      apiKey: "configured-secret"
    });
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("reads a nested OpenAI-compatible API key from Codex auth when present", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-nested-auth-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: { value: "nested-secret" } })
    );
    process.env.CODEX_HOME = tempCodexHome;

    const provider = resolveConfiguredOnlineProvider();

    expect(provider.apiKey).toBe("nested-secret");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("reads a Codex provider bearer token from config.toml", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-provider-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "config.toml"),
      [
        'model_provider = "gateway"',
        'model = "gpt-5.5"',
        "",
        "[model_providers.gateway]",
        'base_url = "https://gateway.example.test"',
        'experimental_bearer_token = "provider-secret"',
        ""
      ].join("\n")
    );

    const provider = resolveConfiguredOnlineProvider({ CODEX_HOME: tempCodexHome });

    expect(provider).toEqual({
      baseUrl: "https://gateway.example.test/v1",
      model: "gpt-5.5",
      apiKey: "provider-secret"
    });
    process.env.CODEX_HOME = tempCodexHome;
    const redacted = getRedactedModelConfig({ ...mockConfig, onlineConfigSource: "cc_switch" });

    expect(redacted.online.credentialState).toBe("present");
    expect(JSON.stringify(redacted)).not.toContain("provider-secret");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("reads a Codex provider API key from a configured environment variable", () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-env-provider-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "config.toml"),
      [
        'model_provider = "gateway"',
        'model = "gpt-5.5"',
        "",
        "[model_providers.gateway]",
        'base_url = "https://gateway.example.test/v1"',
        'env_key = "GATEWAY_API_KEY"',
        ""
      ].join("\n")
    );

    const provider = resolveConfiguredOnlineProvider({
      CODEX_HOME: tempCodexHome,
      GATEWAY_API_KEY: "env-provider-secret"
    });

    expect(provider.apiKey).toBe("env-provider-secret");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("tests online OpenAI-compatible models without exposing credentials", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Response(JSON.stringify({ data: [{ id: "gpt-test" }] }), {
          headers: init?.headers
        })
    );

    const result = await testOnlineModelConnection(
      "https://example.test/v1",
      "secret-key",
      fetchImpl as any
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer secret-key"
        })
      })
    );
    expect(result).toEqual({ ok: true, models: ["gpt-test"], error: null });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("falls back to a tiny chat probe when an online provider does not expose /models", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/models")) {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/chat/completions")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      }
      return new Response("not found", { status: 404 });
    });

    const result = await testOnlineModelConnection(
      "https://example.test/v1",
      "secret-key",
      "configured-model",
      fetchImpl as any
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret-key"
        }),
        body: expect.stringContaining("\"model\":\"configured-model\"")
      })
    );
    expect(result).toEqual({ ok: true, models: ["configured-model"], error: null });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
});
