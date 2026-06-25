import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { readMarkdownForPaper } from "@/lib/server/sourceRegistry";

export async function GET(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const markdown = await readMarkdownForPaper(getEffectiveAppConfig(resolveAppConfig()), recordId);
  if (!markdown) return NextResponse.json({ error: "Markdown not found" }, { status: 404 });
  return NextResponse.json(markdown);
}
