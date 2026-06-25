import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { getKnowledgeBaseStatus, ingestCorpusMarkdown } from "@/lib/server/knowledgeBase";

export async function GET() {
  const config = getEffectiveAppConfig(resolveAppConfig());
  return NextResponse.json({ status: getKnowledgeBaseStatus(config) });
}

export async function POST() {
  try {
    const config = getEffectiveAppConfig(resolveAppConfig());
    const ingested = await ingestCorpusMarkdown(config);
    return NextResponse.json({ ingested, status: getKnowledgeBaseStatus(config) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build knowledge base" },
      { status: 400 }
    );
  }
}
