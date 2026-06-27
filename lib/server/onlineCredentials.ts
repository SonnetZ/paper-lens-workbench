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

interface CodexProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  hasProviderConfig: boolean;
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
    baseUrl: normalizeOpenAiBaseUrl(nonEmpty(env.ONLINE_LLM_BASE_URL) ?? codex.baseUrl) ?? "",
    model: nonEmpty(env.ONLINE_LLM_MODEL) ?? codex.model ?? "",
    apiKey: nonEmpty(env.ONLINE_LLM_API_KEY) ?? codex.apiKey ?? readCodexAuthApiKey(env) ?? ""
  };
}

export function hasConfiguredOnlineProvider(
  env: Record<string, string | undefined> = process.env
): boolean {
  const codex = readCodexConfig(env);
  return Boolean(
    nonEmpty(env.ONLINE_LLM_BASE_URL) ||
      nonEmpty(env.ONLINE_LLM_MODEL) ||
      nonEmpty(env.ONLINE_LLM_API_KEY) ||
      codex.hasProviderConfig ||
      codex.baseUrl ||
      codex.apiKey
  );
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
  apiKey?: string;
  hasProviderConfig: boolean;
} {
  const configPath = path.join(codexHome(env), "config.toml");
  try {
    return parseCodexConfigToml(fs.readFileSync(configPath, "utf-8"), env);
  } catch {
    return { hasProviderConfig: false };
  }
}

function parseCodexConfigToml(
  content: string,
  env: Record<string, string | undefined>
): CodexProviderConfig {
  let currentSection = "";
  let provider = "";
  let model = "";
  const providerFields = new Map<string, Record<string, string>>();

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
    const providerName = providerNameFromSection(currentSection);
    if (providerName) {
      const fields = providerFields.get(providerName) ?? {};
      fields[key] = value;
      providerFields.set(providerName, fields);
    }
  }

  const selectedProvider = provider ? providerFields.get(provider) : undefined;
  return {
    baseUrl: selectedProvider ? nonEmpty(selectedProvider.base_url) : undefined,
    model: nonEmpty(model) ?? nonEmpty(selectedProvider?.model),
    apiKey: selectedProvider ? readProviderApiKey(selectedProvider, env) : undefined,
    hasProviderConfig: Boolean(selectedProvider && Object.keys(selectedProvider).length > 0)
  };
}

function providerNameFromSection(section: string): string {
  if (!section.startsWith("model_providers.")) return "";
  return stripTomlQuotes(section.replace(/^model_providers\./, ""));
}

function stripTomlQuotes(value: string): string {
  const trimmed = value.trim();
  const quoted =
    (/^"([^"]*)"$/.exec(trimmed) ?? /^'([^']*)'$/.exec(trimmed)) as RegExpExecArray | null;
  return quoted ? quoted[1] : trimmed;
}

function readProviderApiKey(
  provider: Record<string, string>,
  env: Record<string, string | undefined>
): string | undefined {
  for (const field of ["env_key", "api_key_env", "api_key_env_var"]) {
    const envName = provider[field];
    const apiKey = envName ? nonEmpty(env[envName]) : undefined;
    if (apiKey) return apiKey;
  }
  for (const field of ["experimental_bearer_token", "api_key", "bearer_token", "token"]) {
    const apiKey = nonEmpty(provider[field]);
    if (apiKey) return apiKey;
  }
  return undefined;
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

function normalizeOpenAiBaseUrl(value: string | undefined): string | undefined {
  const baseUrl = nonEmpty(value)?.replace(/\/+$/, "");
  if (!baseUrl) return undefined;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.pathname === "" || parsed.pathname === "/") return `${baseUrl}/v1`;
  } catch {
    return baseUrl;
  }
  return baseUrl;
}
