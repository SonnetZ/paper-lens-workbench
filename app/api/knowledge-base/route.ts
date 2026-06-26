import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import {
  createKnowledgeBase,
  defaultKnowledgeBaseId,
  getKnowledgeBaseStatus,
  ingestCorpusMarkdown,
  ingestIncludedReviewArtifacts,
  listKnowledgeBases
} from "@/lib/server/knowledgeBase";

export async function GET(request: Request) {
  const config = getEffectiveAppConfig(resolveAppConfig());
  const knowledgeBaseId =
    new URL(request.url).searchParams.get("knowledgeBaseId") ?? defaultKnowledgeBaseId;
  return NextResponse.json({
    bases: listKnowledgeBases(config),
    status: getKnowledgeBaseStatus(config, knowledgeBaseId)
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create" | "build-corpus" | "add-included-artifacts";
    name?: string;
    knowledgeBaseId?: string;
  };
  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    if (body.action === "create") {
      const base = createKnowledgeBase(config, body.name ?? "");
      return NextResponse.json({
        base,
        bases: listKnowledgeBases(config),
        status: getKnowledgeBaseStatus(config, base.id)
      });
    }

    const knowledgeBaseId = body.knowledgeBaseId || defaultKnowledgeBaseId;
    const ingested =
      body.action === "add-included-artifacts"
        ? await ingestIncludedReviewArtifacts(config, knowledgeBaseId)
        : await ingestCorpusMarkdown(config, { knowledgeBaseId });
    return NextResponse.json({
      ingested,
      bases: listKnowledgeBases(config),
      status: getKnowledgeBaseStatus(config, knowledgeBaseId)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build knowledge base" },
      { status: 400 }
    );
  }
}
