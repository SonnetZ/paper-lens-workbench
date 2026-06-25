import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { ReviewMaterialExport } from "@/components/ReviewMaterialExport";

const paper: PaperListItem = {
  recordId: "FT0001",
  title: "Sample AI-assisted interview analysis",
  firstAuthor: "Rivera",
  year: "2026",
  sourceFilename: "FT0001_sample.md",
  sourcePath: "FT0001_sample.md",
  decision: "include",
  reviewStatus: "screened",
  hasMarkdown: true,
  hasPdf: false,
  markdownPath: "/sample/FT0001_sample.md",
  pdfPath: null,
  methodItemCount: 0,
  promptItemCount: 0,
  evaluationItemCount: 0
};

describe("ReviewMaterialExport", () => {
  it("exports the selected paper's review material packet", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        export: {
          recordId: "FT0001",
          format: "markdown",
          path: "/tmp/exports/review-materials/FT0001_review_material.md",
          evidenceCount: 2
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewMaterialExport paper={paper} />);

    await userEvent.click(screen.getByRole("button", { name: "Export review material" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/papers/FT0001/export", {
        method: "POST"
      });
    });
    expect(await screen.findByText("Exported 2 evidence item(s).")).toBeInTheDocument();
    expect(screen.getByText("/tmp/exports/review-materials/FT0001_review_material.md")).toBeInTheDocument();
  });
});
