import { AppShell } from "@/components/AppShell";
import { resolveAppConfig } from "@/lib/server/config";
import { getEffectiveAppConfig } from "@/lib/server/corpusConfig";
import { loadPaperQueue } from "@/lib/server/sourceRegistry";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const papers = await loadPaperQueue(getEffectiveAppConfig(resolveAppConfig()));
  return <AppShell initialPapers={papers} />;
}
