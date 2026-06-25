import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { readExtractionArtifact, saveExtractionArtifact } from "@/lib/server/extraction";

export async function GET(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return NextResponse.json({ extraction: readExtractionArtifact(resolveAppConfig(), recordId) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await params;
    const input = await request.json();
    const extraction = saveExtractionArtifact(resolveAppConfig(), recordId, input);
    return NextResponse.json({ extraction });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save extraction" },
      { status: 400 }
    );
  }
}
