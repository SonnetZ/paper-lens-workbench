import { NextResponse } from "next/server";
import type { RuntimeModelSettings } from "@/lib/types";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { answerCorpusSynthesis } from "@/lib/server/llmService";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    knowledgeBaseId?: string;
    modelSettings?: RuntimeModelSettings;
  };

  try {
    const answer = await answerCorpusSynthesis(getEffectiveAppConfig(resolveAppConfig()), {
      question: body.question ?? "",
      knowledgeBaseId: body.knowledgeBaseId,
      modelSettings: body.modelSettings
    });
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to synthesize corpus" },
      { status: 400 }
    );
  }
}
