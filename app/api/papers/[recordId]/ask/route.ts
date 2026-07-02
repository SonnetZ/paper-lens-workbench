import { NextResponse } from "next/server";
import type { PayloadScope, RuntimeModelSettings, ScopedAskInput } from "@/lib/types";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { answerScopedAsk } from "@/lib/server/llmService";
import {
  clearAskChatMessages,
  listAskChatMessages,
  saveAskChatMessage
} from "@/lib/server/askChat";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const url = new URL(request.url);
  const payloadScope = (url.searchParams.get("payloadScope") ?? "Selection") as PayloadScope;
  const reviewProjectId = projectId(
    url.searchParams.get("reviewProjectId"),
    url.searchParams.get("knowledgeBaseId")
  );
  const config = getEffectiveAppConfig(resolveAppConfig());
  return NextResponse.json({
    messages: listAskChatMessages(config, reviewProjectId, recordId, payloadScope)
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<ScopedAskInput> & {
    reviewProjectId?: string;
  };

  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    const payloadScope = (body.payloadScope ?? "Selection") as PayloadScope;
    const reviewProjectId = projectId(body.reviewProjectId, body.knowledgeBaseId);
    const priorMessages = listAskChatMessages(config, reviewProjectId, recordId, payloadScope);
    const answer = await answerScopedAsk(config, {
      recordId,
      question: body.question ?? "",
      payloadScope,
      evidence: body.evidence ?? [],
      knowledgeBaseId: body.knowledgeBaseId,
      modelSettings: body.modelSettings as RuntimeModelSettings | undefined,
      chatHistory: priorMessages.map(({ role, content }) => ({ role, content }))
    });
    const userMessage = saveAskChatMessage(config, {
      reviewProjectId,
      recordId,
      payloadScope,
      role: "user",
      content: body.question ?? "",
      evidenceUsed: [],
      warnings: []
    });
    const assistantMessage = saveAskChatMessage(config, {
      reviewProjectId,
      recordId,
      payloadScope,
      role: "assistant",
      content: answer.answer,
      evidenceUsed: answer.evidenceUsed,
      warnings: answer.warnings
    });
    return NextResponse.json({
      answer,
      messages: [...priorMessages, userMessage, assistantMessage]
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer scoped question" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const url = new URL(request.url);
  const payloadScope = (url.searchParams.get("payloadScope") ?? "Selection") as PayloadScope;
  const reviewProjectId = projectId(
    url.searchParams.get("reviewProjectId"),
    url.searchParams.get("knowledgeBaseId")
  );
  const config = getEffectiveAppConfig(resolveAppConfig());
  clearAskChatMessages(config, reviewProjectId, recordId, payloadScope);
  return NextResponse.json({ messages: [] });
}

function projectId(reviewProjectId?: string | null, knowledgeBaseId?: string | null): string {
  return reviewProjectId?.trim() || knowledgeBaseId?.trim() || "default";
}
