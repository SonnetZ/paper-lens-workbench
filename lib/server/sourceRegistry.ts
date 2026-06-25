import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, PaperListItem, PaperRecord } from "@/lib/types";
import { readCsvRows } from "@/lib/server/csvStore";

function rowToPaper(row: Record<string, string>): PaperRecord {
  return {
    recordId: row.record_id ?? "",
    title: row.title ?? "",
    firstAuthor: row.first_author ?? "",
    year: row.year ?? "",
    sourceFilename: row.source_filename ?? "",
    sourcePath: row.source_path ?? "",
    decision: row.decision ?? "",
    reviewStatus: row.review_status || "unreviewed"
  };
}

async function exists(pathname: string): Promise<boolean> {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

function normalizeStem(value: string): string {
  return path
    .basename(value, path.extname(value))
    .toLowerCase()
    .replace(/[\s_‐‑‒–—-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

async function resolveMarkdown(config: AppConfig, paper: PaperRecord): Promise<string | null> {
  const candidates = [
    paper.sourcePath,
    paper.sourceFilename,
    `${paper.recordId}.md`,
    `${paper.recordId}_sample.md`
  ].filter(Boolean);

  for (const candidate of candidates) {
    const pathname = path.isAbsolute(candidate)
      ? candidate
      : path.join(config.paperMdDir, candidate);
    if (await exists(pathname)) return pathname;
  }
  return null;
}

async function resolvePdf(config: AppConfig, paper: PaperRecord): Promise<string | null> {
  const directCandidates = [
    paper.sourceFilename.replace(/\.md$/i, ".pdf"),
    paper.sourcePath.replace(/\.md$/i, ".pdf"),
    `${paper.recordId}.pdf`
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    const pathname = path.isAbsolute(candidate)
      ? candidate
      : path.join(config.paperPdfDir, candidate);
    if (await exists(pathname)) return pathname;
  }

  const { readdir } = await import("node:fs/promises");
  const expected = normalizeStem(paper.sourceFilename || paper.sourcePath || paper.recordId);
  const entries = await readdir(config.paperPdfDir).catch(() => []);
  const match = entries.find(
    (entry) => entry.toLowerCase().endsWith(".pdf") && normalizeStem(entry) === expected
  );
  return match ? path.join(config.paperPdfDir, match) : null;
}

export async function loadPaperQueue(config: AppConfig): Promise<PaperListItem[]> {
  const rows = await readCsvRows(path.join(config.reviewDataDir, "full_text_screening.csv"));
  return Promise.all(
    rows.map(async (row) => {
      const paper = rowToPaper(row);
      const markdownPath = await resolveMarkdown(config, paper);
      const pdfPath = await resolvePdf(config, paper);
      return {
        ...paper,
        hasMarkdown: Boolean(markdownPath),
        hasPdf: Boolean(pdfPath),
        markdownPath,
        pdfPath,
        methodItemCount: 0,
        promptItemCount: 0,
        evaluationItemCount: 0
      };
    })
  );
}

export async function getPaperByRecordId(
  config: AppConfig,
  recordId: string
): Promise<PaperListItem | null> {
  const queue = await loadPaperQueue(config);
  return queue.find((paper) => paper.recordId === recordId) ?? null;
}

export async function readMarkdownForPaper(
  config: AppConfig,
  recordId: string
): Promise<{ content: string; path: string } | null> {
  const paper = await getPaperByRecordId(config, recordId);
  if (!paper?.markdownPath) return null;
  return {
    content: await readFile(paper.markdownPath, "utf-8"),
    path: paper.markdownPath
  };
}
