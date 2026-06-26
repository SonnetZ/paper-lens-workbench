import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  AppConfig,
  CorpusPathConfig,
  CorpusValidationResult,
  CorpusValidationSummary
} from "@/lib/types";
import { readCsvTable, readCsvTableOrDefault, writeCsvTableAtomic } from "@/lib/server/csvStore";
import { openReaderDb } from "@/lib/server/sqliteStore";

const keys = {
  reviewDataDir: "corpus.reviewDataDir",
  paperMdDir: "corpus.paperMdDir",
  paperPdfDir: "corpus.paperPdfDir"
} as const;

const screeningFilename = "full_text_screening.csv";
const screeningColumns = [
  "record_id",
  "title",
  "first_author",
  "year",
  "source_filename",
  "source_path",
  "decision",
  "primary_exclusion_reason",
  "eligibility_rationale",
  "typology_relevance_notes",
  "evaluation_relevance_notes",
  "prompting_practices_notes",
  "evidence_locator",
  "review_status",
  "second_review_reason",
  "reviewer",
  "review_date"
];

export interface EffectiveCorpusConfig extends CorpusPathConfig {
  readerDbPath: string;
  readerExportDir: string;
}

export interface ScreeningSyncResult {
  markdownFileCount: number;
  pdfFileCount: number;
  existingRowCount: number;
  addedRowCount: number;
  totalRowCount: number;
}

export interface SavedCorpusConfig extends EffectiveCorpusConfig {
  screeningSync: ScreeningSyncResult;
}

export function getEffectiveCorpusConfig(config: AppConfig): EffectiveCorpusConfig {
  const override = readSavedCorpusConfig(config);
  return {
    reviewDataDir: override.reviewDataDir || config.reviewDataDir,
    paperMdDir: override.paperMdDir || config.paperMdDir,
    paperPdfDir: override.paperPdfDir || config.paperPdfDir,
    readerDbPath: config.readerDbPath,
    readerExportDir: config.readerExportDir
  };
}

export function getEffectiveAppConfig(config: AppConfig): AppConfig {
  const corpus = getEffectiveCorpusConfig(config);
  return {
    ...config,
    reviewDataDir: corpus.reviewDataDir,
    paperMdDir: corpus.paperMdDir,
    paperPdfDir: corpus.paperPdfDir
  };
}

export async function validateCorpusConfig(
  input: CorpusPathConfig
): Promise<CorpusValidationResult> {
  const normalized = normalizeCorpusConfig(input);
  const summary: CorpusValidationSummary = {
    screeningCsv: await exists(path.join(normalized.reviewDataDir, screeningFilename)),
    controlledVocabularies: await exists(
      path.join(normalized.reviewDataDir, "controlled_vocabularies.json")
    ),
    markdownFileCount: await countFiles(normalized.paperMdDir, ".md"),
    pdfFileCount: await countFiles(normalized.paperPdfDir, ".pdf"),
    screeningRowCount: await countScreeningRows(normalized.reviewDataDir),
    addedScreeningRowCount: 0
  };
  const issues: string[] = [];

  if (!(await isDirectory(normalized.reviewDataDir))) {
    issues.push("Review data folder is not readable.");
  }
  if (!(await isDirectory(normalized.paperMdDir))) {
    issues.push("Markdown papers folder is not readable.");
  }
  if (!(await isDirectory(normalized.paperPdfDir))) {
    issues.push("PDF papers folder is not readable.");
  }
  if (!summary.screeningCsv) {
    issues.push("Review data folder must contain full_text_screening.csv.");
  }
  if (summary.markdownFileCount + summary.pdfFileCount === 0) {
    issues.push("Paper folders do not contain any .md or .pdf files.");
  }

  return {
    ok: issues.length === 0,
    issues,
    summary
  };
}

export async function syncScreeningRowsForMarkdownPapers(
  input: CorpusPathConfig
): Promise<ScreeningSyncResult> {
  const normalized = normalizeCorpusConfig(input);
  const sourceGroups = await listPaperSourceGroups(normalized.paperMdDir, normalized.paperPdfDir);
  const pathname = path.join(normalized.reviewDataDir, screeningFilename);
  const table = await readCsvTableOrDefault(pathname, screeningColumns);
  const columns = withRequiredColumns(table.columns);
  const rows = table.rows;
  const existingKeys = new Set(rows.flatMap(rowPaperKeys));
  const usedRecordIds = new Set(rows.map((row) => row.record_id).filter(Boolean));
  let nextRecordNumber = nextFtRecordNumber(usedRecordIds);
  let addedRowCount = 0;

  for (const group of sourceGroups) {
    const key = group.key;
    if (existingKeys.has(key)) continue;

    const recordId = nextAvailableRecordId(usedRecordIds, nextRecordNumber);
    nextRecordNumber = Number.parseInt(recordId.replace(/^FT/i, ""), 10) + 1;
    usedRecordIds.add(recordId);
    existingKeys.add(key);
    const filename = group.markdownFilename ?? group.pdfFilename ?? "";
    rows.push(
      makeBaseScreeningRow(
        recordId,
        filename,
        group.markdownFilename
          ? await readMarkdownTitle(path.join(normalized.paperMdDir, group.markdownFilename))
          : path.basename(filename, path.extname(filename))
      )
    );
    addedRowCount += 1;
  }

  if (addedRowCount > 0 || columns.join("\0") !== table.columns.join("\0")) {
    await writeCsvTableAtomic(pathname, columns, rows);
  }

  return {
    markdownFileCount: sourceGroups.filter((group) => group.markdownFilename).length,
    pdfFileCount: sourceGroups.filter((group) => group.pdfFilename).length,
    existingRowCount: rows.length - addedRowCount,
    addedRowCount,
    totalRowCount: rows.length
  };
}

export async function addPaperSourceFileToScreening(
  input: CorpusPathConfig,
  filePath: string
): Promise<ScreeningSyncResult> {
  const normalized = normalizeCorpusConfig(input);
  const pathname = path.resolve(filePath.trim());
  const file = await stat(pathname);
  if (!file.isFile()) throw new Error("Selected paper source is not a file.");
  const extension = path.extname(pathname).toLowerCase();
  if (extension !== ".md" && extension !== ".pdf") {
    throw new Error("Selected paper source must be a .md or .pdf file.");
  }

  const table = await readCsvTableOrDefault(path.join(normalized.reviewDataDir, screeningFilename), screeningColumns);
  const columns = withRequiredColumns(table.columns);
  const rows = table.rows;
  const existingKeys = new Set(rows.flatMap(rowPaperKeys));
  const sourceKeyValue = sourceKey(pathname);
  const markdownFileCount = await countFiles(normalized.paperMdDir, ".md");
  const pdfFileCount = await countFiles(normalized.paperPdfDir, ".pdf");
  if (existingKeys.has(sourceKeyValue)) {
    return {
      markdownFileCount,
      pdfFileCount,
      existingRowCount: rows.length,
      addedRowCount: 0,
      totalRowCount: rows.length
    };
  }

  const usedRecordIds = new Set(rows.map((row) => row.record_id).filter(Boolean));
  const recordId = nextAvailableRecordId(usedRecordIds, nextFtRecordNumber(usedRecordIds));
  const filename = path.basename(pathname);
  rows.push(
    makeBaseScreeningRow(
      recordId,
      filename,
      extension === ".md" ? await readMarkdownTitle(pathname) : path.basename(filename, extension),
      pathname
    )
  );
  await writeCsvTableAtomic(path.join(normalized.reviewDataDir, screeningFilename), columns, rows);

  return {
    markdownFileCount,
    pdfFileCount,
    existingRowCount: rows.length - 1,
    addedRowCount: 1,
    totalRowCount: rows.length
  };
}

export async function saveCorpusConfig(
  config: AppConfig,
  input: CorpusPathConfig
): Promise<SavedCorpusConfig> {
  const normalized = normalizeCorpusConfig(input);
  const validation = await validateCorpusConfig(normalized);
  if (!validation.ok) throw new Error(validation.issues.join(" "));
  const screeningSync = await syncScreeningRowsForMarkdownPapers(normalized);

  const db = openReaderDb(config.readerDbPath);
  const now = new Date().toISOString();
  const statement = db.prepare(
    `INSERT INTO model_config (key, value, updated_at)
     VALUES (@key, @value, @updatedAt)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  statement.run({ key: keys.reviewDataDir, value: normalized.reviewDataDir, updatedAt: now });
  statement.run({ key: keys.paperMdDir, value: normalized.paperMdDir, updatedAt: now });
  statement.run({ key: keys.paperPdfDir, value: normalized.paperPdfDir, updatedAt: now });
  db.close();

  return {
    ...getEffectiveCorpusConfig(config),
    screeningSync
  };
}

function readSavedCorpusConfig(config: AppConfig): CorpusPathConfig {
  const db = openReaderDb(config.readerDbPath);
  const rows = db
    .prepare("SELECT key, value FROM model_config WHERE key IN (?, ?, ?)")
    .all(keys.reviewDataDir, keys.paperMdDir, keys.paperPdfDir) as Array<{
    key: string;
    value: string;
  }>;
  db.close();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    reviewDataDir: values.get(keys.reviewDataDir) ?? "",
    paperMdDir: values.get(keys.paperMdDir) ?? "",
    paperPdfDir: values.get(keys.paperPdfDir) ?? ""
  };
}

function normalizeCorpusConfig(input: CorpusPathConfig): CorpusPathConfig {
  return {
    reviewDataDir: path.resolve(input.reviewDataDir.trim()),
    paperMdDir: path.resolve(input.paperMdDir.trim()),
    paperPdfDir: path.resolve(input.paperPdfDir.trim())
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

async function countScreeningRows(reviewDataDir: string): Promise<number> {
  try {
    const { rows } = await readCsvTable(path.join(reviewDataDir, screeningFilename));
    return rows.length;
  } catch {
    return 0;
  }
}

async function isDirectory(pathname: string): Promise<boolean> {
  try {
    return (await stat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

async function countFiles(dir: string, extension: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension)
    ).length;
  } catch {
    return 0;
  }
}

async function listFilenames(dir: string, extension: ".md" | ".pdf"): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => entry.name);
}

async function listPaperSourceGroups(mdDir: string, pdfDir: string): Promise<
  Array<{ key: string; markdownFilename?: string; pdfFilename?: string }>
> {
  const groups = new Map<string, { key: string; markdownFilename?: string; pdfFilename?: string }>();
  for (const filename of await listFilenames(mdDir, ".md")) {
    const key = sourceKey(filename);
    groups.set(key, { ...groups.get(key), key, markdownFilename: filename });
  }
  for (const filename of await listFilenames(pdfDir, ".pdf")) {
    const key = sourceKey(filename);
    groups.set(key, { ...groups.get(key), key, pdfFilename: filename });
  }
  return [...groups.values()].sort((left, right) =>
    (left.markdownFilename ?? left.pdfFilename ?? "").localeCompare(
      right.markdownFilename ?? right.pdfFilename ?? "",
      undefined,
      { sensitivity: "base" }
    )
  );
}

function withRequiredColumns(columns: string[]): string[] {
  const next = columns.length > 0 ? [...columns] : [...screeningColumns];
  for (const column of screeningColumns) {
    if (!next.includes(column)) next.push(column);
  }
  return next;
}

function rowPaperKeys(row: Record<string, string>): string[] {
  return [
    row.source_filename,
    row.source_path,
    row.record_id ? `${row.record_id}.md` : "",
    row.record_id ? `${row.record_id}.pdf` : ""
  ]
    .filter(Boolean)
    .map(sourceKey);
}

function sourceKey(value: string): string {
  return path
    .basename(value, path.extname(value))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_‐‑‒–—-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function nextFtRecordNumber(recordIds: Set<string>): number {
  let max = 0;
  for (const recordId of recordIds) {
    const match = /^FT(\d+)$/i.exec(recordId.trim());
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return max + 1;
}

function nextAvailableRecordId(recordIds: Set<string>, start: number): string {
  let current = start;
  while (recordIds.has(formatFtRecordId(current))) {
    current += 1;
  }
  return formatFtRecordId(current);
}

function formatFtRecordId(value: number): string {
  return `FT${String(value).padStart(4, "0")}`;
}

function makeBaseScreeningRow(
  recordId: string,
  filename: string,
  title: string,
  sourcePath = filename
): Record<string, string> {
  return {
    record_id: recordId,
    title: title || path.basename(filename, path.extname(filename)),
    first_author: "",
    year: "",
    source_filename: filename,
    source_path: sourcePath,
    decision: "",
    primary_exclusion_reason: "",
    eligibility_rationale: "",
    typology_relevance_notes: "",
    evaluation_relevance_notes: "",
    prompting_practices_notes: "",
    evidence_locator: "",
    review_status: "unreviewed",
    second_review_reason: "",
    reviewer: "",
    review_date: ""
  };
}

async function readMarkdownTitle(pathname: string): Promise<string> {
  try {
    const content = await readFile(pathname, "utf-8");
    const heading = content
      .split(/\r?\n/)
      .map((line) => /^#\s+(.+?)\s*$/.exec(line))
      .find((match): match is RegExpExecArray => Boolean(match));
    return heading ? cleanMarkdownTitle(heading[1]) : "";
  } catch {
    return "";
  }
}

function cleanMarkdownTitle(value: string): string {
  return value
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
