import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { searchKnowledgeBase } from "@/lib/server/knowledgeBase";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    topK?: number;
    recordId?: string;
    knowledgeBaseId?: string;
  };
  try {
    const results = searchKnowledgeBase(getEffectiveAppConfig(resolveAppConfig()), body.query ?? "", {
      topK: body.topK,
      recordId: body.recordId,
      knowledgeBaseId: body.knowledgeBaseId
    });
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search knowledge base" },
      { status: 400 }
    );
  }
}
