import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { getPaperByRecordId } from "@/lib/server/sourceRegistry";

export async function GET(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const paper = await getPaperByRecordId(getEffectiveAppConfig(resolveAppConfig()), recordId);
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  return NextResponse.json({ paper });
}
