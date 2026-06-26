import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "@/lib/types";

type OnlineConfigSource = AppConfig["onlineConfigSource"];

export interface ConfiguredOnlineProvider {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function resolveOnlineApiKey(
  source: OnlineConfigSource,
  manualApiKey?: string,
  env: Record<string, string | undefined> = process.env
): string | undefined {
  if (source === "manual") {
    return nonEmpty(manualApiKey) ?? nonEmpty(env.ONLINE_LLM_API_KEY);
  }
  return resolveConfiguredOnlineProvider(env).apiKey || undefined;
}

export function onlineCredentialState(
  source: OnlineConfigSource,
  manualApiKey?: string
): "missing" | "present" {
  return resolveOnlineApiKey(source, manualApiKey) ? "present" : "missing";
}

export function resolveConfiguredOnlineProvider(
  env: Record<string, string | undefined> = process.env
): ConfiguredOnlineProvider {
  const codex = readCodexConfig(env);
  return {
    baseUrl: nonEmpty(env.ONLINE_LLM_BASE_URL) ?? codex.baseUrl ?? "",
    model: nonEmpty(env.ONLINE_LLM_MODEL) ?? codex.model ?? "",
    apiKey: nonEmpty(env.ONLINE_LLM_API_KEY) ?? readCodexAuthApiKey(env) ?? ""
  };
}

function codexHome(env: Record<string, string | undefined>): string {
  return env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function readCodexAuthApiKey(env: Record<string, string | undefined>): string | undefined {
  const authPath = path.join(codexHome(env), "auth.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, "utf-8")) as {
      OPENAI_API_KEY?: unknown;
    };
    return readApiKeyValue(parsed.OPENAI_API_KEY);
  } catch {
    return undefined;
  }
}

function readApiKeyValue(value: unknown): string | undefined {
  if (typeof value === "string") return nonEmpty(value);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["value", "apiKey", "api_key", "OPENAI_API_KEY"]) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const apiKey = nonEmpty(candidate);
      if (apiKey) return apiKey;
    }
  }
  return undefined;
}

function readCodexConfig(env: Record<string, string | undefined>): {
  baseUrl?: string;
  model?: string;
} {
  const configPath = path.join(codexHome(env), "config.toml");
  try {
    return parseCodexConfigToml(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function parseCodexConfigToml(content: string): { baseUrl?: string; model?: string } {
  let currentSection = "";
  let provider = "";
  let model = "";
  const providerBaseUrls = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const section = /^\[([^\]]+)]$/.exec(line);
    if (section) {
      currentSection = section[1];
      continue;
    }
    const keyValue = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (!keyValue) continue;
    const key = keyValue[1];
    const value = parseTomlScalar(keyValue[2]);

    if (!currentSection && key === "model_provider") provider = value;
    if (!currentSection && key === "model") model = value;
    if (currentSection.startsWith("model_providers.") && key === "base_url") {
      providerBaseUrls.set(currentSection.replace(/^model_providers\./, ""), value);
    }
  }

  return {
    baseUrl: provider ? nonEmpty(providerBaseUrls.get(provider)) : undefined,
    model: nonEmpty(model)
  };
}

function parseTomlScalar(value: string): string {
  const trimmed = value.trim();
  const quoted = /^"([^"]*)"/.exec(trimmed);
  if (quoted) return quoted[1];
  return trimmed.split(/\s+#/)[0]?.trim() ?? "";
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
