import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { BriefPanel } from "@/components/BriefPanel";

describe("BriefPanel", () => {
  it("generates a draft navigation brief for the selected paper", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        brief: {
          eligibility_suggestion: "maybe",
          rationale: "Read methods before deciding.",
          read_first: ["Abstract", "Methods"],
          warnings: ["Draft only."]
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<BriefPanel paper={paper()} />);

    await userEvent.click(screen.getByRole("button", { name: "Generate brief" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/papers/FT0001/brief",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ payloadScope: "Selection" })
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
