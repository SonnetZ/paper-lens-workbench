import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig, EvidencePacket } from "@/lib/types";
import {
  answerCorpusSynthesis,
  answerScopedAsk,
  assertAllowedAskRequest
} from "@/lib/server/llmService";
import {
  ingestPaperMarkdown,
  ingestReviewArtifacts
} from "@/lib/server/knowledgeBase";
import { saveEvidencePacket } from "@/lib/server/evidence";
import { saveExtractionArtifact } from "@/lib/server/extraction";

const mockConfig: AppConfig = {
  llmMode: "mock",
  reviewDataDir: "/tmp/review",
  paperMdDir: "/tmp/md",
  paperPdfDir: "/tmp/pdf",
  readerDbPath: "/tmp/reader.sqlite",
  readerExportDir: "/tmp/exports",
  localLlmBaseUrl: "http://localhost:8000/v1",
  localLlmModel: "",
  onlineLlmBaseUrl: "",
  onlineLlmModel: "",
  onlineConfigSource: "manual",
  llmMaxInputChars: 24000
};

const evidence: EvidencePacket[] = [
  {
    id: "ev_1",
    recordId: "FT0001",
    sourceFormat: "markdown",
    sourcePath: "/tmp/paper.md",
    evidenceLocator: "Methods > paragraph 2",
    quoteSnippet: "Human reviewers revised the codebook after LLM suggestions.",
    headingPath: "Methods",
    pageNumber: null,
    reviewerNote: "",
    pdfVerificationNote: "",
    createdAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "ev_2",
    recordId: "FT0001",
    sourceFormat: "manual",
    sourcePath: null,
    evidenceLocator: "Reviewer memo",
    quoteSnippet: "",
    headingPath: null,
    pageNumber: null,
    reviewerNote: "The study evaluates LLM-assisted qualitative coding.",
    pdfVerificationNote: "",
    createdAt: "2026-06-23T00:00:00.000Z"
  }
];

function mockChatCompletionFetch(content: string) {
  return vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
    Response.json({
      choices: [{ message: { content } }]
    })
  );
}

describe("scoped Ask service", () => {
  afterEach(() => {
    delete process.env.ONLINE_LLM_API_KEY;
    delete process.env.CODEX_HOME;
  });

  it("answers in mock mode using only supplied evidence packets", async () => {
    const answer = await answerScopedAsk(mockConfig, {
      recordId: "FT0001",
      question: "Does this paper evaluate LLM-assisted qualitative analysis?",
      payloadScope: "Selection",
      evidence
    });

    expect(answer.recordId).toBe("FT0001");
    expect(answer.payloadScope).toBe("Selection");
    expect(answer.answer).toContain("Mock scoped answer");
    expect(answer.evidenceUsed).toEqual(["Methods > paragraph 2", "Reviewer memo"]);
    expect(answer.warnings).toContain("Mock response. No full paper text was sent to a model.");
  });

  it("rejects full-paper ask requests", () => {
    expect(() =>
      assertAllowedAskRequest(
        { ...mockConfig, llmMode: "local" },
        {
          recordId: "FT0001",
          question: "Summarize the paper.",
          payloadScope: "Full paper",
          evidence
        }
      )
    ).toThrow("Full-paper model calls are not enabled");
  });

  it("requires evidence for selection-scoped ask requests", () => {
    expect(() =>
      assertAllowedAskRequest(mockConfig, {
        recordId: "FT0001",
        question: "Can this be included?",
        payloadScope: "Selection",
        evidence: []
      })
    ).toThrow("At least one evidence packet is required");
  });

  it("sends only scoped evidence to an OpenAI-compatible local provider", async () => {
    const fetchImpl = mockChatCompletionFetch("The supplied evidence supports inclusion.");

    const answer = await answerScopedAsk(
      {
        ...mockConfig,
        llmMode: "local",
        localLlmBaseUrl: "http://127.0.0.1:8017/v1",
        localLlmModel: "qwen-test"
      },
      {
        recordId: "FT0001",
        question: "Does this paper evaluate LLM-assisted qualitative analysis?",
        payloadScope: "Selection",
        evidence
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("http://127.0.0.1:8017/v1/chat/completions");
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(request.model).toBe("qwen-test");
    expect(JSON.stringify(request)).toContain("Methods > paragraph 2");
    expect(JSON.stringify(request)).toContain("Human reviewers revised the codebook");
    expect(JSON.stringify(request)).toContain("Reviewer memo");
    expect(JSON.stringify(request)).not.toContain("/tmp/paper.md");
    expect(JSON.stringify(request)).not.toContain("References");
    expect(answer.answer).toBe("The supplied evidence supports inclusion.");
    expect(answer.warnings).toContain("Provider response used scoped evidence only.");
  });

  it("uses an online provider key only in the authorization header", async () => {
    process.env.ONLINE_LLM_API_KEY = "test-secret";
    const fetchImpl = mockChatCompletionFetch("Online scoped answer.");

    await answerScopedAsk(
      {
        ...mockConfig,
        llmMode: "online",
        onlineLlmBaseUrl: "https://example.test/v1",
        onlineLlmModel: "online-test"
      },
      {
        recordId: "FT0001",
        question: "Does this paper evaluate LLM-assisted qualitative analysis?",
        payloadScope: "Selection",
        evidence
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl.mock.calls[0][0]).toBe("https://example.test/v1/chat/completions");
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer test-secret"
    });
    expect(String(fetchImpl.mock.calls[0][1]?.body)).not.toContain("test-secret");
  });

  it("uses a cc-switch managed Codex auth key only in the authorization header", async () => {
    const tempCodexHome = path.join(os.tmpdir(), `reader-codex-home-${Date.now()}`);
    mkdirSync(tempCodexHome, { recursive: true });
    writeFileSync(
      path.join(tempCodexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "cc-switch-secret" })
    );
    process.env.CODEX_HOME = tempCodexHome;
    const fetchImpl = mockChatCompletionFetch("CC switch scoped answer.");

    await answerScopedAsk(
      {
        ...mockConfig,
        llmMode: "online",
        onlineLlmBaseUrl: "https://example.test/v1",
        onlineLlmModel: "online-test",
        onlineConfigSource: "cc_switch"
      },
      {
        recordId: "FT0001",
        question: "Does this paper evaluate LLM-assisted qualitative analysis?",
        payloadScope: "Selection",
        evidence
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer cc-switch-secret"
    });
    expect(String(fetchImpl.mock.calls[0][1]?.body)).not.toContain("cc-switch-secret");
    rmSync(tempCodexHome, { recursive: true, force: true });
  });

  it("uses request-scoped local model settings without changing the base app config", async () => {
    const fetchImpl = mockChatCompletionFetch("Runtime local scoped answer.");

    const answer = await answerScopedAsk(
      mockConfig,
      {
        recordId: "FT0001",
        question: "Does this evidence support inclusion?",
        payloadScope: "Selection",
        evidence,
        modelSettings: {
          mode: "local",
          localBaseUrl: "http://localhost:8017/v1",
          localModel: "qwen-runtime",
          onlineBaseUrl: "",
          onlineModel: "",
          onlineConfigSource: "manual",
          onlineApiKey: ""
        }
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:8017/v1/chat/completions");
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      model: "qwen-runtime"
    });
    expect(answer.answer).toBe("Runtime local scoped answer.");
    expect(mockConfig.llmMode).toBe("mock");
  });

  it("includes previous chat turns in scoped Ask provider requests", async () => {
    const fetchImpl = mockChatCompletionFetch("Follow-up answer.");

    await answerScopedAsk(
      {
        ...mockConfig,
        llmMode: "local",
        localLlmBaseUrl: "http://localhost:8017/v1",
        localLlmModel: "qwen-runtime"
      },
      {
        recordId: "FT0001",
        question: "What should I check next?",
        payloadScope: "Selection",
        evidence,
        chatHistory: [
          {
            role: "user",
            content: "What is the evaluation design?"
          },
          {
            role: "assistant",
            content: "It compares LLM suggestions with human coding."
          }
        ]
      },
      fetchImpl as unknown as typeof fetch
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const prompt = JSON.stringify(request);
    expect(prompt).toContain("chat_history");
    expect(prompt).toContain("What is the evaluation design?");
    expect(prompt).toContain("It compares LLM suggestions with human coding.");
    expect(prompt).toContain("What should I check next?");
  });

  it("uses retrieved corpus chunks for corpus retrieval ask without requiring selected evidence", async () => {
    const root = path.join(os.tmpdir(), `reader-rag-ask-${Date.now()}`);
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "md");
    const paperPdfDir = path.join(root, "pdf");
    mkdirSync(reviewDataDir, { recursive: true });
    mkdirSync(paperMdDir, { recursive: true });
    mkdirSync(paperPdfDir, { recursive: true });
    writeFileSync(
      path.join(reviewDataDir, "full_text_screening.csv"),
      [
        "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
        "FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,,,,,,,,unreviewed,,,"
      ].join("\n")
    );
    writeFileSync(
      path.join(paperMdDir, "Alpha.md"),
      "# Alpha\n\n## Prompting\n\nThe paper discloses prompt templates for qualitative coding."
    );
    const config = {
      ...mockConfig,
      llmMode: "local" as const,
      reviewDataDir,
      paperMdDir,
      paperPdfDir,
      readerDbPath: path.join(root, "reader.sqlite"),
      localLlmBaseUrl: "http://localhost:8017/v1",
      localLlmModel: "qwen-runtime"
    };
    await ingestPaperMarkdown(config, "FT0001");
    const fetchImpl = mockChatCompletionFetch("Retrieved corpus context supports inclusion.");

    const answer = await answerScopedAsk(
      config,
      {
        recordId: "FT0001",
        question: "Does the paper disclose prompts?",
        payloadScope: "Corpus retrieval",
        evidence: []
      },
      fetchImpl as unknown as typeof fetch
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(JSON.stringify(request)).toContain("retrieved_corpus_chunks");
    expect(JSON.stringify(request)).toContain("prompt templates");
    expect(JSON.stringify(request)).not.toContain("References");
    expect(answer.evidenceUsed).toContain("FT0001 / Prompting");
    expect(answer.answer).toBe("Retrieved corpus context supports inclusion.");
    rmSync(root, { recursive: true, force: true });
  });

  it("answers from the current paper full text without selected evidence", async () => {
    const root = path.join(os.tmpdir(), `reader-current-full-text-${Date.now()}`);
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "md");
    const paperPdfDir = path.join(root, "pdf");
    mkdirSync(reviewDataDir, { recursive: true });
    mkdirSync(paperMdDir, { recursive: true });
    mkdirSync(paperPdfDir, { recursive: true });
    writeFileSync(
      path.join(reviewDataDir, "full_text_screening.csv"),
      [
        "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
        "FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,,,,,,,,unreviewed,,,"
      ].join("\n")
    );
    writeFileSync(
      path.join(paperMdDir, "Alpha.md"),
      "# Alpha\n\n## Evaluation\n\nThe study compares LLM suggestions with human qualitative coding."
    );
    const config = {
      ...mockConfig,
      llmMode: "local" as const,
      reviewDataDir,
      paperMdDir,
      paperPdfDir,
      readerDbPath: path.join(root, "reader.sqlite"),
      localLlmBaseUrl: "http://localhost:8017/v1",
      localLlmModel: "qwen-runtime"
    };
    const fetchImpl = mockChatCompletionFetch("Current full text supports the answer.");

    const answer = await answerScopedAsk(
      config,
      {
        recordId: "FT0001",
        question: "How does this paper evaluate the LLM output?",
        payloadScope: "Current full text",
        evidence: []
      },
      fetchImpl as unknown as typeof fetch
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const prompt = JSON.stringify(request);
    expect(prompt).toContain("current_full_text");
    expect(prompt).toContain("compares LLM suggestions with human qualitative coding");
    expect(prompt).toContain("evidence_packets:");
    expect(answer.evidenceUsed).toEqual(["FT0001 / Current full text"]);
    expect(answer.warnings).toContain("Provider response used current paper full text.");
    rmSync(root, { recursive: true, force: true });
  });

  it("synthesizes from all review-layer corpus knowledge instead of top retrieved chunks", async () => {
    const root = path.join(os.tmpdir(), `reader-corpus-synthesis-${Date.now()}`);
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "md");
    const paperPdfDir = path.join(root, "pdf");
    mkdirSync(reviewDataDir, { recursive: true });
    mkdirSync(paperMdDir, { recursive: true });
    mkdirSync(paperPdfDir, { recursive: true });
    writeFileSync(
      path.join(reviewDataDir, "full_text_screening.csv"),
      [
        "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
        "FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,include,,,,,,,,,,",
        "FT0002,Beta Study,Chen,2026,Beta.md,Beta.md,include,,,,,,,,,,"
      ].join("\n")
    );
    writeFileSync(path.join(paperMdDir, "Alpha.md"), "# Alpha\n\nRaw paper text should stay out.");
    writeFileSync(path.join(paperMdDir, "Beta.md"), "# Beta\n\nRaw paper text should stay out.");
    const config = {
      ...mockConfig,
      llmMode: "local" as const,
      reviewDataDir,
      paperMdDir,
      paperPdfDir,
      readerDbPath: path.join(root, "reader.sqlite"),
      localLlmBaseUrl: "http://localhost:8017/v1",
      localLlmModel: "qwen-runtime"
    };
    await ingestPaperMarkdown(config, "FT0001");
    saveExtractionArtifact(config, "FT0001", {
      methodTypology: "AI interviewer with human review.",
      promptingPractices: "Interview prompt disclosed.",
      evaluationPractices: "Expert audit.",
      synthesisNote: "Collection pathway.",
      evidenceLocator: "Methods p. 4"
    });
    saveEvidencePacket(config, {
      recordId: "FT0002",
      sourceFormat: "manual",
      sourcePath: null,
      evidenceLocator: "Reviewer memo",
      quoteSnippet: "",
      headingPath: null,
      pageNumber: null,
      reviewerNote: "LLM coding suggestions compared with human codes.",
      pdfVerificationNote: ""
    });
    await ingestReviewArtifacts(config, "FT0001");
    await ingestReviewArtifacts(config, "FT0002");
    const fetchImpl = mockChatCompletionFetch("Corpus synthesis answer.");

    const answer = await answerCorpusSynthesis(
      config,
      {
        question: "Across included studies, how are AI-assisted qualitative methods evaluated?",
        knowledgeBaseId: "default"
      },
      fetchImpl as unknown as typeof fetch
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const prompt = JSON.stringify(request);
    expect(prompt).toContain("review_layer_context");
    expect(prompt).toContain("record_id: FT0001");
    expect(prompt).toContain("record_id: FT0002");
    expect(prompt).toContain("AI interviewer with human review");
    expect(prompt).toContain("LLM coding suggestions compared with human codes");
    expect(prompt).not.toContain("Raw paper text should stay out");
    expect(answer.evidenceUsed).toEqual(
      expect.arrayContaining(["FT0001 / artifact / Method typology", "FT0002 / evidence / Reviewer memo"])
    );
    expect(answer.warnings).toContain("Provider response used review-layer knowledge only.");
    rmSync(root, { recursive: true, force: true });
  });

  it("only cites review-layer chunks that fit into the synthesis context", async () => {
    const root = path.join(os.tmpdir(), `reader-corpus-truncate-${Date.now()}`);
    const reviewDataDir = path.join(root, "review");
    const paperMdDir = path.join(root, "md");
    const paperPdfDir = path.join(root, "pdf");
    mkdirSync(reviewDataDir, { recursive: true });
    mkdirSync(paperMdDir, { recursive: true });
    mkdirSync(paperPdfDir, { recursive: true });
    writeFileSync(
      path.join(reviewDataDir, "full_text_screening.csv"),
      [
        "record_id,title,first_author,year,source_filename,source_path,decision,primary_exclusion_reason,eligibility_rationale,typology_relevance_notes,evaluation_relevance_notes,prompting_practices_notes,evidence_locator,review_status,second_review_reason,reviewer,review_date",
        "FT0001,Alpha Study,Rivera,2026,Alpha.md,Alpha.md,include,,,,,,,,,,"
      ].join("\n")
    );
    writeFileSync(path.join(paperMdDir, "Alpha.md"), "# Alpha\n\nPaper text.");
    const config = {
      ...mockConfig,
      llmMode: "local" as const,
      reviewDataDir,
      paperMdDir,
      paperPdfDir,
      readerDbPath: path.join(root, "reader.sqlite"),
      localLlmBaseUrl: "http://localhost:8017/v1",
      localLlmModel: "qwen-runtime",
      llmMaxInputChars: 1000
    };
    saveExtractionArtifact(config, "FT0001", {
      methodTypology: "Brief artifact note.",
      promptingPractices: "",
      evaluationPractices: "",
      synthesisNote: "",
      evidenceLocator: "Methods"
    });
    saveEvidencePacket(config, {
      recordId: "FT0001",
      sourceFormat: "manual",
      sourcePath: null,
      evidenceLocator: "Reviewer memo",
      quoteSnippet: "",
      headingPath: null,
      pageNumber: null,
      reviewerNote: "This evidence packet is intentionally beyond the tiny context budget. ".repeat(80),
      pdfVerificationNote: ""
    });
    await ingestReviewArtifacts(config, "FT0001");
    const fetchImpl = mockChatCompletionFetch("Truncated synthesis answer.");

    const answer = await answerCorpusSynthesis(
      config,
      {
        question: "What can be synthesized?",
        knowledgeBaseId: "default"
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(answer.evidenceUsed).toContain("FT0001 / artifact / Method typology");
    expect(answer.evidenceUsed).not.toContain("FT0001 / evidence / Reviewer memo");
    expect(answer.warnings).toContain(
      "Review-layer context was truncated to fit the configured model input limit."
    );
    rmSync(root, { recursive: true, force: true });
  });
});
