import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EvidencePacket, PaperListItem } from "@/lib/types";
import { AskPanel } from "@/components/AskPanel";

const paper: PaperListItem = {
  recordId: "FT0001",
  title: "Sample AI-assisted interview analysis",
  firstAuthor: "Rivera",
  year: "2026",
  sourceFilename: "FT0001_sample.md",
  sourcePath: "FT0001_sample.md",
  decision: "",
  reviewStatus: "unreviewed",
  hasMarkdown: true,
  hasPdf: false,
  markdownPath: "/sample/FT0001_sample.md",
  pdfPath: null,
  methodItemCount: 0,
  promptItemCount: 0,
  evaluationItemCount: 0
};

const evidence: EvidencePacket[] = [
  {
    id: "draft_1",
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

describe("AskPanel", () => {
  it("asks a scoped question using only current evidence packets", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json({
        answer: {
          recordId: "FT0001",
          payloadScope: "Selection",
          answer: "Mock scoped answer. The supplied memo supports inclusion.",
          evidenceUsed: ["Reviewer memo"],
          warnings: ["Mock response. No full paper text was sent to a model."]
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AskPanel
        paper={paper}
        evidence={evidence}
        modelSettings={{
          mode: "local",
          localBaseUrl: "http://localhost:8017/v1",
          localModel: "qwen-local",
          onlineBaseUrl: "",
          onlineModel: "",
          onlineConfigSource: "manual",
          onlineApiKey: ""
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: "Answer only from evidence packets attached in the tray." })
    ).toBeInTheDocument();
    expect(screen.getByText("Model: local / qwen-local")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Question"),
      "Does this paper evaluate LLM-assisted qualitative analysis?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask with evidence" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/papers/FT0001/ask");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      question: "Does this paper evaluate LLM-assisted qualitative analysis?",
      payloadScope: "Selection",
      evidence: [expect.objectContaining({ evidenceLocator: "Reviewer memo" })],
      modelSettings: expect.objectContaining({
        mode: "local",
        localBaseUrl: "http://localhost:8017/v1",
        localModel: "qwen-local"
      })
    });
    expect(await screen.findByText(/supplied memo supports inclusion/)).toBeInTheDocument();
    expect(screen.getByText("Reviewer memo")).toBeInTheDocument();
  });

  it("asks with corpus retrieval without selected evidence", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        answer: {
          recordId: "FT0001",
          payloadScope: "Corpus retrieval",
          answer: "Retrieved chunks support the claim.",
          evidenceUsed: ["FT0001 / Methods"],
          warnings: ["Provider response used scoped evidence only."]
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AskPanel paper={paper} evidence={[]} />);

    await userEvent.selectOptions(screen.getByLabelText("Payload scope"), "Corpus retrieval");
    expect(
      screen.getByRole("button", {
        name: "Search the local knowledge base and answer from retrieved chunks."
      })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Question"), "Does the paper disclose prompts?");
    await userEvent.click(screen.getByRole("button", { name: "Ask with corpus retrieval" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      question: "Does the paper disclose prompts?",
      payloadScope: "Corpus retrieval",
      evidence: []
    });
    expect(await screen.findByText(/Retrieved chunks support/)).toBeInTheDocument();
    expect(screen.getByText("FT0001 / Methods")).toBeInTheDocument();
  });
});
