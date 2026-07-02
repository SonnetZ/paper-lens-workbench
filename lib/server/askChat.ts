import crypto from "node:crypto";
import type { AppConfig, AskChatMessage, AskChatRole, PayloadScope } from "@/lib/types";
import { openReaderDb } from "@/lib/server/sqliteStore";

interface AskChatMessageInput {
  reviewProjectId: string;
  recordId: string;
  payloadScope: PayloadScope;
  role: AskChatRole;
  content: string;
  evidenceUsed: string[];
  warnings: string[];
}

export function listAskChatMessages(
  config: AppConfig,
  reviewProjectId: string,
  recordId: string,
  payloadScope: PayloadScope
): AskChatMessage[] {
  const db = openReaderDb(config.readerDbPath);
  const rows = db
    .prepare(
      `SELECT *
       FROM ask_chat_messages
       WHERE review_project_id = ? AND record_id = ? AND payload_scope = ?
       ORDER BY created_at ASC, rowid ASC`
    )
    .all(projectId(reviewProjectId), recordId.trim(), payloadScope);
  db.close();
  return rows.map(rowToAskChatMessage);
}

export function saveAskChatMessage(
  config: AppConfig,
  input: AskChatMessageInput
): AskChatMessage {
  const message: AskChatMessage = {
    id: `ask_${crypto.randomUUID()}`,
    reviewProjectId: projectId(input.reviewProjectId),
    recordId: input.recordId.trim(),
    payloadScope: input.payloadScope,
    role: input.role,
    content: input.content.trim(),
    evidenceUsed: cleanStringArray(input.evidenceUsed),
    warnings: cleanStringArray(input.warnings),
    createdAt: new Date().toISOString()
  };
  if (!message.recordId) throw new Error("recordId is required");
  if (!message.content) throw new Error("content is required");

  const db = openReaderDb(config.readerDbPath);
  db.prepare(
    `INSERT INTO ask_chat_messages
      (id, review_project_id, record_id, payload_scope, role, content, evidence_used_json, warnings_json, created_at)
     VALUES
      (@id, @reviewProjectId, @recordId, @payloadScope, @role, @content, @evidenceUsedJson, @warningsJson, @createdAt)`
  ).run({
    ...message,
    evidenceUsedJson: JSON.stringify(message.evidenceUsed),
    warningsJson: JSON.stringify(message.warnings)
  });
  db.close();
  return message;
}

export function clearAskChatMessages(
  config: AppConfig,
  reviewProjectId: string,
  recordId: string,
  payloadScope: PayloadScope
): void {
  const db = openReaderDb(config.readerDbPath);
  db.prepare(
    "DELETE FROM ask_chat_messages WHERE review_project_id = ? AND record_id = ? AND payload_scope = ?"
  ).run(projectId(reviewProjectId), recordId.trim(), payloadScope);
  db.close();
}

function rowToAskChatMessage(row: unknown): AskChatMessage {
  const record = row as {
    id: string;
    review_project_id: string;
    record_id: string;
    payload_scope: PayloadScope;
    role: AskChatRole;
    content: string;
    evidence_used_json: string;
    warnings_json: string;
    created_at: string;
  };
  return {
    id: record.id,
    reviewProjectId: record.review_project_id,
    recordId: record.record_id,
    payloadScope: record.payload_scope,
    role: record.role,
    content: record.content,
    evidenceUsed: parseStringArray(record.evidence_used_json),
    warnings: parseStringArray(record.warnings_json),
    createdAt: record.created_at
  };
}

function projectId(value: string): string {
  return value.trim() || "default";
}

function cleanStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
