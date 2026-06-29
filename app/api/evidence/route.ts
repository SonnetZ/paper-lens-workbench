import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import {
  deleteEvidencePacket,
  listEvidencePackets,
  saveEvidencePacket,
  updateEvidencePdfVerificationNote
} from "@/lib/server/evidence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const recordId = url.searchParams.get("recordId") ?? undefined;
  const reviewProjectId = url.searchParams.get("reviewProjectId") ?? undefined;
  return NextResponse.json({
    evidence: listEvidencePackets(resolveAppConfig(), recordId, reviewProjectId)
  });
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const evidence = saveEvidencePacket(resolveAppConfig(), input);
    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save evidence" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    const evidence = updateEvidencePdfVerificationNote(
      resolveAppConfig(),
      String(input.evidenceId ?? ""),
      String(input.pdfVerificationNote ?? "")
    );
    return NextResponse.json({ evidence });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update evidence" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json();
    const evidenceId = deleteEvidencePacket(resolveAppConfig(), String(input.evidenceId ?? ""));
    return NextResponse.json({ evidenceId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete evidence" },
      { status: 400 }
    );
  }
}
