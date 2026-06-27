import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaperListItem } from "@/lib/types";
import { ReaderShell } from "@/components/ReaderShell";

vi.mock("@/components/MarkdownReader", () => ({
  MarkdownReader: () => <div>Mock Markdown Reader</div>
}));

vi.mock("@/components/PdfReader", () => ({
  PdfReader: () => <div>Mock PDF Reader</div>
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
  it("offers Markdown as the working view and PDF only as a verification source", () => {
    render(<ReaderShell paper={paper} onEvidence={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Split" })).not.toBeInTheDocument();
  });

  it("opens a PDF-only paper in the PDF reader by default", () => {
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
  });

  it("opens a paper with both Markdown and PDF in the PDF reader by default", () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ content: "# Sample" })));

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
  });
});
