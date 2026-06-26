import type { AppConfig, RuntimeModelSettings, TranslationProvider } from "@/lib/types";
import {
  providerBaseUrl,
  providerHeaders,
  providerModel,
  resolveRuntimeModelConfig
} from "@/lib/server/llmService";

export interface TranslateSelectionInput {
  text: string;
  provider?: TranslationProvider;
  modelSettings?: RuntimeModelSettings;
}

export interface TranslateSelectionResult {
  translation: string;
  provider: TranslationProvider;
}

export async function translateSelection(
  config: AppConfig,
  input: TranslateSelectionInput,
  fetchImpl: typeof fetch = fetch
): Promise<TranslateSelectionResult> {
  const text = input.text.trim();
  if (!text) throw new Error("Text is required");
  const provider = normalizeProvider(input.provider);

  if (provider === "opus") {
    return {
      provider,
      translation: await callOpusMt(config, text, fetchImpl)
    };
  }

  return {
    provider,
    translation: await callOpenAiCompatibleTranslation(config, provider, input.modelSettings, text, fetchImpl)
  };
}

function normalizeProvider(provider: string | undefined): TranslationProvider {
  if (!provider) return "opus";
  if (provider === "opus" || provider === "local" || provider === "online") return provider;
  throw new Error(`Unsupported translation provider: ${provider}`);
}

async function callOpusMt(
  config: AppConfig,
  text: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const baseUrl = (config.translationOpusBaseUrl || "http://127.0.0.1:8010").replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      text,
      sourceLanguage: "en",
      targetLanguage: "zh"
    })
  });
  if (!response.ok) throw new Error(`OPUS-MT translation failed: HTTP ${response.status}`);
  const json = (await response.json()) as { translation?: string };
  const translation = json.translation?.trim();
  if (!translation) throw new Error("OPUS-MT returned an empty translation");
  return translation;
}

async function callOpenAiCompatibleTranslation(
  config: AppConfig,
  provider: Exclude<TranslationProvider, "opus">,
  settings: RuntimeModelSettings | undefined,
  text: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const runtime = resolveRuntimeModelConfig(
    { ...config, llmMode: provider },
    settings ? { ...settings, mode: provider } : undefined
  );
  const baseUrl = providerBaseUrl(runtime.config).replace(/\/+$/, "");
  const model = providerModel(runtime.config);
  if (!baseUrl) throw new Error("Model provider base URL is not configured");
  if (!model) throw new Error("Model name is not configured");

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: providerHeaders(runtime.config, runtime.manualOnlineApiKey),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Translate selected English academic text into Simplified Chinese. Return only the translation."
        },
        {
          role: "user",
          content: text.slice(0, runtime.config.llmMaxInputChars)
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Translation provider request failed: HTTP ${response.status}`);
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const translation = json.choices?.[0]?.message?.content?.trim();
  if (!translation) throw new Error("Translation provider returned an empty answer");
  return translation;
}
