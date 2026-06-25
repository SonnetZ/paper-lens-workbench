import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { loadPaperQueue } from "@/lib/server/sourceRegistry";

export async function GET() {
  const papers = await loadPaperQueue(getEffectiveAppConfig(resolveAppConfig()));
  return NextResponse.json({ papers });
}
