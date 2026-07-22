import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskChatMessage, PaperListItem } from "@/lib/types";
import { ReaderShell } from "@/components/ReaderShell";

vi.mock("@/components/MarkdownReader", () => ({
  MarkdownReader: () => <div>Mock Markdown Reader</div>
}));

vi.mock("@/components/PdfReader", () => ({
  PdfReader: ({ onAskMessages }: { onAskMessages?: (messages: AskChatMessage[]) => void }) => (
    <div>
      Mock PDF Reader
      <button
        type="button"
        onClick={() =>
          onAskMessages?.([
            {
              id: "ask_new",
              reviewProjectId: "review-a",
              recordId: "FT0001",
              payloadScope: "Selection",
              role: "assistant",
              content: "New popup answer",
              evidenceUsed: ["PDF p.2"],
              warnings: [],
              createdAt: "2026-07-22T00:00:02.000Z"
            }
          ])
        }
      >
        Publish selection messages
      </button>
    </div>
  )
}));

const paper: PaperListItem = {
  recordId: "FT0001",
  title: "Sample AI-assisted interview analysis",
  firstAuthor: "Rivera",
  year: "2026",
  sourceFilename: "FT0001_sample.md",
  sourcePath: "FT0001_sample.md",
  decision: "",
  reviewStatus: "unreviewed",
  hasMarkdown: false,
  hasPdf: false,
  markdownPath: null,
  pdfPath: null,
  methodItemCount: 0,
  promptItemCount: 0,
  evaluationItemCount: 0
};

describe("ReaderShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages: [] })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers Markdown as the working view and PDF only as a verification source", async () => {
    render(<ReaderShell paper={paper} onEvidence={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Split" })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("opens a PDF-only paper in the PDF reader by default", async () => {
    render(
      <ReaderShell
        paper={{
          ...paper,
          sourceFilename: "standalone.pdf",
          sourcePath: "/papers/standalone.pdf",
          hasPdf: true,
          pdfPath: "/papers/standalone.pdf"
        }}
        onEvidence={vi.fn()}
      />
    );

    expect(screen.getByText("Mock PDF Reader")).toBeInTheDocument();
    expect(screen.queryByText("Markdown source not loaded.")).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("opens a paper with both Markdown and PDF in the PDF reader by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/markdown")
          ? Response.json({ content: "# Sample" })
          : Response.json({ messages: [] })
      )
    );

    render(
      <ReaderShell
        paper={{
          ...paper,
          hasMarkdown: true,
          hasPdf: true,
          markdownPath: "/papers/paired.md",
          pdfPath: "/papers/paired.pdf"
        }}
        onEvidence={vi.fn()}
      />
    );

    expect(screen.getByText("Mock PDF Reader")).toBeInTheDocument();
    expect(screen.queryByText("Mock Markdown Reader")).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("loads and updates the paper selection conversation in a collapsible reader rail", async () => {
    const messages: AskChatMessage[] = [
      {
        id: "ask_user",
        reviewProjectId: "review-a",
        recordId: "FT0001",
        payloadScope: "Selection",
        role: "user",
        content: "Saved selection question",
        evidenceUsed: [],
        warnings: [],
        createdAt: "2026-07-22T00:00:00.000Z"
      },
      {
        id: "ask_assistant",
        reviewProjectId: "review-a",
        recordId: "FT0001",
        payloadScope: "Selection",
        role: "assistant",
        content: "Saved selection answer",
        evidenceUsed: ["PDF p.1"],
        warnings: [],
        createdAt: "2026-07-22T00:00:01.000Z"
      }
    ];
    const fetchMock = vi.fn(async () => Response.json({ messages }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ReaderShell
        paper={{
          ...paper,
          hasPdf: true,
          pdfPath: "/papers/paired.pdf"
        }}
        knowledgeBaseId="review-a"
        onEvidence={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/papers/FT0001/ask?reviewProjectId=review-a&payloadScope=Selection",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Open selection conversation, 2 messages" })
    );
    expect(screen.getByText("Saved selection question")).toBeInTheDocument();
    expect(screen.getByText("Saved selection answer")).toBeInTheDocument();
    expect(screen.getByText("PDF p.1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Publish selection messages" }));
    expect(screen.getByText("New popup answer")).toBeInTheDocument();
  });
});
