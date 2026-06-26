import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import {
  defaultKnowledgeBaseId,
  getKnowledgeBaseStatus,
  ingestPaperMarkdown,
  ingestReviewArtifacts,
  listKnowledgeBases
} from "@/lib/server/knowledgeBase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    includePaper?: boolean;
    includeArtifacts?: boolean;
    knowledgeBaseId?: string;
  };
  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    const knowledgeBaseId = body.knowledgeBaseId || defaultKnowledgeBaseId;
    const results = [];
    if (body.includePaper !== false) {
      results.push(await ingestPaperMarkdown(config, recordId, knowledgeBaseId));
    }
    if (body.includeArtifacts) {
      results.push(ingestReviewArtifacts(config, recordId, knowledgeBaseId));
    }
    const ingested = {
      documentCount: results.reduce((sum, item) => sum + item.documentCount, 0),
      chunkCount: results.reduce((sum, item) => sum + item.chunkCount, 0),
      embeddingModel: results[0]?.embeddingModel ?? "portable-hash-v1"
    };
    return NextResponse.json({
      ingested,
      bases: listKnowledgeBases(config),
      status: getKnowledgeBaseStatus(config, knowledgeBaseId)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add paper knowledge" },
      { status: 400 }
    );
  }
}
