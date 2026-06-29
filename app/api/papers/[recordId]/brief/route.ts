import { NextResponse } from "next/server";
import type { BriefModelSettings, PayloadScope, RuntimeModelSettings } from "@/lib/types";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { generateBrief } from "@/lib/server/llmService";
import { readBriefArtifact, saveBriefArtifact } from "@/lib/server/brief";

export async function GET(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const reviewProjectId = new URL(request.url).searchParams.get("reviewProjectId") ?? "default";
  return NextResponse.json({
    brief: readBriefArtifact(getEffectiveAppConfig(resolveAppConfig()), reviewProjectId, recordId)
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reviewProjectId?: string;
    payloadScope?: PayloadScope;
    modelSettings?: RuntimeModelSettings;
  };

  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    const generatedBrief = await generateBrief(config, {
      recordId,
      payloadScope: body.payloadScope ?? "Paper sections",
      modelSettings: body.modelSettings
    });
    const saved = saveBriefArtifact(config, body.reviewProjectId ?? "default", recordId, {
      eligibilitySuggestion: generatedBrief.eligibility_suggestion,
      rationale: generatedBrief.rationale,
      readFirst: generatedBrief.read_first,
      warnings: generatedBrief.warnings,
      payloadScope: body.payloadScope ?? "Paper sections",
      modelSettings: redactModelSettings(body.modelSettings)
    });
    return NextResponse.json({
      brief: toWireBrief(saved)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate brief" },
      { status: 400 }
    );
  }
}

function toWireBrief(brief: ReturnType<typeof saveBriefArtifact>) {
  return {
    recordId: brief.recordId,
    reviewProjectId: brief.reviewProjectId,
    eligibility_suggestion: brief.eligibilitySuggestion,
    rationale: brief.rationale,
    read_first: brief.readFirst,
    warnings: brief.warnings,
    payload_scope: brief.payloadScope,
    model_settings: brief.modelSettings,
    updated_at: brief.updatedAt
  };
}

function redactModelSettings(settings?: RuntimeModelSettings): BriefModelSettings | undefined {
  if (!settings) return undefined;
  return {
    mode: settings.mode,
    localBaseUrl: settings.localBaseUrl,
    localModel: settings.localModel,
    onlineBaseUrl: settings.onlineBaseUrl,
    onlineModel: settings.onlineModel,
    onlineConfigSource: settings.onlineConfigSource
  };
}
