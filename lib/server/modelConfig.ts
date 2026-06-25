import type { AppConfig, ModelSource } from "@/lib/types";
import {
  onlineCredentialState,
  resolveConfiguredOnlineProvider
} from "@/lib/server/onlineCredentials";

export interface RedactedModelConfig {
  activeMode: AppConfig["llmMode"];
  reviewerSources: ModelSource[];
  local: {
    baseUrl: string;
    selectedModel: string;
    configured: boolean;
  };
  online: {
    baseUrlHost: string;
    selectedModel: string;
    configured: boolean;
    credentialState: "missing" | "present";
    configSource: AppConfig["onlineConfigSource"];
  };
}

export interface ModelConnectionResult {
  ok: boolean;
  models: string[];
  error: string | null;
}

function hostFromUrl(value: string): string {
  if (!value.trim()) return "";
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

export function getRedactedModelConfig(config: AppConfig): RedactedModelConfig {
  const configuredOnline =
    config.onlineConfigSource === "manual"
      ? null
      : resolveConfiguredOnlineProvider();
  const onlineBaseUrl = configuredOnline?.baseUrl || config.onlineLlmBaseUrl;
  const onlineModel = configuredOnline?.model || config.onlineLlmModel;

  return {
    activeMode: config.llmMode,
    reviewerSources: ["local", "online"],
    local: {
      baseUrl: config.localLlmBaseUrl,
      selectedModel: config.localLlmModel,
      configured: Boolean(config.localLlmBaseUrl)
    },
    online: {
      baseUrlHost: hostFromUrl(onlineBaseUrl),
      selectedModel: onlineModel,
      configured: Boolean(onlineBaseUrl && onlineModel),
      credentialState: onlineCredentialState(config.onlineConfigSource),
      configSource: config.onlineConfigSource
    }
  };
}

export async function testLocalModelConnection(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<ModelConnectionResult> {
  const normalized = baseUrl.replace(/\/+$/, "");
  try {
    const response = await fetchImpl(`${normalized}/models`, {
      method: "GET",
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      return { ok: false, models: [], error: `HTTP ${response.status}` };
    }
    const json = (await response.json()) as { data?: Array<{ id?: string }> };
    return {
      ok: true,
      models: (json.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}

export async function testOnlineModelConnection(
  baseUrl: string,
  apiKey: string,
  modelOrFetchImpl: string | typeof fetch = "",
  fetchImplMaybe?: typeof fetch
): Promise<ModelConnectionResult> {
  const normalized = baseUrl.replace(/\/+$/, "");
  const model = typeof modelOrFetchImpl === "string" ? modelOrFetchImpl.trim() : "";
  const fetchImpl = typeof modelOrFetchImpl === "function" ? modelOrFetchImpl : fetchImplMaybe ?? fetch;
  if (!normalized) return { ok: false, models: [], error: "Online base URL is not configured" };
  if (!apiKey.trim()) return { ok: false, models: [], error: "Online API key is not configured" };

  try {
    const response = await fetchImpl(`${normalized}/models`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      if (model && response.status === 404) {
        return await testOnlineChatProbe(normalized, apiKey, model, fetchImpl);
      }
      return { ok: false, models: [], error: `HTTP ${response.status}` };
    }
    const json = (await response.json()) as { data?: Array<{ id?: string }> };
    return {
      ok: true,
      models: (json.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}

async function testOnlineChatProbe(
  normalizedBaseUrl: string,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch
): Promise<ModelConnectionResult> {
  try {
    const response = await fetchImpl(`${normalizedBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Reply with ok." }]
      })
    });
    if (!response.ok) return { ok: false, models: [], error: `HTTP ${response.status}` };
    return { ok: true, models: [model], error: null };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}
