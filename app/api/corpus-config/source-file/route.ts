import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import {
  addPaperSourceFileToScreening,
  getEffectiveCorpusConfig,
  validateCorpusConfig
} from "@/lib/server/corpusConfig";
import type { CorpusPathConfig } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CorpusPathConfig> & { filePath?: string };
    const current = getEffectiveCorpusConfig(resolveAppConfig());
    const corpus = {
      reviewDataDir: String(body.reviewDataDir || current.reviewDataDir),
      paperMdDir: String(body.paperMdDir || current.paperMdDir),
      paperPdfDir: String(body.paperPdfDir || current.paperPdfDir)
    };
    const screeningSync = await addPaperSourceFileToScreening(corpus, String(body.filePath ?? ""));
    const validation = await validateCorpusConfig(corpus);
    validation.summary.addedScreeningRowCount = screeningSync.addedRowCount;
    validation.summary.screeningRowCount = screeningSync.totalRowCount;
    return NextResponse.json({ config: { ...current, ...corpus }, validation, screeningSync });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add paper source file" },
      { status: 400 }
    );
  }
}
