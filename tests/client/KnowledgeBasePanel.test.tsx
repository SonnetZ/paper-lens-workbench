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
      if (String(url).startsWith("/api/knowledge-base")) {
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
      if (String(url).startsWith("/api/knowledge-base") && !init) {
        return Response.json({
          bases: [
            {
              id: "default",
              name: "Default review",
              documentCount: 0,
              chunkCount: 0,
              updatedAt: null
            }
          ],
          status: {
            knowledgeBaseId: "default",
            knowledgeBaseName: "Default review",
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
          bases: [
            {
              id: "default",
              name: "Default review",
              documentCount: 2,
              chunkCount: 5,
              updatedAt: "2026-06-24T00:00:00.000Z"
            }
          ],
          ingested: { documentCount: 2, chunkCount: 5, embeddingModel: "portable-hash-v1" },
          status: {
            knowledgeBaseId: "default",
            knowledgeBaseName: "Default review",
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
          body: JSON.stringify({
            includePaper: true,
            includeArtifacts: false,
            knowledgeBaseId: "default"
          })
        })
      )
    );
    expect(await screen.findByText("5 chunks")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Knowledge search"), "human in the loop");
    await userEvent.click(screen.getByRole("button", { name: "Search knowledge" }));

    expect(await screen.findByText("Methods")).toBeInTheDocument();
    expect(screen.getByText(/human-in-the-loop coding/)).toBeInTheDocument();
  });

  it("creates and uses a separate review knowledge base", async () => {
    const onKnowledgeBaseChange = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith("/api/knowledge-base") && !init) {
        return Response.json({
          bases: [
            {
              id: "default",
              name: "Default review",
              documentCount: 0,
              chunkCount: 0,
              updatedAt: null
            }
          ],
          status: status("default", "Default review", 0)
        });
      }
      if (url === "/api/knowledge-base" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.action === "create") {
          return Response.json({
            base: {
              id: "kb_scope",
              name: "Scoping review A",
              documentCount: 0,
              chunkCount: 0,
              updatedAt: "2026-06-27T00:00:00.000Z"
            },
            bases: [
              {
                id: "default",
                name: "Default review",
                documentCount: 0,
                chunkCount: 0,
                updatedAt: null
              },
              {
                id: "kb_scope",
                name: "Scoping review A",
                documentCount: 0,
                chunkCount: 0,
                updatedAt: "2026-06-27T00:00:00.000Z"
              }
            ],
            status: status("kb_scope", "Scoping review A", 0)
          });
        }
        return Response.json({
          bases: [],
          ingested: { documentCount: 1, chunkCount: 3, embeddingModel: "portable-hash-v1" },
          status: status("kb_scope", "Scoping review A", 3)
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <KnowledgeBasePanel
        paper={paper}
        selectedKnowledgeBaseId="default"
        onKnowledgeBaseChange={onKnowledgeBaseChange}
      />
    );

    await userEvent.type(await screen.findByLabelText("New knowledge base name"), "Scoping review A");
    await userEvent.click(screen.getByRole("button", { name: "Create knowledge base" }));
    await waitFor(() => expect(onKnowledgeBaseChange).toHaveBeenCalledWith("kb_scope"));
  });
});

function status(knowledgeBaseId: string, knowledgeBaseName: string, chunkCount: number) {
  return {
    knowledgeBaseId,
    knowledgeBaseName,
    documentCount: chunkCount ? 1 : 0,
    chunkCount,
    paperDocumentCount: chunkCount ? 1 : 0,
    artifactDocumentCount: 0,
    evidenceDocumentCount: 0,
    embeddingModel: "portable-hash-v1",
    updatedAt: chunkCount ? "2026-06-27T00:00:00.000Z" : null
  };
}
