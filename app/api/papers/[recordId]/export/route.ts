import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { exportReviewMaterial } from "@/lib/server/reviewExport";

export async function POST(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await params;
    const exported = await exportReviewMaterial(getEffectiveAppConfig(resolveAppConfig()), recordId);
    return NextResponse.json({
      export: {
        recordId: exported.recordId,
        format: exported.format,
        path: exported.path,
        evidenceCount: exported.evidenceCount
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export review material" },
      { status: 400 }
    );
  }
}
