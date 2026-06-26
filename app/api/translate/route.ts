import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { translateSelection } from "@/lib/server/translation";
import type { RuntimeModelSettings, TranslationProvider } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      provider?: TranslationProvider;
      modelSettings?: RuntimeModelSettings;
    };
    const result = await translateSelection(resolveAppConfig(), {
      text: body.text ?? "",
      provider: body.provider ?? "opus",
      modelSettings: body.modelSettings
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to translate selection" },
      { status: 400 }
    );
  }
}
