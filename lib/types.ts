export type ModelSource = "local" | "online";
export type InternalLlmMode = "mock" | ModelSource;
export type TranslationProvider = "opus" | ModelSource;
export type PayloadScope = "Selection" | "Paper sections" | "Full paper" | "Corpus retrieval";

export interface AppConfig {
  llmMode: InternalLlmMode;
  reviewDataDir: string;
  paperPdfDir: string;
  paperMdDir: string;
  readerDbPath: string;
  readerExportDir: string;
  localLlmBaseUrl: string;
  localLlmModel: string;
  onlineLlmBaseUrl: string;
  onlineLlmModel: string;
  onlineConfigSource: "manual" | "env" | "cc_switch";
  translationOpusBaseUrl?: string;
  llmMaxInputChars: number;
}

export interface CorpusPathConfig {
  reviewDataDir: string;
  paperMdDir: string;
  paperPdfDir: string;
}

export interface CorpusValidationSummary {
  screeningCsv: boolean;
  controlledVocabularies: boolean;
  markdownFileCount: number;
  pdfFileCount: number;
  screeningRowCount: number;
  addedScreeningRowCount: number;
}

export interface CorpusValidationResult {
  ok: boolean;
  issues: string[];
  summary: CorpusValidationSummary;
}

export interface RuntimeModelSettings {
  mode: InternalLlmMode;
  localBaseUrl: string;
  localModel: string;
  onlineBaseUrl: string;
  onlineModel: string;
  onlineConfigSource: AppConfig["onlineConfigSource"];
  onlineApiKey: string;
}

export interface PaperRecord {
  recordId: string;
  title: string;
  firstAuthor: string;
  year: string;
  sourceFilename: string;
  sourcePath: string;
  decision: string;
  reviewStatus: string;
}

export interface SourceAvailability {
  hasMarkdown: boolean;
  hasPdf: boolean;
  markdownPath: string | null;
  pdfPath: string | null;
}

export interface PaperListItem extends PaperRecord, SourceAvailability {
  methodItemCount: number;
  promptItemCount: number;
  evaluationItemCount: number;
}

export interface EvidencePacket {
  id: string;
  reviewProjectId: string;
  recordId: string;
  sourceFormat: "markdown" | "pdf" | "manual";
  sourcePath: string | null;
  evidenceLocator: string;
  quoteSnippet: string;
  headingPath: string | null;
  pageNumber: number | null;
  reviewerNote: string;
  pdfVerificationNote: string;
  createdAt: string;
}

export type EvidenceInput = Omit<EvidencePacket, "id" | "createdAt" | "reviewProjectId"> & {
  reviewProjectId?: string;
};

export type ReviewFieldTarget =
  | "screening.eligibilityRationale"
  | "screening.typologyRelevanceNotes"
  | "screening.evaluationRelevanceNotes"
  | "screening.promptingPracticesNotes"
  | "extraction.methodTypology"
  | "extraction.promptingPractices"
  | "extraction.evaluationPractices"
  | "extraction.synthesisNote";

export interface EvidenceRouteInput {
  evidence: EvidencePacket;
  target: ReviewFieldTarget;
}

export interface EvidenceRouteEvent extends EvidenceRouteInput {
  routeId: number;
}

export type ScreeningDecision = "" | "include" | "exclude" | "maybe";

export interface ScreeningUpdateInput {
  decision: ScreeningDecision;
  primaryExclusionReason: string;
  eligibilityRationale: string;
  typologyRelevanceNotes: string;
  evaluationRelevanceNotes: string;
  promptingPracticesNotes: string;
  evidenceLocator: string;
  reviewStatus: string;
  secondReviewReason: string;
  reviewer: string;
  reviewDate: string;
}

export interface ScreeningRow extends ScreeningUpdateInput {
  recordId: string;
}

export interface ExtractionArtifactInput {
  methodTypology: string;
  promptingPractices: string;
  evaluationPractices: string;
  synthesisNote: string;
  evidenceLocator: string;
}

export interface ExtractionArtifact extends ExtractionArtifactInput {
  recordId: string;
  updatedAt: string;
}

export interface BriefArtifactInput {
  eligibilitySuggestion: string;
  rationale: string;
  readFirst: string[];
  warnings: string[];
  payloadScope: PayloadScope;
  modelSettings?: BriefModelSettings;
}

export interface BriefArtifact extends BriefArtifactInput {
  recordId: string;
  reviewProjectId: string;
  updatedAt: string;
}

export type BriefModelSettings = Omit<RuntimeModelSettings, "onlineApiKey">;

export interface ScopedAskInput {
  recordId: string;
  question: string;
  payloadScope: PayloadScope;
  evidence: EvidencePacket[];
  knowledgeBaseId?: string;
  modelSettings?: RuntimeModelSettings;
}

export interface ScopedAskAnswer {
  recordId: string;
  payloadScope: PayloadScope;
  answer: string;
  evidenceUsed: string[];
  warnings: string[];
}

export interface KnowledgeBaseStatus {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  documentCount: number;
  chunkCount: number;
  paperDocumentCount: number;
  pdfDocumentCount: number;
  markdownDocumentCount: number;
  artifactDocumentCount: number;
  evidenceDocumentCount: number;
  embeddingModel: string;
  updatedAt: string | null;
}

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  documentCount: number;
  chunkCount: number;
  updatedAt: string | null;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  recordId: string;
  sourceKind: "paper" | "pdf" | "artifact" | "evidence";
  sourceId: string;
  headingPath: string;
  text: string;
  score: number;
}
