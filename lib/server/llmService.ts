import type {
  AppConfig,
  PayloadScope,
  RuntimeModelSettings,
  ScopedAskAnswer,
  ScopedAskInput
} from "@/lib/types";
import { searchKnowledgeBase } from "@/lib/server/knowledgeBase";
import { resolveOnlineApiKey } from "@/lib/server/onlineCredentials";
import { getPaperByRecordId, readMarkdownForPaper, readPdfTextForPaper } from "@/lib/server/sourceRegistry";

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
  if (input.payloadScope !== "Corpus retrieval" && input.evidence.length === 0) {
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
      ? searchKnowledgeBase(config, input.question, {
          topK: 6,
          knowledgeBaseId: input.knowledgeBaseId
        })
      : [];
  if (input.payloadScope === "Corpus retrieval" && retrievedChunks.length === 0) {
    throw new Error("No corpus retrieval results are available for this question");
  }
  const evidenceUsed = [
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
    retrievedChunks
  );
  return {
    recordId: input.recordId,
    payloadScope: input.payloadScope,
    answer: providerAnswer,
    evidenceUsed,
    warnings: ["Provider response used scoped evidence only."]
  };
}

async function callOpenAiCompatibleScopedAsk(
  config: AppConfig,
  input: ScopedAskInput,
  fetchImpl: typeof fetch,
  manualOnlineApiKey?: string,
  retrievedChunks: ReturnType<typeof searchKnowledgeBase> = []
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
          content: serializeScopedAskInput(input, retrievedChunks)
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
  retrievedChunks: ReturnType<typeof searchKnowledgeBase> = []
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
    "evidence_packets:",
    evidenceLines || "(none)",
    "retrieved_corpus_chunks:",
    corpusLines || "(none)"
  ].join("\n");
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
