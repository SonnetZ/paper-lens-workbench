import crypto from "node:crypto";
import type { AppConfig, EvidenceInput, EvidencePacket } from "@/lib/types";
import { openReaderDb } from "@/lib/server/sqliteStore";

function validate(input: EvidenceInput) {
  if (!input.recordId.trim()) throw new Error("recordId is required");
  if (!input.evidenceLocator.trim()) throw new Error("evidenceLocator is required");
  if (!input.quoteSnippet.trim() && !input.reviewerNote.trim()) {
    throw new Error("quoteSnippet or reviewerNote is required");
  }
}

export function saveEvidencePacket(config: AppConfig, input: EvidenceInput): EvidencePacket {
  validate(input);
  const packet: EvidencePacket = {
    id: `ev_${crypto.randomUUID()}`,
    recordId: input.recordId,
    sourceFormat: input.sourceFormat,
    sourcePath: input.sourcePath,
    evidenceLocator: input.evidenceLocator,
    quoteSnippet: input.quoteSnippet,
    headingPath: input.headingPath,
    pageNumber: input.pageNumber,
    reviewerNote: input.reviewerNote,
    pdfVerificationNote: input.pdfVerificationNote?.trim() ?? "",
    createdAt: new Date().toISOString()
  };

  const db = openReaderDb(config.readerDbPath);
  db.prepare(
    `INSERT INTO evidence_packets
      (id, record_id, source_format, source_path, evidence_locator, quote_snippet, heading_path, page_number, reviewer_note, pdf_verification_note, created_at)
     VALUES
      (@id, @recordId, @sourceFormat, @sourcePath, @evidenceLocator, @quoteSnippet, @headingPath, @pageNumber, @reviewerNote, @pdfVerificationNote, @createdAt)`
  ).run(packet);
  db.close();
  return packet;
}

export function listEvidencePackets(config: AppConfig, recordId?: string): EvidencePacket[] {
  const db = openReaderDb(config.readerDbPath);
  const rows = recordId
    ? db.prepare("SELECT * FROM evidence_packets WHERE record_id = ? ORDER BY created_at DESC").all(recordId)
    : db.prepare("SELECT * FROM evidence_packets ORDER BY created_at DESC").all();
  db.close();

  return rows.map((row) => {
    const record = row as {
      id: string;
      record_id: string;
      source_format: EvidencePacket["sourceFormat"];
      source_path: string | null;
      evidence_locator: string;
      quote_snippet: string;
      heading_path: string | null;
      page_number: number | null;
      reviewer_note: string;
      pdf_verification_note: string | null;
      created_at: string;
    };

    return {
      id: record.id,
      recordId: record.record_id,
      sourceFormat: record.source_format,
      sourcePath: record.source_path,
      evidenceLocator: record.evidence_locator,
      quoteSnippet: record.quote_snippet,
      headingPath: record.heading_path,
      pageNumber: record.page_number,
      reviewerNote: record.reviewer_note,
      pdfVerificationNote: record.pdf_verification_note ?? "",
      createdAt: record.created_at
    };
  });
}

export function updateEvidencePdfVerificationNote(
  config: AppConfig,
  evidenceId: string,
  pdfVerificationNote: string
): EvidencePacket {
  const id = evidenceId.trim();
  if (!id) throw new Error("evidenceId is required");

  const db = openReaderDb(config.readerDbPath);
  const result = db
    .prepare(
      "UPDATE evidence_packets SET pdf_verification_note = ? WHERE id = ?"
    )
    .run(pdfVerificationNote.trim(), id);

  if (result.changes === 0) {
    db.close();
    throw new Error(`Evidence packet not found: ${id}`);
  }

  const row = db.prepare("SELECT record_id FROM evidence_packets WHERE id = ?").get(id) as
    | { record_id: string }
    | undefined;
  db.close();

  const updated = listEvidencePackets(config, row?.record_id).find((packet) => packet.id === id);
  if (!updated) throw new Error(`Evidence packet not found: ${id}`);
  return updated;
}

export function deleteEvidencePacket(config: AppConfig, evidenceId: string): string {
  const id = evidenceId.trim();
  if (!id) throw new Error("evidenceId is required");

  const db = openReaderDb(config.readerDbPath);
  const result = db.prepare("DELETE FROM evidence_packets WHERE id = ?").run(id);
  db.close();
  if (result.changes === 0) throw new Error(`Evidence packet not found: ${id}`);
  return id;
}
