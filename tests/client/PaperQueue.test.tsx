import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { PaperQueue } from "@/components/PaperQueue";

const papers: PaperListItem[] = [
  {
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
  },
  {
    recordId: "FT0049",
    title: "",
    firstAuthor: "",
    year: "",
    sourceFilename: "Assessing the Potential and Limits of Large Language Models in Qualitative Coding.md",
    sourcePath: "Assessing the Potential and Limits of Large Language Models in Qualitative Coding.md",
    decision: "include",
    reviewStatus: "needs_human_check",
    hasMarkdown: true,
    hasPdf: true,
    markdownPath: "/sample/FT0049.md",
    pdfPath: "/sample/FT0049.pdf",
    methodItemCount: 0,
    promptItemCount: 0,
    evaluationItemCount: 0
  }
];

describe("PaperQueue", () => {
  it("renders paper metadata and selects a paper", async () => {
    const onSelect = vi.fn();

    render(
      <PaperQueue
        papers={papers}
        selectedRecordId={null}
        onSelect={onSelect}
        onCorpusApplied={vi.fn()}
      />
    );

    expect(screen.getByText("FT0001")).toBeInTheDocument();
    expect(screen.getByText("Sample AI-assisted interview analysis")).toBeInTheDocument();
    expect(screen.getAllByText("MD").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /FT0001/ }));
    expect(onSelect).toHaveBeenCalledWith("FT0001");
  });

  it("filters the queue by record id and filename keywords", async () => {
    render(
      <PaperQueue
        papers={papers}
        selectedRecordId={null}
        onSelect={vi.fn()}
        onCorpusApplied={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText("Search review queue"), "FT0049");

    expect(screen.getByText("FT0049")).toBeInTheDocument();
    expect(screen.getByText(/Assessing the Potential/)).toBeInTheDocument();
    expect(screen.queryByText("Sample AI-assisted interview analysis")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 records")).toBeInTheDocument();
  });
});
