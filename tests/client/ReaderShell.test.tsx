import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { ReaderShell } from "@/components/ReaderShell";

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
  it("offers Markdown as the working view and PDF only as a verification source", () => {
    render(<ReaderShell paper={paper} onEvidence={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Split" })).not.toBeInTheDocument();
  });
});
