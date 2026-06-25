import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, EvidencePacket, ExtractionArtifact, PaperListItem, ScreeningRow } from "@/lib/types";
import { listEvidencePackets } from "@/lib/server/evidence";
import { readExtractionArtifact } from "@/lib/server/extraction";
import { readScreeningRow } from "@/lib/server/screening";
import { getPaperByRecordId } from "@/lib/server/sourceRegistry";

export interface ReviewMaterialExport {
  recordId: string;
  format: "markdown";
  path: string;
  content: string;
  evidenceCount: number;
}

export async function exportReviewMaterial(
  config: AppConfig,
  recordId: string
): Promise<ReviewMaterialExport> {
  if (!recordId.trim()) throw new Error("recordId is required");

  const paper = await getPaperByRecordId(config, recordId);
  if (!paper) throw new Error(`Paper not found: ${recordId}`);

  const screening = await readScreeningRow(config, recordId);
  const extraction = readExtractionArtifact(config, recordId);
  const evidence = listEvidencePackets(config, recordId).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const content = renderReviewMaterial({ paper, screening, extraction, evidence });
  const exportDir = path.join(config.readerExportDir, "review-materials");
  await mkdir(exportDir, { recursive: true });
  const outputPath = path.join(exportDir, `${safeFileStem(recordId)}_review_material.md`);
  await writeFile(outputPath, content, "utf-8");

  return {
    recordId,
    format: "markdown",
    path: outputPath,
    content,
    evidenceCount: evidence.length
  };
}

function renderReviewMaterial({
  paper,
  screening,
  extraction,
  evidence
}: {
  paper: PaperListItem;
  screening: ScreeningRow | null;
  extraction: ExtractionArtifact;
  evidence: EvidencePacket[];
}): string {
  return [
    `# ${paper.recordId} - ${paper.title || "Untitled paper"}`,
    "",
    "## Paper Metadata",
    field("First author", paper.firstAuthor),
    field("Year", paper.year),
    field("Source filename", paper.sourceFilename),
    field("Source path", paper.sourcePath),
    "",
    "## Full-Text Screening",
    field("Decision", screening?.decision),
    field("Review status", screening?.reviewStatus),
    field("Primary exclusion reason", screening?.primaryExclusionReason),
    field("Eligibility rationale", screening?.eligibilityRationale),
    field("Typology relevance notes", screening?.typologyRelevanceNotes),
    field("Evaluation relevance notes", screening?.evaluationRelevanceNotes),
    field("Prompting practices notes", screening?.promptingPracticesNotes),
    field("Evidence locator", screening?.evidenceLocator),
    field("Reviewer", screening?.reviewer),
    field("Review date", screening?.reviewDate),
    "",
    "## Extraction Notes",
    field("Method typology", extraction.methodTypology),
    field("Prompting practices", extraction.promptingPractices),
    field("Evaluation practices", extraction.evaluationPractices),
    field("Synthesis note", extraction.synthesisNote),
    field("Evidence locator", extraction.evidenceLocator),
    field("Updated at", extraction.updatedAt),
    "",
    "## Evidence Chain",
    evidence.length === 0
      ? "No evidence packets have been saved for this paper."
      : evidence.map(renderEvidencePacket).join("\n\n")
  ].join("\n");
}

function renderEvidencePacket(evidence: EvidencePacket, index: number): string {
  const quote = evidence.quoteSnippet.trim();
  const note = evidence.reviewerNote.trim();
  const pdfVerificationNote = evidence.pdfVerificationNote.trim();
  return [
    `### Evidence ${index + 1}`,
    field("Locator", evidence.evidenceLocator),
    field("Source format", evidence.sourceFormat),
    field("Source path", evidence.sourcePath),
    field("Heading path", evidence.headingPath),
    field("Page", evidence.pageNumber === null ? "" : String(evidence.pageNumber)),
    field("PDF verification note", pdfVerificationNote),
    field("Created at", evidence.createdAt),
    quote ? blockquote(quote) : "",
    note ? `Reviewer note: ${note}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function field(label: string, value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return `- ${label}: ${text || "Not recorded"}`;
}

function blockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function safeFileStem(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "review_material";
}
