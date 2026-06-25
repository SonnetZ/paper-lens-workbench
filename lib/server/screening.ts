import path from "node:path";
import type { AppConfig, ScreeningDecision, ScreeningRow, ScreeningUpdateInput } from "@/lib/types";
import { readCsvTable, writeCsvTableAtomic } from "@/lib/server/csvStore";

const screeningFilename = "full_text_screening.csv";
const validDecisions = new Set<ScreeningDecision>(["", "include", "exclude", "maybe"]);

const requiredColumns = [
  "record_id",
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

export async function readScreeningRow(
  config: AppConfig,
  recordId: string
): Promise<ScreeningRow | null> {
  const { rows } = await readCsvTable(screeningPath(config));
  const row = rows.find((item) => item.record_id === recordId);
  return row ? rowToScreening(row) : null;
}

export async function updateScreeningDecision(
  config: AppConfig,
  recordId: string,
  input: ScreeningUpdateInput
): Promise<ScreeningRow> {
  validateScreeningInput(input);
  const pathname = screeningPath(config);
  const { columns, rows } = await readCsvTable(pathname);
  ensureColumns(columns);

  const index = rows.findIndex((row) => row.record_id === recordId);
  if (index === -1) {
    throw new Error(`Screening row not found: ${recordId}`);
  }

  rows[index] = {
    ...rows[index],
    decision: input.decision,
    primary_exclusion_reason: input.primaryExclusionReason,
    eligibility_rationale: input.eligibilityRationale.trim(),
    typology_relevance_notes: input.typologyRelevanceNotes,
    evaluation_relevance_notes: input.evaluationRelevanceNotes,
    prompting_practices_notes: input.promptingPracticesNotes,
    evidence_locator: input.evidenceLocator.trim(),
    review_status: input.reviewStatus,
    second_review_reason: input.secondReviewReason,
    reviewer: input.reviewer,
    review_date: input.reviewDate
  };

  await writeCsvTableAtomic(pathname, columns, rows);
  return rowToScreening(rows[index]);
}

function screeningPath(config: AppConfig): string {
  return path.join(config.reviewDataDir, screeningFilename);
}

function validateScreeningInput(input: ScreeningUpdateInput): void {
  if (!validDecisions.has(input.decision)) {
    throw new Error(`Unsupported screening decision: ${input.decision}`);
  }
  if (input.decision && input.eligibilityRationale.trim().length === 0) {
    throw new Error("Eligibility rationale is required for a screening decision");
  }
  if (input.decision && input.evidenceLocator.trim().length === 0) {
    throw new Error("Evidence locator is required for a screening decision");
  }
}

function ensureColumns(columns: string[]): void {
  const missing = requiredColumns.filter((column) => !columns.includes(column));
  if (missing.length > 0) {
    throw new Error(`Screening CSV missing required columns: ${missing.join(", ")}`);
  }
}

function rowToScreening(row: Record<string, string>): ScreeningRow {
  return {
    recordId: row.record_id ?? "",
    decision: normalizeDecision(row.decision),
    primaryExclusionReason: row.primary_exclusion_reason ?? "",
    eligibilityRationale: row.eligibility_rationale ?? "",
    typologyRelevanceNotes: row.typology_relevance_notes ?? "",
    evaluationRelevanceNotes: row.evaluation_relevance_notes ?? "",
    promptingPracticesNotes: row.prompting_practices_notes ?? "",
    evidenceLocator: row.evidence_locator ?? "",
    reviewStatus: row.review_status ?? "",
    secondReviewReason: row.second_review_reason ?? "",
    reviewer: row.reviewer ?? "",
    reviewDate: row.review_date ?? ""
  };
}

function normalizeDecision(value: string | undefined): ScreeningDecision {
  const decision = (value ?? "") as ScreeningDecision;
  return validDecisions.has(decision) ? decision : "";
}
