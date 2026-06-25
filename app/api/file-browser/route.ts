import { NextResponse } from "next/server";
import { listFileBrowserDirectory } from "@/lib/server/fileBrowser";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const listing = await listFileBrowserDirectory(url.searchParams.get("path") ?? undefined);
    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list directory" },
      { status: 400 }
    );
  }
}
