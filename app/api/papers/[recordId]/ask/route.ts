import { NextResponse } from "next/server";
import type { PayloadScope, RuntimeModelSettings, ScopedAskInput } from "@/lib/types";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { answerScopedAsk } from "@/lib/server/llmService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<ScopedAskInput>;

  try {
    const answer = await answerScopedAsk(getEffectiveAppConfig(resolveAppConfig()), {
      recordId,
      question: body.question ?? "",
      payloadScope: (body.payloadScope ?? "Selection") as PayloadScope,
      evidence: body.evidence ?? [],
      knowledgeBaseId: body.knowledgeBaseId,
      modelSettings: body.modelSettings as RuntimeModelSettings | undefined
    });
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer scoped question" },
      { status: 400 }
    );
  }
}
