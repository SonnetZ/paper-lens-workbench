import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { testLocalModelConnection, testOnlineModelConnection } from "@/lib/server/modelConfig";
import {
  resolveConfiguredOnlineProvider,
  resolveOnlineApiKey
} from "@/lib/server/onlineCredentials";
import type { AppConfig } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    source?: string;
    baseUrl?: string;
    model?: string;
    configSource?: AppConfig["onlineConfigSource"];
    apiKey?: string;
  };
  const config = resolveAppConfig();

  if (body.source === "local") {
    const result = await testLocalModelConnection(body.baseUrl || config.localLlmBaseUrl);
    return NextResponse.json(result);
  }

  if (body.source !== "online") {
    return NextResponse.json(
      { ok: false, models: [], error: "Unsupported model source" },
      { status: 400 }
    );
  }

  const configSource = normalizeOnlineConfigSource(body.configSource);
  const configured = configSource === "manual" ? null : resolveConfiguredOnlineProvider();
  const baseUrl = body.baseUrl?.trim() || configured?.baseUrl || config.onlineLlmBaseUrl;
  const apiKey =
    configSource === "manual"
      ? body.apiKey?.trim() || ""
      : resolveOnlineApiKey(configSource) || "";
  const selectedModel =
    body.model?.trim() || configured?.model || config.onlineLlmModel || "";
  const result = await testOnlineModelConnection(baseUrl, apiKey, selectedModel);
  const returnedModel = selectedModel || result.models[0] || "";

  return NextResponse.json({
    ...result,
    baseUrl,
    selectedModel: returnedModel
  });
}

function normalizeOnlineConfigSource(
  source: AppConfig["onlineConfigSource"] | undefined
): AppConfig["onlineConfigSource"] {
  return source === "env" || source === "cc_switch" ? source : "manual";
}
