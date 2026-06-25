import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { readScreeningRow, updateScreeningDecision } from "@/lib/server/screening";

export async function GET(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const screening = await readScreeningRow(getEffectiveAppConfig(resolveAppConfig()), recordId);
  if (!screening) return NextResponse.json({ error: "Screening row not found" }, { status: 404 });
  return NextResponse.json({ screening });
}

export async function PUT(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await params;
    const input = await request.json();
    const screening = await updateScreeningDecision(
      getEffectiveAppConfig(resolveAppConfig()),
      recordId,
      input
    );
    return NextResponse.json({ screening });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save screening decision" },
      { status: 400 }
    );
  }
}
