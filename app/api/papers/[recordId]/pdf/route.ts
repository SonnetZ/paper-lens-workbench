import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { getPaperByRecordId } from "@/lib/server/sourceRegistry";

export async function GET(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const config = getEffectiveAppConfig(resolveAppConfig());
  const paper = await getPaperByRecordId(config, recordId);
  if (!paper?.pdfPath) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  const bytes = await readFile(paper.pdfPath);
  return new NextResponse(bytes, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store"
    }
  });
}
