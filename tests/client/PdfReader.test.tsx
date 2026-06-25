import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfReader } from "@/components/PdfReader";

describe("PdfReader", () => {
  it("uses a viewport-fitted reading height for the PDF preview", () => {
    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={vi.fn()}
      />
    );

    expect(screen.getByLabelText("PDF reader panel")).toHaveClass("h-[calc(100dvh-150px)]");
    expect(screen.getByTitle("PDF preview")).toHaveClass("min-h-0");
  });
});
