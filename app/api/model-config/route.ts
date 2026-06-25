import { NextResponse } from "next/server";
import { resolveAppConfig } from "@/lib/server/config";
import { getRedactedModelConfig } from "@/lib/server/modelConfig";

export function GET() {
  return NextResponse.json({ config: getRedactedModelConfig(resolveAppConfig()) });
}
