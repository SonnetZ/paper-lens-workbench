import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import {
  getEffectiveCorpusConfig,
  saveCorpusConfig,
  validateCorpusConfig
} from "@/lib/server/corpusConfig";
import type { CorpusPathConfig } from "@/lib/types";

export async function GET() {
  const config = getEffectiveCorpusConfig(resolveAppConfig());
  const validation = await validateCorpusConfig(config);
  return NextResponse.json({ config, validation });
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as Partial<CorpusPathConfig>;
    const corpus = {
      reviewDataDir: String(input.reviewDataDir ?? ""),
      paperMdDir: String(input.paperMdDir ?? ""),
      paperPdfDir: String(input.paperPdfDir ?? "")
    };
    const saved = await saveCorpusConfig(resolveAppConfig(), corpus);
    const validation = await validateCorpusConfig(saved);
    validation.summary.addedScreeningRowCount = saved.screeningSync.addedRowCount;
    validation.summary.screeningRowCount = saved.screeningSync.totalRowCount;
    const { screeningSync: _screeningSync, ...config } = saved;
    return NextResponse.json({ config, validation, screeningSync: saved.screeningSync });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save corpus paths" },
      { status: 400 }
    );
  }
}
