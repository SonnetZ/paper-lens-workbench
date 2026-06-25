import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";

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

describe("KnowledgeBasePanel", () => {
  it("keeps the reader usable when the status response is malformed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/knowledge-base") {
        return Response.json({ content: "" });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeBasePanel paper={paper} />);

    expect(await screen.findByText("Knowledge base status unavailable")).toBeInTheDocument();
    expect(screen.getByText("0 documents")).toBeInTheDocument();
    expect(screen.getByText("0 chunks")).toBeInTheDocument();
  });

  it("builds paper and artifact knowledge, then searches the local knowledge base", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/knowledge-base" && !init) {
        return Response.json({
          status: {
            documentCount: 0,
            chunkCount: 0,
            paperDocumentCount: 0,
            artifactDocumentCount: 0,
            evidenceDocumentCount: 0,
            embeddingModel: "portable-hash-v1",
            updatedAt: null
          }
        });
      }
      if (url === "/api/papers/FT0001/knowledge" && init?.method === "POST") {
        return Response.json({
          ingested: { documentCount: 2, chunkCount: 5, embeddingModel: "portable-hash-v1" },
          status: {
            documentCount: 2,
            chunkCount: 5,
            paperDocumentCount: 1,
            artifactDocumentCount: 1,
            evidenceDocumentCount: 0,
            embeddingModel: "portable-hash-v1",
            updatedAt: "2026-06-24T00:00:00.000Z"
          }
        });
      }
      if (url === "/api/knowledge-base/search" && init?.method === "POST") {
        return Response.json({
          results: [
            {
              chunkId: "kb_chunk",
              documentId: "kb_doc",
              recordId: "FT0001",
              sourceKind: "paper",
              sourceId: "FT0001_sample.md",
              headingPath: "Methods",
              text: "The study uses human-in-the-loop coding.",
              score: 0.42
            }
          ]
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeBasePanel paper={paper} />);

    expect(await screen.findByText("0 chunks")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add current paper" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/papers/FT0001/knowledge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ includePaper: true, includeArtifacts: false })
        })
      )
    );
    expect(await screen.findByText("5 chunks")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Knowledge search"), "human in the loop");
    await userEvent.click(screen.getByRole("button", { name: "Search knowledge" }));

    expect(await screen.findByText("Methods")).toBeInTheDocument();
    expect(screen.getByText(/human-in-the-loop coding/)).toBeInTheDocument();
  });
});
