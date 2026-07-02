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
    reviewProjectId: "default",
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
  it("loads saved chat, renders markdown answers, and sends follow-up questions", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith("/api/papers/FT0001/ask") && !init) {
        return Response.json({
          messages: [
            {
              id: "ask_saved_user",
              role: "user",
              content: "What is the evaluation design?",
              evidenceUsed: [],
              warnings: [],
              createdAt: "2026-07-03T00:00:00.000Z"
            },
            {
              id: "ask_saved_assistant",
              role: "assistant",
              content: "The paper uses **expert audit**.",
              evidenceUsed: ["Reviewer memo"],
              warnings: [],
              createdAt: "2026-07-03T00:00:01.000Z"
            }
          ]
        });
      }
      return Response.json({
        messages: [
          {
            id: "ask_saved_user",
            role: "user",
            content: "What is the evaluation design?",
            evidenceUsed: [],
            warnings: [],
            createdAt: "2026-07-03T00:00:00.000Z"
          },
          {
            id: "ask_saved_assistant",
            role: "assistant",
            content: "The paper uses **expert audit**.",
            evidenceUsed: ["Reviewer memo"],
            warnings: [],
            createdAt: "2026-07-03T00:00:01.000Z"
          },
          {
            id: "ask_new_user",
            role: "user",
            content: "What should I inspect next?",
            evidenceUsed: [],
            warnings: [],
            createdAt: "2026-07-03T00:00:02.000Z"
          },
          {
            id: "ask_new_assistant",
            role: "assistant",
            content: "Inspect the **methods** section next.",
            evidenceUsed: ["Reviewer memo"],
            warnings: ["Provider response used scoped evidence only."],
            createdAt: "2026-07-03T00:00:03.000Z"
          }
        ]
      });
    });
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

    expect(await screen.findByText("What is the evaluation design?")).toBeInTheDocument();
    expect(screen.getByText("expert audit").tagName).toBe("STRONG");
    expect(
      screen.getByRole("button", { name: "Answer only from evidence packets attached in the tray." })
    ).toBeInTheDocument();
    expect(screen.getByText("Model: local / qwen-local")).toBeInTheDocument();
    expect(screen.queryByText(/evidence packet/)).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Question"),
      "What should I inspect next?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask with evidence" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/papers/FT0001/ask");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      question: "What should I inspect next?",
      payloadScope: "Selection",
      evidence: [expect.objectContaining({ evidenceLocator: "Reviewer memo" })],
      modelSettings: expect.objectContaining({
        mode: "local",
        localBaseUrl: "http://localhost:8017/v1",
        localModel: "qwen-local"
      })
    });
    expect((await screen.findByText("methods")).tagName).toBe("STRONG");
    expect(screen.getAllByText("Reviewer memo").length).toBeGreaterThan(0);
    const actions = screen.getByRole("group", { name: "Ask actions" });
    expect(actions).toContainElement(screen.getByText("4 message(s)"));
    expect(actions).toContainElement(screen.getByRole("button", { name: "Clear chat" }));
    expect(actions).toContainElement(screen.getByRole("button", { name: "Ask with evidence" }));
  });

  it("collapses only messages longer than the preview threshold", async () => {
    const longContent = `${"Long answer. ".repeat(80)}Final sentence.`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          messages: [
            {
              id: "ask_short",
              role: "assistant",
              content: "Short answer.",
              evidenceUsed: [],
              warnings: [],
              createdAt: "2026-07-03T00:00:00.000Z"
            },
            {
              id: "ask_long",
              role: "user",
              content: longContent,
              evidenceUsed: [],
              warnings: [],
              createdAt: "2026-07-03T00:00:01.000Z"
            }
          ]
        })
      )
    );

    render(<AskPanel paper={paper} evidence={[]} />);

    expect(await screen.findByText("Short answer.")).toBeInTheDocument();
    expect(screen.queryByText(longContent)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand message" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse message" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand message" }));

    expect(screen.getByText(longContent)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse message" })).toBeInTheDocument();
  });

  it("asks with corpus retrieval without selected evidence", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init
        ? Response.json({
            messages: [
              {
                id: "ask_user",
                role: "user",
                content: "Does the paper disclose prompts?",
                evidenceUsed: [],
                warnings: [],
                createdAt: "2026-07-03T00:00:00.000Z"
              },
              {
                id: "ask_assistant",
                role: "assistant",
                content: "Retrieved chunks support the claim.",
                evidenceUsed: ["FT0001 / Methods"],
                warnings: ["Provider response used scoped evidence only."],
                createdAt: "2026-07-03T00:00:01.000Z"
              }
            ]
          })
        : Response.json({ messages: [] })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AskPanel paper={paper} evidence={[]} />);

    await userEvent.selectOptions(screen.getByLabelText("Payload scope"), "Corpus retrieval");
    expect(
      screen.getByRole("button", {
        name: "Search the selected knowledge base and answer from retrieved chunks."
      })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Question"), "Does the paper disclose prompts?");
    await userEvent.click(screen.getByRole("button", { name: "Ask with corpus retrieval" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      question: "Does the paper disclose prompts?",
      payloadScope: "Corpus retrieval",
      evidence: [],
      knowledgeBaseId: "default"
    });
    expect(await screen.findByText(/Retrieved chunks support/)).toBeInTheDocument();
    expect(screen.getByText("FT0001 / Methods")).toBeInTheDocument();
  });

  it("asks against the current paper full text without selected evidence", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init
        ? Response.json({
            messages: [
              {
                id: "ask_user",
                role: "user",
                content: "What is the evaluation design?",
                evidenceUsed: [],
                warnings: [],
                createdAt: "2026-07-03T00:00:00.000Z"
              },
              {
                id: "ask_assistant",
                role: "assistant",
                content: "The current paper text supports the answer.",
                evidenceUsed: ["FT0001 / Current full text"],
                warnings: ["Provider response used current paper full text."],
                createdAt: "2026-07-03T00:00:01.000Z"
              }
            ]
          })
        : Response.json({ messages: [] })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AskPanel paper={paper} evidence={[]} />);

    await userEvent.selectOptions(screen.getByLabelText("Payload scope"), "Current full text");
    expect(
      screen.getByRole("button", {
        name: "Answer from the currently selected paper text."
      })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Question"), "What is the evaluation design?");
    await userEvent.click(screen.getByRole("button", { name: "Ask with current full text" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      question: "What is the evaluation design?",
      payloadScope: "Current full text",
      evidence: []
    });
    expect(await screen.findByText(/current paper text supports/)).toBeInTheDocument();
    expect(screen.getByText("FT0001 / Current full text")).toBeInTheDocument();
  });

  it("clears the current scope chat", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return Response.json({ messages: [] });
      return Response.json({
        messages: [
          {
            id: "ask_saved_user",
            role: "user",
            content: "Saved question",
            evidenceUsed: [],
            warnings: [],
            createdAt: "2026-07-03T00:00:00.000Z"
          }
        ]
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AskPanel paper={paper} evidence={[]} />);

    expect(await screen.findByText("Saved question")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear chat" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/papers/FT0001/ask?reviewProjectId=default&payloadScope=Selection",
      expect.objectContaining({ method: "DELETE" })
    ));
    expect(screen.queryByText("Saved question")).not.toBeInTheDocument();
  });
});
