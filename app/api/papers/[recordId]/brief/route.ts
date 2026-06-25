import { NextResponse } from "next/server";
import type { PayloadScope } from "@/lib/types";
import { resolveAppConfig } from "@/lib/server/config";
import { assertAllowedBriefRequest, createMockBrief } from "@/lib/server/llmService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  const body = (await request.json().catch(() => ({}))) as { payloadScope?: PayloadScope };
  const config = resolveAppConfig();

  try {
    assertAllowedBriefRequest(config, body.payloadScope ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brief request rejected" },
      { status: 400 }
    );
  }

  if (config.llmMode === "mock") {
    return NextResponse.json({ brief: createMockBrief(recordId) });
  }

  return NextResponse.json(
    { error: "Local and online brief generation are not enabled in phase one" },
    { status: 501 }
  );
}
