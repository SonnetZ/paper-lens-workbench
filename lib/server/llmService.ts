import type {
  AppConfig,
  CorpusSynthesisAnswer,
  CorpusSynthesisInput,
  PayloadScope,
  ReviewLayerKnowledgeChunk,
  RuntimeModelSettings,
  ScopedAskAnswer,
  ScopedAskInput
} from "@/lib/types";
import {
  defaultKnowledgeBaseId,
  listReviewLayerKnowledge,
  searchKnowledgeBase
} from "@/lib/server/knowledgeBase";
import { resolveOnlineApiKey } from "@/lib/server/onlineCredentials";
import { getPaperByRecordId, readMarkdownForPaper, readPdfTextForPaper } from "@/lib/server/sourceRegistry";

type RetrievedChunk = Awaited<ReturnType<typeof searchKnowledgeBase>>[number];

export function createMockBrief(recordId: string) {
  return {
    recordId,
    eligibility_suggestion: "maybe",
    rationale: "Mock mode does not evaluate the full paper. Use this only to verify UI flow.",
    read_first: ["Abstract", "Methods", "Evaluation", "Prompting"],
    d1_d3_signals: [],
    prompting_practices: [],
    d4_signals: [],
    candidate_form_fields: {},
    warnings: ["Mock response. No paper text was sent to a model."]
  };
}

export function assertAllowedBriefRequest(config: AppConfig, payloadScope: PayloadScope | null) {
  if (config.llmMode === "mock") return;
  if (!payloadScope) {
    throw new Error("Payload scope is required for local or online model calls");
  }
  if (payloadScope === "Full paper") {
    throw new Error("Full-paper model calls are not enabled for brief generation");
  }
}

export async function generateBrief(
  config: AppConfig,
  input: {
    recordId: string;
    payloadScope: PayloadScope;
    modelSettings?: RuntimeModelSettings;
  },
  fetchImpl: typeof fetch = fetch
) {
  const runtime = resolveRuntimeModelConfig(config, input.modelSettings);
  assertAllowedBriefRequest(runtime.config, input.payloadScope);
  if (runtime.config.llmMode === "mock") return createMockBrief(input.recordId);

  const paper = await getPaperByRecordId(config, input.recordId);
  if (!paper) throw new Error(`Paper not found: ${input.recordId}`);
  const source = paper.hasPdf
    ? await readPdfTextForPaper(config, input.recordId)
    : await readMarkdownForPaper(config, input.recordId);
  if (!source?.content.trim()) throw new Error("Paper text is not available for brief generation");

  const content = source.content.slice(0, Math.max(1000, runtime.config.llmMaxInputChars));
  const response = await fetchImpl(`${providerBaseUrl(runtime.config).replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: providerHeaders(runtime.config, runtime.manualOnlineApiKey),
    body: JSON.stringify({
      model: providerModel(runtime.config),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You help reviewers triage papers for a scoping review. Return compact JSON only."
        },
        {
          role: "user",
          content: [
            `record_id: ${paper.recordId}`,
            `title: ${paper.title}`,
            `payload_scope: ${input.payloadScope}`,
            "Return JSON with eligibility_suggestion, rationale, read_first, warnings.",
            "Focus on whether the paper uses/evaluates LLM or generative AI in qualitative research methods.",
            "paper_text:",
            content
          ].join("\n")
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Brief provider request failed: HTTP ${response.status}`);
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const contentJson = json.choices?.[0]?.message?.content?.trim();
  if (!contentJson) throw new Error("Brief provider returned an empty response");
  return parseBriefJson(input.recordId, contentJson);
}

export function assertAllowedAskRequest(config: AppConfig, input: ScopedAskInput) {
  if (!input.question.trim()) {
    throw new Error("Question is required");
  }
  if (input.payloadScope === "Full paper") {
    throw new Error("Full-paper model calls are not enabled for scoped Ask");
  }
  if (
    input.payloadScope !== "Corpus retrieval" &&
    input.payloadScope !== "Current full text" &&
    input.evidence.length === 0
  ) {
    throw new Error("At least one evidence packet is required for scoped Ask");
  }
  if (config.llmMode !== "mock" && !input.payloadScope) {
    throw new Error("Payload scope is required for local or online model calls");
  }
}

export async function answerScopedAsk(
  config: AppConfig,
  input: ScopedAskInput,
  fetchImpl: typeof fetch = fetch
): Promise<ScopedAskAnswer> {
  const runtime = resolveRuntimeModelConfig(config, input.modelSettings);
  assertAllowedAskRequest(runtime.config, input);
  const retrievedChunks =
    input.payloadScope === "Corpus retrieval"
      ? await searchKnowledgeBase(config, input.question, {
          topK: 6,
          knowledgeBaseId: input.knowledgeBaseId
        })
      : [];
  if (input.payloadScope === "Corpus retrieval" && retrievedChunks.length === 0) {
    throw new Error("No corpus retrieval results are available for this question");
  }
  const currentFullText =
    input.payloadScope === "Current full text"
      ? await readCurrentPaperText(config, input.recordId, runtime.config.llmMaxInputChars)
      : null;
  const evidenceUsed = currentFullText
    ? [`${input.recordId} / Current full text`]
    : [
    ...input.evidence.map((item) => item.evidenceLocator),
    ...retrievedChunks.map((item) =>
      [item.recordId, item.headingPath || item.sourceId].filter(Boolean).join(" / ")
    )
  ];

  if (runtime.config.llmMode === "mock") {
    return {
      recordId: input.recordId,
      payloadScope: input.payloadScope,
      answer: [
        "Mock scoped answer.",
        "Use the cited evidence packets to decide whether this claim belongs in screening or extraction.",
        `Question: ${input.question.trim()}`
      ].join(" "),
      evidenceUsed,
      warnings: ["Mock response. No full paper text was sent to a model."]
    };
  }

  const providerAnswer = await callOpenAiCompatibleScopedAsk(
    runtime.config,
    input,
    fetchImpl,
    runtime.manualOnlineApiKey,
    retrievedChunks,
    currentFullText?.content
  );
  return {
    recordId: input.recordId,
    payloadScope: input.payloadScope,
    answer: providerAnswer,
    evidenceUsed,
    warnings: [
      currentFullText
        ? "Provider response used current paper full text."
        : "Provider response used scoped evidence only.",
      ...(currentFullText?.truncated
        ? ["Current paper text was truncated to fit the configured model input limit."]
        : [])
    ]
  };
}

export async function answerCorpusSynthesis(
  config: AppConfig,
  input: CorpusSynthesisInput,
  fetchImpl: typeof fetch = fetch
): Promise<CorpusSynthesisAnswer> {
  const question = input.question.trim();
  if (!question) throw new Error("Question is required");
  const runtime = resolveRuntimeModelConfig(config, input.modelSettings);
  const knowledgeBaseId = input.knowledgeBaseId?.trim() || defaultKnowledgeBaseId;
  const chunks = listReviewLayerKnowledge(config, knowledgeBaseId);
  if (chunks.length === 0) {
    throw new Error(
      "No review-layer artifacts or evidence are indexed. Use Add artifacts or Add included outputs first."
    );
  }

  if (runtime.config.llmMode === "mock") {
    return {
      question,
      knowledgeBaseId,
      answer: [
        "Mock corpus synthesis.",
        "This uses indexed extraction artifacts and evidence packets, not raw full papers.",
        `Question: ${question}`
      ].join(" "),
      evidenceUsed: chunks.map((chunk) => chunkLocator(chunk)),
      warnings: ["Mock response. No review-layer knowledge was sent to a model."]
    };
  }

  const { context, includedChunks, truncated } = serializeReviewLayerContext(
    chunks,
    runtime.config.llmMaxInputChars
  );
  const providerAnswer = await callOpenAiCompatibleCorpusSynthesis(
    runtime.config,
    question,
    knowledgeBaseId,
    context,
    fetchImpl,
    runtime.manualOnlineApiKey
  );
  return {
    question,
    knowledgeBaseId,
    answer: providerAnswer,
    evidenceUsed: includedChunks.map((chunk) => chunkLocator(chunk)),
    warnings: [
      "Provider response used review-layer knowledge only.",
      ...(truncated ? ["Review-layer context was truncated to fit the configured model input limit."] : [])
    ]
  };
}

async function callOpenAiCompatibleScopedAsk(
  config: AppConfig,
  input: ScopedAskInput,
  fetchImpl: typeof fetch,
  manualOnlineApiKey?: string,
  retrievedChunks: RetrievedChunk[] = [],
  currentFullText = ""
): Promise<string> {
  const baseUrl = providerBaseUrl(config);
  const model = providerModel(config);
  if (!baseUrl) throw new Error("Model provider base URL is not configured");
  if (!model) throw new Error("Model name is not configured");

  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: providerHeaders(config, manualOnlineApiKey),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You support evidence-based paper reading, screening, extraction, and review synthesis. Answer only from the supplied evidence packets. If evidence is insufficient, say so."
        },
        {
          role: "user",
          content: serializeScopedAskInput(input, retrievedChunks, currentFullText)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Scoped Ask provider request failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Scoped Ask provider returned an empty answer");
  return content;
}

async function callOpenAiCompatibleCorpusSynthesis(
  config: AppConfig,
  question: string,
  knowledgeBaseId: string,
  reviewLayerContext: string,
  fetchImpl: typeof fetch,
  manualOnlineApiKey?: string
): Promise<string> {
  const baseUrl = providerBaseUrl(config);
  const model = providerModel(config);
  if (!baseUrl) throw new Error("Model provider base URL is not configured");
  if (!model) throw new Error("Model name is not configured");

  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: providerHeaders(config, manualOnlineApiKey),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You synthesize evidence for a scoping review. Use only the supplied review-layer context: extraction artifacts and evidence packets. Preserve record IDs and locators. If the context is insufficient, say so."
        },
        {
          role: "user",
          content: [
            `knowledge_base_id: ${knowledgeBaseId}`,
            `question: ${question}`,
            "review_layer_context:",
            reviewLayerContext
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Corpus synthesis provider request failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Corpus synthesis provider returned an empty answer");
  return content;
}

export function resolveRuntimeModelConfig(
  config: AppConfig,
  settings?: RuntimeModelSettings
): { config: AppConfig; manualOnlineApiKey?: string } {
  if (!settings) return { config };
  if (settings.mode === "mock") {
    return {
      config: {
        ...config,
        llmMode: "mock"
      }
    };
  }
  if (settings.mode === "local") {
    return {
      config: {
        ...config,
        llmMode: "local",
        localLlmBaseUrl: settings.localBaseUrl.trim(),
        localLlmModel: settings.localModel.trim()
      }
    };
  }

  return {
    config: {
      ...config,
      llmMode: "online",
      onlineLlmBaseUrl: settings.onlineBaseUrl.trim(),
      onlineLlmModel: settings.onlineModel.trim(),
      onlineConfigSource: settings.onlineConfigSource
    },
    manualOnlineApiKey:
      settings.onlineConfigSource === "manual" ? settings.onlineApiKey.trim() : undefined
  };
}

export function providerBaseUrl(config: AppConfig): string {
  return config.llmMode === "online" ? config.onlineLlmBaseUrl : config.localLlmBaseUrl;
}

export function providerModel(config: AppConfig): string {
  return config.llmMode === "online" ? config.onlineLlmModel : config.localLlmModel;
}

export function providerHeaders(config: AppConfig, manualOnlineApiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json"
  };
  const apiKey = resolveOnlineApiKey(config.onlineConfigSource, manualOnlineApiKey);
  if (config.llmMode === "online" && apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function serializeScopedAskInput(
  input: ScopedAskInput,
  retrievedChunks: RetrievedChunk[] = [],
  currentFullText = ""
): string {
  const evidenceLines = input.evidence
    .map((item, index) => {
      const text = item.quoteSnippet || item.reviewerNote;
      return [
        `Evidence ${index + 1}`,
        `locator: ${item.evidenceLocator}`,
        `format: ${item.sourceFormat}`,
        `text: ${text}`
      ].join("\n");
    })
    .join("\n\n");
  const corpusLines = retrievedChunks
    .map((item, index) =>
      [
        `Chunk ${index + 1}`,
        `record_id: ${item.recordId}`,
        `source: ${item.sourceKind}`,
        `locator: ${item.headingPath || item.sourceId}`,
        `score: ${item.score}`,
        `text: ${item.text}`
      ].join("\n")
    )
    .join("\n\n");

  return [
    `record_id: ${input.recordId}`,
    `knowledge_base_id: ${input.knowledgeBaseId || "default"}`,
    `payload_scope: ${input.payloadScope}`,
    `question: ${input.question.trim()}`,
    "chat_history:",
    serializeChatHistory(input.chatHistory ?? []),
    "evidence_packets:",
    evidenceLines || "(none)",
    "retrieved_corpus_chunks:",
    corpusLines || "(none)",
    "current_full_text:",
    currentFullText || "(none)"
  ].join("\n");
}

function serializeChatHistory(history: ScopedAskInput["chatHistory"]): string {
  const turns = (history ?? []).slice(-8);
  if (turns.length === 0) return "(none)";
  return turns
    .map((turn) => `${turn.role}: ${turn.content.trim().slice(0, 4000)}`)
    .join("\n");
}

async function readCurrentPaperText(
  config: AppConfig,
  recordId: string,
  maxChars: number
): Promise<{ content: string; truncated: boolean }> {
  const paper = await getPaperByRecordId(config, recordId);
  if (!paper) throw new Error(`Paper not found: ${recordId}`);
  const source = paper.hasPdf
    ? await readPdfTextForPaper(config, recordId)
    : await readMarkdownForPaper(config, recordId);
  if (!source?.content.trim()) throw new Error("Paper text is not available for current full-text Ask");
  const limit = Math.max(1000, maxChars);
  return {
    content: source.content.slice(0, limit),
    truncated: source.content.length > limit
  };
}

function serializeReviewLayerContext(
  chunks: ReviewLayerKnowledgeChunk[],
  maxChars: number
): { context: string; includedChunks: ReviewLayerKnowledgeChunk[]; truncated: boolean } {
  const limit = Math.max(1000, maxChars);
  const lines: string[] = [];
  const includedChunks: ReviewLayerKnowledgeChunk[] = [];
  let currentRecordId = "";
  let truncated = false;

  for (const chunk of chunks) {
    const nextLines = [...lines];
    if (chunk.recordId !== currentRecordId) {
      nextLines.push(`\nrecord_id: ${chunk.recordId}`);
    }
    nextLines.push(
      [
        `source: ${chunk.sourceKind}`,
        `source_id: ${chunk.sourceId}`,
        `locator: ${chunk.headingPath || chunk.sourceId}`,
        `text: ${chunk.text}`
      ].join("\n")
    );
    if (nextLines.join("\n\n").length > limit) {
      truncated = true;
      break;
    }
    if (chunk.recordId !== currentRecordId) currentRecordId = chunk.recordId;
    lines.splice(0, lines.length, ...nextLines);
    includedChunks.push(chunk);
  }

  const context = lines.join("\n\n");
  return {
    context: context.length > limit ? context.slice(0, limit) : context,
    includedChunks,
    truncated
  };
}

function chunkLocator(chunk: ReviewLayerKnowledgeChunk): string {
  return [
    chunk.recordId,
    chunk.sourceKind,
    chunk.headingPath || chunk.sourceId
  ]
    .filter(Boolean)
    .join(" / ");
}

function parseBriefJson(recordId: string, value: string) {
  try {
    const parsed = JSON.parse(value) as {
      eligibility_suggestion?: unknown;
      rationale?: unknown;
      read_first?: unknown;
      warnings?: unknown;
    };
    return {
      recordId,
      eligibility_suggestion: String(parsed.eligibility_suggestion ?? "maybe"),
      rationale: String(parsed.rationale ?? ""),
      read_first: Array.isArray(parsed.read_first) ? parsed.read_first.map(String).slice(0, 6) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 6) : []
    };
  } catch {
    return {
      recordId,
      eligibility_suggestion: "maybe",
      rationale: value,
      read_first: [],
      warnings: ["Provider did not return JSON; showing raw response as rationale."]
    };
  }
}
