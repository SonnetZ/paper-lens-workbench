import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { BriefPanel } from "@/components/BriefPanel";

describe("BriefPanel", () => {
  it("loads the latest saved brief before generating a new one", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/papers/FT0001/brief?reviewProjectId=project-a" && init?.method === "GET") {
        return Response.json({
          brief: {
            recordId: "FT0001",
            eligibility_suggestion: "include",
            rationale: "Already saved for this project.",
            read_first: ["Abstract"],
            warnings: []
          }
        });
      }
      if (url === "/api/papers/FT0001/brief" && init?.method === "POST") {
        return Response.json({
          brief: {
            recordId: "FT0001",
            eligibility_suggestion: "maybe",
            rationale: "Read methods before deciding.",
            read_first: ["Abstract", "Methods"],
            warnings: ["Draft only."]
          }
        });
      }
      return Response.json({ brief: null });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <BriefPanel paper={paper()} modelSettings={modelSettings()} reviewProjectId="project-a" />
    );

    await waitFor(() =>
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/papers/FT0001/brief?reviewProjectId=project-a")
    );
    expect(await screen.findByText("Already saved for this project.")).toBeInTheDocument();
    expect(screen.getByText("Read first: Abstract")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Generate brief" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/papers/FT0001/brief",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reviewProjectId: "project-a",
            payloadScope: "Paper sections",
            modelSettings: modelSettings()
          })
        })
      )
    );
    expect(await screen.findByText("Read methods before deciding.")).toBeInTheDocument();
    expect(screen.getByText("Read first: Abstract, Methods")).toBeInTheDocument();
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

function modelSettings() {
  return {
    mode: "local" as const,
    localBaseUrl: "http://localhost:8000/v1",
    localModel: "qwen-local",
    onlineBaseUrl: "",
    onlineModel: "",
    onlineConfigSource: "manual" as const,
    onlineApiKey: ""
  };
}
