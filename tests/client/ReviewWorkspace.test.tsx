import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem, RuntimeModelSettings } from "@/lib/types";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";

describe("ReviewWorkspace", () => {
  it("organizes tools into cockpit task modes instead of stacked groups", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/model-config") {
          return Response.json({
            config: {
              activeMode: "mock",
              reviewerSources: ["local", "online"],
              local: { baseUrl: "http://localhost:8000/v1", selectedModel: "", configured: true },
              online: {
                baseUrlHost: "",
                selectedModel: "",
                configured: false,
                credentialState: "missing",
                configSource: "manual"
              }
            }
          });
        }
        if (String(url).startsWith("/api/knowledge-base")) {
          return Response.json({
            bases: [
              {
                id: "default",
                name: "Default review",
                documentCount: 4,
                chunkCount: 12,
                updatedAt: null
              }
            ],
            status: {
              knowledgeBaseId: "default",
              knowledgeBaseName: "Default review",
              documentCount: 4,
              chunkCount: 12,
              paperDocumentCount: 3,
              artifactDocumentCount: 0,
              evidenceDocumentCount: 1,
              embeddingModel: "portable-hash-v1",
              updatedAt: null
            }
          });
        }
        if (url === "/api/papers/FT0001/screening") {
          return Response.json({
            screening: {
              recordId: "FT0001",
              decision: "maybe",
              primaryExclusionReason: "",
              eligibilityRationale: "Loaded eligibility note.",
              typologyRelevanceNotes: "",
              evaluationRelevanceNotes: "",
              promptingPracticesNotes: "",
              evidenceLocator: "Methods",
              reviewStatus: "screened",
              secondReviewReason: "",
              reviewer: "YZ",
              reviewDate: "2026-06-25"
            }
          });
        }
        if (url === "/api/papers/FT0001/extraction") {
          return Response.json({
            extraction: {
              recordId: "FT0001",
              methodTypology: "Loaded method typology.",
              promptingPractices: "",
              evaluationPractices: "",
              synthesisNote: "",
              evidenceLocator: "Methods",
              updatedAt: "2026-06-25T00:00:00.000Z"
            }
          });
        }
        return Response.json({}, { status: 404 });
      })
    );

    render(
      <ReviewWorkspace
        paper={paper()}
        evidence={[]}
        evidenceRoute={null}
        modelSettings={settings()}
        onModelSettingsChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("4 documents")).toBeInTheDocument());

    expect(screen.getByRole("tab", { name: "Assist" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Review" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "AI help" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Corpus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Human record" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Brief" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Knowledge base" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Screening" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Extraction" })).not.toBeInTheDocument();
    expect(screen.getByText("Model: mock")).toHaveClass("workspace-status-line");

    await userEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(screen.getByRole("tab", { name: "Evidence" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Evidence attached" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ask" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Review" }));
    expect(screen.getByRole("tab", { name: "Review" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(screen.getByText("maybe", { selector: ".review-meta-value" })).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("Loaded method typology.")).toBeInTheDocument()
    );
    expect(
      screen.getByText("maybe", { selector: ".review-meta-value" }).closest(".workspace-status-strip")
    ).toHaveClass("workspace-status-strip");
    expect(screen.getByRole("heading", { name: "Screening" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extraction" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Knowledge base" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Assist" }));
    const askSummary = screen.getByRole("heading", { name: "Ask" }).closest("summary");
    await userEvent.click(askSummary as HTMLElement);
    expect(askSummary?.parentElement).toHaveAttribute("open");
    expect(window.localStorage.getItem("paper-lens:artifact:review-workspace:ask")).toBe("open");

    const briefSummary = screen.getByRole("heading", { name: "Brief" }).closest("summary");
    expect(briefSummary?.parentElement).not.toHaveAttribute("open");
    await userEvent.click(briefSummary as HTMLElement);
    expect(briefSummary?.parentElement).toHaveAttribute("open");
  });
});

function paper(): PaperListItem {
  return {
    recordId: "FT0001",
    title: "A test paper",
    firstAuthor: "Author",
    year: "2026",
    sourceFilename: "paper.md",
    sourcePath: "/paper.md",
    decision: "",
    reviewStatus: "needs_human_check",
    hasMarkdown: true,
    hasPdf: true,
    markdownPath: "/paper.md",
    pdfPath: "/paper.pdf",
    methodItemCount: 0,
    promptItemCount: 0,
    evaluationItemCount: 0
  };
}

function settings(): RuntimeModelSettings {
  return {
    mode: "mock",
    localBaseUrl: "http://localhost:8000/v1",
    localModel: "",
    onlineBaseUrl: "",
    onlineModel: "",
    onlineConfigSource: "manual",
    onlineApiKey: ""
  };
}
