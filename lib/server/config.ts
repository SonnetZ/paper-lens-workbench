import path from "node:path";
import type { AppConfig, InternalLlmMode } from "@/lib/types";

function resolvePath(value: string | undefined, cwd: string, fallback: string): string {
  const selected = value && value.trim().length > 0 ? value : fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(cwd, selected);
}

function resolveMode(value: string | undefined): InternalLlmMode {
  const mode = value ?? "mock";
  if (mode === "mock" || mode === "local" || mode === "online") return mode;
  throw new Error(`Unsupported LLM_MODE: ${mode}`);
}

export function resolveAppConfig(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd()
): AppConfig {
  const localPort = env.LOCAL_LLM_PORT?.trim() || "8000";
  const localBaseUrl =
    env.LOCAL_LLM_BASE_URL?.trim() || `http://localhost:${localPort}/v1`;

  return {
    llmMode: resolveMode(env.LLM_MODE),
    reviewDataDir: resolvePath(env.REVIEW_DATA_DIR, cwd, "./sample-data/scoping_review"),
    paperPdfDir: resolvePath(env.PAPER_PDF_DIR, cwd, "./sample-data/papers_pdf"),
    paperMdDir: resolvePath(env.PAPER_MD_DIR, cwd, "./sample-data/papers_md"),
    readerDbPath: resolvePath(env.READER_DB_PATH, cwd, "./reader.sqlite"),
    readerExportDir: resolvePath(env.READER_EXPORT_DIR, cwd, "./exports"),
    localLlmBaseUrl: localBaseUrl,
    localLlmModel: env.LOCAL_LLM_MODEL ?? "",
    onlineLlmBaseUrl: env.ONLINE_LLM_BASE_URL ?? "",
    onlineLlmModel: env.ONLINE_LLM_MODEL ?? "",
    onlineConfigSource:
      env.ONLINE_LLM_CONFIG_SOURCE === "env" || env.ONLINE_LLM_CONFIG_SOURCE === "cc_switch"
        ? env.ONLINE_LLM_CONFIG_SOURCE
        : "manual",
    llmMaxInputChars: Number.parseInt(env.LLM_MAX_INPUT_CHARS ?? "24000", 10)
  };
}
