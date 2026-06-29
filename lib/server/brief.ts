import type {
  AppConfig,
  BriefArtifact,
  BriefArtifactInput,
  BriefModelSettings
} from "@/lib/types";
import { openReaderDb } from "@/lib/server/sqliteStore";

export function readBriefArtifact(
  config: AppConfig,
  reviewProjectId: string,
  recordId: string
): BriefArtifact | null {
  const db = openReaderDb(config.readerDbPath);
  const row = db
    .prepare(
      "SELECT * FROM brief_artifacts WHERE review_project_id = ? AND record_id = ?"
    )
    .get(reviewProjectId, recordId);
  db.close();

  if (!row) return null;
  return rowToBrief(row);
}

export function saveBriefArtifact(
  config: AppConfig,
  reviewProjectId: string,
  recordId: string,
  input: BriefArtifactInput
): BriefArtifact {
  if (!reviewProjectId.trim()) throw new Error("reviewProjectId is required");
  if (!recordId.trim()) throw new Error("recordId is required");

  const artifact: BriefArtifact = {
    reviewProjectId: reviewProjectId.trim(),
    recordId: recordId.trim(),
    eligibilitySuggestion: input.eligibilitySuggestion.trim(),
    rationale: input.rationale.trim(),
    readFirst: input.readFirst.map((item) => item.trim()).filter(Boolean),
    warnings: input.warnings.map((item) => item.trim()).filter(Boolean),
    payloadScope: input.payloadScope,
    modelSettings: input.modelSettings,
    updatedAt: new Date().toISOString()
  };

  const db = openReaderDb(config.readerDbPath);
  db.prepare(
    `INSERT INTO brief_artifacts
      (review_project_id, record_id, eligibility_suggestion, rationale, read_first_json, warnings_json, payload_scope, model_settings_json, updated_at)
     VALUES
      (@reviewProjectId, @recordId, @eligibilitySuggestion, @rationale, @readFirstJson, @warningsJson, @payloadScope, @modelSettingsJson, @updatedAt)
     ON CONFLICT(review_project_id, record_id) DO UPDATE SET
      eligibility_suggestion = excluded.eligibility_suggestion,
      rationale = excluded.rationale,
      read_first_json = excluded.read_first_json,
      warnings_json = excluded.warnings_json,
      payload_scope = excluded.payload_scope,
      model_settings_json = excluded.model_settings_json,
      updated_at = excluded.updated_at`
  ).run({
    ...artifact,
    readFirstJson: JSON.stringify(artifact.readFirst),
    warningsJson: JSON.stringify(artifact.warnings),
    modelSettingsJson: JSON.stringify(artifact.modelSettings ?? null)
  });
  db.close();

  return artifact;
}

function rowToBrief(row: unknown): BriefArtifact {
  const record = row as {
    review_project_id: string;
    record_id: string;
    eligibility_suggestion: string;
    rationale: string;
    read_first_json: string;
    warnings_json: string;
    payload_scope: BriefArtifactInput["payloadScope"];
    model_settings_json: string | null;
    updated_at: string;
  };

  return {
    reviewProjectId: record.review_project_id,
    recordId: record.record_id,
    eligibilitySuggestion: record.eligibility_suggestion,
    rationale: record.rationale,
    readFirst: parseStringArray(record.read_first_json),
    warnings: parseStringArray(record.warnings_json),
    payloadScope: record.payload_scope,
    modelSettings: parseModelSettings(record.model_settings_json),
    updatedAt: record.updated_at
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseModelSettings(value: string | null): BriefArtifactInput["modelSettings"] {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as BriefModelSettings;
  } catch {
    return undefined;
  }
}
