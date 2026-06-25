import type { AppConfig, ExtractionArtifact, ExtractionArtifactInput } from "@/lib/types";
import { openReaderDb } from "@/lib/server/sqliteStore";

export function readExtractionArtifact(config: AppConfig, recordId: string): ExtractionArtifact {
  const db = openReaderDb(config.readerDbPath);
  const row = db
    .prepare("SELECT * FROM extraction_artifacts WHERE record_id = ?")
    .get(recordId);
  db.close();

  if (!row) return emptyExtractionArtifact(recordId);
  return rowToExtraction(row);
}

export function saveExtractionArtifact(
  config: AppConfig,
  recordId: string,
  input: ExtractionArtifactInput
): ExtractionArtifact {
  if (!recordId.trim()) throw new Error("recordId is required");

  const artifact: ExtractionArtifact = {
    recordId,
    methodTypology: input.methodTypology,
    promptingPractices: input.promptingPractices,
    evaluationPractices: input.evaluationPractices,
    synthesisNote: input.synthesisNote,
    evidenceLocator: input.evidenceLocator.trim(),
    updatedAt: new Date().toISOString()
  };

  const db = openReaderDb(config.readerDbPath);
  db.prepare(
    `INSERT INTO extraction_artifacts
      (record_id, method_typology, prompting_practices, evaluation_practices, synthesis_note, evidence_locator, updated_at)
     VALUES
      (@recordId, @methodTypology, @promptingPractices, @evaluationPractices, @synthesisNote, @evidenceLocator, @updatedAt)
     ON CONFLICT(record_id) DO UPDATE SET
      method_typology = excluded.method_typology,
      prompting_practices = excluded.prompting_practices,
      evaluation_practices = excluded.evaluation_practices,
      synthesis_note = excluded.synthesis_note,
      evidence_locator = excluded.evidence_locator,
      updated_at = excluded.updated_at`
  ).run(artifact);
  db.close();

  return artifact;
}

function emptyExtractionArtifact(recordId: string): ExtractionArtifact {
  return {
    recordId,
    methodTypology: "",
    promptingPractices: "",
    evaluationPractices: "",
    synthesisNote: "",
    evidenceLocator: "",
    updatedAt: ""
  };
}

function rowToExtraction(row: unknown): ExtractionArtifact {
  const record = row as {
    record_id: string;
    method_typology: string;
    prompting_practices: string;
    evaluation_practices: string;
    synthesis_note: string;
    evidence_locator: string;
    updated_at: string;
  };

  return {
    recordId: record.record_id,
    methodTypology: record.method_typology,
    promptingPractices: record.prompting_practices,
    evaluationPractices: record.evaluation_practices,
    synthesisNote: record.synthesis_note,
    evidenceLocator: record.evidence_locator,
    updatedAt: record.updated_at
  };
}
