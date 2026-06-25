import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import {
  getKnowledgeBaseStatus,
  ingestPaperMarkdown,
  ingestReviewArtifacts
} from "@/lib/server/knowledgeBase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    includePaper?: boolean;
    includeArtifacts?: boolean;
  };
  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    const results = [];
    if (body.includePaper !== false) {
      results.push(await ingestPaperMarkdown(config, recordId));
    }
    if (body.includeArtifacts) {
      results.push(ingestReviewArtifacts(config, recordId));
    }
    const ingested = {
      documentCount: results.reduce((sum, item) => sum + item.documentCount, 0),
      chunkCount: results.reduce((sum, item) => sum + item.chunkCount, 0),
      embeddingModel: results[0]?.embeddingModel ?? "portable-hash-v1"
    };
    return NextResponse.json({ ingested, status: getKnowledgeBaseStatus(config) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add paper knowledge" },
      { status: 400 }
    );
  }
}
